import { formatTradingDeskAge } from '@/services/trading-desk';
import type {
  TradingDeskPosition,
  TradingDeskStatus,
  TradingDeskTotals,
} from '@/services/trading-desk';
import {
  formatDeskClock,
  formatDeskDuration,
  formatDeskPrice,
  formatDeskSignedPct,
  formatDeskUsd,
  formatDeskWhen,
  formatDeskWinRate,
} from '@/desk-hq/format';
import { kindColor, seatColor } from '@/desk-hq/palette';

const DASH = '—';

const ROSTER: Array<{ name: string; role: string }> = [
  { name: 'SCAN', role: 'SCANNER' },
  { name: 'VET', role: 'VETTING' },
  { name: 'SOCIAL', role: 'SOCIAL' },
  { name: 'CHIEF', role: 'CHIEF' },
  { name: 'SIZE', role: 'SIZING' },
  { name: 'FILLS', role: 'FILLS' },
  { name: 'RISK', role: 'RISK' },
  { name: 'COORDINATOR', role: 'FLOOR' },
];

export interface DeskHqSeatView {
  name: string;
  role: string;
  number: string;
  status: string;
  runLabel: string;
  note: string;
  color: string;
  working: boolean;
  inSnapshot: boolean;
}

export interface DeskHqHistoryPoint {
  at: number;
  bank: number;
}

export interface DeskHqActivityView {
  atLabel: string;
  seat: string;
  kind: string;
  text: string;
  usdLabel: string;
  usdValue: number | null;
  color: string;
}

export interface DeskHqFeatured {
  symbol: string;
  entry: string;
  current: string;
  pnlUsd: string;
  pnlPct: string;
  pnlValue: number | null;
  status: string;
  chain: string;
}

export interface DeskHqView {
  hasSnapshot: boolean;
  stale: boolean;
  refreshFailed: boolean;
  ageLabel: string;
  title: string;
  showShadow: boolean;
  showPaper: boolean;
  modeLabel: string;
  dayLabel: string;
  uptimeLabel: string;
  clockLabel: string;
  bankLabel: string;
  bankHint: string;
  pnlLabel: string;
  pnlValue: number | null;
  pnlPctLabel: string;
  openLabel: string;
  winLabel: string;
  tradesLabel: string;
  history: DeskHqHistoryPoint[];
  historyTruncated: boolean;
  activity: DeskHqActivityView[];
  activityTotal: number;
  seats: DeskHqSeatView[];
  selectedSeat: string | null;
  featured: DeskHqFeatured | null;
  cycleLabel: string;
  cycleReason: string;
  seatCountLabel: string;
}

const HISTORY_LIMIT = 400;
const ACTIVITY_LIMIT = 80;

export function deskTotalPnl(totals: TradingDeskTotals): number | null {
  if (totals.realized_usd == null || totals.unrealized_usd == null) return null;
  return totals.realized_usd + totals.unrealized_usd;
}

/** Percent vs paper bank before this snapshot's realized + unrealized P&L. */
export function deskPnlPercent(totals: TradingDeskTotals): number | null {
  const total = deskTotalPnl(totals);
  const bank = totals.paper_bank_usd;
  if (total == null || bank == null) return null;
  const initial = bank - total;
  if (!Number.isFinite(initial) || initial === 0) return null;
  return (total / initial) * 100;
}

export function deskRunClock(startedAt: string, updatedAt: string): { day: number | null; uptimeMs: number | null } {
  const start = Date.parse(startedAt);
  const end = Date.parse(updatedAt);
  if (!startedAt || !updatedAt || !Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return { day: null, uptimeMs: null };
  }
  const uptimeMs = end - start;
  return { day: Math.floor(uptimeMs / 86_400_000) + 1, uptimeMs };
}

function runLabel(status: string, inSnapshot: boolean): string {
  if (!inSnapshot) return DASH;
  if (status === 'ok') return 'RUN';
  if (status === 'idle') return 'IDLE';
  if (status === 'warn') return 'WARN';
  if (status === 'error') return 'ERROR';
  return status ? status.toUpperCase() : DASH;
}

function featuredPosition(positions: TradingDeskPosition[]): TradingDeskPosition | null {
  if (positions.length === 0) return null;
  const open = positions.filter((row) => row.status === 'open');
  const pool = open.length > 0 ? open : positions;
  return [...pool].sort((a, b) => {
    const aTime = Date.parse(a.opened_at);
    const bTime = Date.parse(b.opened_at);
    return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
  })[0] ?? null;
}

function historyPoints(status: TradingDeskStatus): { points: DeskHqHistoryPoint[]; truncated: boolean } {
  const parsed = status.history.flatMap((point) => {
    const at = Date.parse(point.at);
    if (!Number.isFinite(at) || point.bank_usd == null) return [];
    return [{ at, bank: point.bank_usd }];
  });
  parsed.sort((a, b) => a.at - b.at);
  const truncated = parsed.length > HISTORY_LIMIT;
  return { points: truncated ? parsed.slice(parsed.length - HISTORY_LIMIT) : parsed, truncated };
}

function emptyView(stale: boolean, refreshFailed: boolean): DeskHqView {
  return {
    hasSnapshot: false,
    stale,
    refreshFailed,
    ageLabel: 'unknown',
    title: 'Desk HQ',
    showShadow: false,
    showPaper: true,
    modeLabel: '',
    dayLabel: DASH,
    uptimeLabel: DASH,
    clockLabel: '',
    bankLabel: DASH,
    bankHint: DASH,
    pnlLabel: DASH,
    pnlValue: null,
    pnlPctLabel: DASH,
    openLabel: DASH,
    winLabel: DASH,
    tradesLabel: DASH,
    history: [],
    historyTruncated: false,
    activity: [],
    activityTotal: 0,
    seats: seatViews(null),
    selectedSeat: 'SCAN',
    featured: null,
    cycleLabel: '',
    cycleReason: '',
    seatCountLabel: DASH,
  };
}

