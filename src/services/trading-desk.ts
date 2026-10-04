import {
  TRADING_DESK_STALE_AFTER_MS,
  tradingDeskStatusUrl,
} from '@/config/trading-desk';

export const TRADING_DESK_SEATS = [
  'SCAN',
  'VET',
  'SOCIAL',
  'CHIEF',
  'SIZE',
  'FILLS',
  'RISK',
  'COORDINATOR',
] as const;

export type TradingDeskSeatName = (typeof TRADING_DESK_SEATS)[number];
export type TradingDeskSeatStatus = 'ok' | 'idle' | 'warn' | 'error';
export type TradingDeskCycleOutcome = 'pick' | 'no_trade' | 'aborted';
export type TradingDeskPositionStatus = 'open' | 'closed';

export interface TradingDeskSeat {
  name: string;
  status: string;
  note: string;
}

export interface TradingDeskCycle {
  at: string;
  outcome: string;
  universe: number | null;
  survivors: number | null;
  reason: string;
}

export interface TradingDeskPosition {
  symbol: string;
  chain: string;
  address: string;
  entry_price: number | null;
  current_price: number | null;
  ticket_usd: number | null;
  pnl_pct: number | null;
  pnl_usd_after_fees: number | null;
  opened_at: string;
  status: string;
}

export interface TradingDeskTotals {
  paper_bank_usd: number | null;
  realized_usd: number | null;
  unrealized_usd: number | null;
  trades: number | null;
  win_rate: number | null;
}

export interface TradingDeskStatus {
  updated_at: string;
  mode: string;
  seats: TradingDeskSeat[];
  last_cycle: TradingDeskCycle | null;
  positions: TradingDeskPosition[];
  totals: TradingDeskTotals;
}

export type TradingDeskLoadFailure = 'missing' | 'unreachable' | 'invalid';

export type TradingDeskLoadResult =
  | { ok: true; status: TradingDeskStatus; stale: boolean }
  | { ok: false; reason: TradingDeskLoadFailure };

const FETCH_TIMEOUT_MS = 12_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function parseSeat(value: unknown): TradingDeskSeat | null {
  if (!isRecord(value)) return null;
  const name = asString(value.name).trim();
  if (!name) return null;
  return {
    name,
    status: asString(value.status).trim().toLowerCase() || 'idle',
    note: asString(value.note),
  };
}

function parseCycle(value: unknown): TradingDeskCycle | null {
  if (!isRecord(value)) return null;
  const at = asString(value.at);
  const outcome = asString(value.outcome);
  if (!at && !outcome && value.reason == null) return null;
  return {
    at,
    outcome,
    universe: asNumber(value.universe),
    survivors: asNumber(value.survivors),
    reason: asString(value.reason),
  };
}

function parsePosition(value: unknown): TradingDeskPosition | null {
  if (!isRecord(value)) return null;
  const symbol = asString(value.symbol).trim();
  if (!symbol) return null;
  return {
    symbol,
    chain: asString(value.chain),
    address: asString(value.address),
    entry_price: asNumber(value.entry_price),
    current_price: asNumber(value.current_price),
    ticket_usd: asNumber(value.ticket_usd),
    pnl_pct: asNumber(value.pnl_pct),
    pnl_usd_after_fees: asNumber(value.pnl_usd_after_fees),
    opened_at: asString(value.opened_at),
    status: asString(value.status).trim().toLowerCase() || 'open',
  };
}

function parseTotals(value: unknown): TradingDeskTotals {
  const record = isRecord(value) ? value : {};
  return {
    paper_bank_usd: asNumber(record.paper_bank_usd),
    realized_usd: asNumber(record.realized_usd),
    unrealized_usd: asNumber(record.unrealized_usd),
    trades: asNumber(record.trades),
    win_rate: asNumber(record.win_rate),
  };
}

/**
 * Accept a desk status document. Extra fields (including `example`) are ignored.
 * Returns null when the payload has no `updated_at`, which the panel treats
 * as "no desk data yet".
 */
export function parseTradingDeskStatus(value: unknown): TradingDeskStatus | null {
  if (!isRecord(value)) return null;
  const updatedAt = asString(value.updated_at).trim();
  if (!updatedAt) return null;
  const seats = Array.isArray(value.seats)
    ? value.seats.map(parseSeat).filter((seat): seat is TradingDeskSeat => seat !== null)
    : [];
  const positions = Array.isArray(value.positions)
    ? value.positions.map(parsePosition).filter((row): row is TradingDeskPosition => row !== null)
    : [];
  return {
    updated_at: updatedAt,
    mode: asString(value.mode).trim().toLowerCase() || 'unknown',
    seats,
    last_cycle: parseCycle(value.last_cycle),
    positions,
    totals: parseTotals(value.totals),
  };
}

export function isTradingDeskStale(status: TradingDeskStatus, now = Date.now()): boolean {
  const updatedAt = Date.parse(status.updated_at);
  if (!Number.isFinite(updatedAt)) return true;
  return now - updatedAt > TRADING_DESK_STALE_AFTER_MS;
}

export function formatTradingDeskAge(updatedAt: string | null | undefined, now = Date.now()): string {
  if (!updatedAt) return 'unknown';
  const parsed = Date.parse(updatedAt);
  if (!Number.isFinite(parsed)) return 'unknown';
  const delta = Math.max(0, now - parsed);
  if (delta < 45_000) return 'just now';
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
    || (error instanceof Error && error.name === 'AbortError');
}

export async function loadTradingDeskStatus(signal?: AbortSignal): Promise<TradingDeskLoadResult> {
  const url = tradingDeskStatusUrl();
  if (!url) return { ok: false, reason: 'missing' };

  const timeout = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;

  let response: Response;
  try {
    response = await fetch(url, {
      signal: combined,
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    return { ok: false, reason: 'unreachable' };
  }

  if (response.status === 404 || response.status === 204) {
    return { ok: false, reason: 'missing' };
  }
  if (!response.ok) return { ok: false, reason: 'unreachable' };

  let body: unknown;
  try {
    const text = await response.text();
    if (!text.trim()) return { ok: false, reason: 'missing' };
    body = JSON.parse(text) as unknown;
  } catch (error) {
    if (isAbortError(error)) throw error;
    return { ok: false, reason: 'invalid' };
  }

  const status = parseTradingDeskStatus(body);
  if (!status) return { ok: false, reason: 'invalid' };
  return { ok: true, status, stale: isTradingDeskStale(status) };
}