function seatViews(status: TradingDeskStatus | null): DeskHqSeatView[] {
  const byName = new Map((status?.seats ?? []).map((seat) => [seat.name.toUpperCase(), seat]));
  const used = new Set<string>();
  const rows: DeskHqSeatView[] = ROSTER.map((slot, index) => {
    const found = byName.get(slot.name);
    used.add(slot.name);
    const statusName = found?.status ?? '';
    return {
      name: slot.name,
      role: slot.role,
      number: String(index + 1).padStart(2, '0'),
      status: statusName,
      runLabel: runLabel(statusName, !!found),
      note: found?.note ?? '',
      color: seatColor(slot.name),
      working: statusName === 'ok' || statusName === 'warn',
      inSnapshot: !!found,
    };
  });
  for (const seat of status?.seats ?? []) {
    const key = seat.name.toUpperCase();
    if (used.has(key)) continue;
    used.add(key);
    rows.push({
      name: seat.name,
      role: seat.name,
      number: String(rows.length + 1).padStart(2, '0'),
      status: seat.status,
      runLabel: runLabel(seat.status, true),
      note: seat.note,
      color: seatColor(seat.name),
      working: seat.status === 'ok' || seat.status === 'warn',
      inSnapshot: true,
    });
  }
  return rows;
}

function selectedSeat(status: TradingDeskStatus, seats: DeskHqSeatView[]): string | null {
  const latest = [...status.activity]
    .filter((row) => row.seat && Number.isFinite(Date.parse(row.at)))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0];
  if (latest) {
    const match = seats.find((seat) => seat.name.toUpperCase() === latest.seat.toUpperCase());
    if (match && (match.status === 'ok' || match.status === 'warn')) return match.name;
  }
  return seats.find((seat) => seat.status === 'ok')?.name
    ?? seats.find((seat) => seat.inSnapshot)?.name
    ?? seats[0]?.name
    ?? null;
}

export function buildDeskHqView(
  status: TradingDeskStatus | null,
  options: { stale: boolean; refreshFailed: boolean; now?: number },
): DeskHqView {
  if (!status) return emptyView(options.stale, options.refreshFailed);
  const now = options.now ?? Date.now();
  const clock = deskRunClock(status.started_at, status.updated_at);
  const total = deskTotalPnl(status.totals);
  const pct = deskPnlPercent(status.totals);
  const openCount = status.positions.filter((row) => row.status === 'open').length;
  const history = historyPoints(status);
  const firstBank = history.points[0]?.bank ?? null;
  const activitySorted = [...status.activity].sort((a, b) => {
    const aTime = Date.parse(a.at);
    const bTime = Date.parse(b.at);
    return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
  });
  const seats = seatViews(status);
  const featured = featuredPosition(status.positions);
  const cycle = status.last_cycle;
  const cycleBits = cycle
    ? [
      cycle.outcome || DASH,
      cycle.universe == null ? null : `${cycle.universe} scanned`,
      cycle.survivors == null ? null : `${cycle.survivors} survivors`,
    ].filter((part): part is string => !!part)
    : [];
  return {
    hasSnapshot: true,
    stale: options.stale,
    refreshFailed: options.refreshFailed,
    ageLabel: formatTradingDeskAge(status.updated_at, now),
    title: status.name || 'Desk HQ',
    showShadow: status.mode === 'shadow',
    showPaper: status.mode === 'shadow' || status.mode === 'paper' || status.mode === 'unknown',
    modeLabel: status.mode === 'shadow' || status.mode === 'paper' ? '' : status.mode.toUpperCase(),
    dayLabel: clock.day == null ? DASH : String(clock.day),
    uptimeLabel: formatDeskDuration(clock.uptimeMs),
    clockLabel: formatDeskClock(status.updated_at),
    bankLabel: formatDeskUsd(status.totals.paper_bank_usd),
    bankHint: firstBank == null ? DASH : `start ${formatDeskUsd(firstBank)}`,
    pnlLabel: formatDeskUsd(total, true),
    pnlValue: total,
    pnlPctLabel: formatDeskSignedPct(pct),
    openLabel: String(openCount),
    winLabel: formatDeskWinRate(status.totals.win_rate),
    tradesLabel: status.totals.trades == null
      ? DASH
      : `${Math.round(status.totals.trades)} ${Math.round(status.totals.trades) === 1 ? 'trade' : 'trades'}`,
    history: history.points,
    historyTruncated: history.truncated,
    activity: activitySorted.slice(0, ACTIVITY_LIMIT).map((row) => ({
      atLabel: formatDeskWhen(row.at),
      seat: row.seat || DASH,
      kind: row.kind || DASH,
      text: row.text.trim(),
      usdLabel: formatDeskUsd(row.usd, true),
      usdValue: row.usd,
      color: kindColor(row.kind),
    })),
    activityTotal: activitySorted.length,
    seats,
    selectedSeat: selectedSeat(status, seats),
    featured: featured
      ? {
        symbol: featured.symbol,
        entry: formatDeskPrice(featured.entry_price),
        current: formatDeskPrice(featured.current_price),
        pnlUsd: formatDeskUsd(featured.pnl_usd_after_fees, true),
        pnlPct: formatDeskSignedPct(featured.pnl_pct),
        pnlValue: featured.pnl_usd_after_fees,
        status: featured.status || DASH,
        chain: featured.chain || DASH,
      }
      : null,
    cycleLabel: cycleBits.join(' · '),
    cycleReason: cycle?.reason ?? '',
    seatCountLabel: String(status.seats.length),
  };
}
