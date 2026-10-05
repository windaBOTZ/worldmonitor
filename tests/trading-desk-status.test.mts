import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  formatTradingDeskAge,
  isTradingDeskStale,
  parseTradingDeskStatus,
} from '../src/services/trading-desk.ts';
import { TRADING_DESK_STALE_AFTER_MS } from '../src/config/trading-desk.ts';
import { buildDeskHqView, deskPnlPercent, deskTotalPnl } from '../src/desk-hq/view.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sample = JSON.parse(readFileSync(resolve(root, 'desk/status.json'), 'utf8')) as unknown;

describe('trading desk status', () => {
  it('parses the committed example file', () => {
    const status = parseTradingDeskStatus(sample);
    assert.ok(status);
    assert.equal(status.mode, 'shadow');
    assert.equal(status.updated_at, '2026-10-04T22:40:00.000Z');
    assert.deepEqual(
      status.seats.map((seat) => seat.name),
      ['SCAN', 'VET', 'SOCIAL', 'CHIEF', 'SIZE', 'FILLS', 'RISK', 'COORDINATOR'],
    );
    assert.equal(status.seats[2]?.status, 'warn');
    assert.equal(status.last_cycle?.outcome, 'pick');
    assert.equal(status.last_cycle?.universe, 42);
    assert.equal(status.positions.length, 3);
    assert.equal(status.positions[0]?.symbol, 'BONK');
    assert.equal(status.positions[0]?.pnl_usd_after_fees, 37.42);
    assert.equal(status.positions[2]?.status, 'closed');
    assert.equal(status.totals.paper_bank_usd, 10000);
    assert.equal(status.totals.win_rate, 0.333);
    assert.equal(status.started_at, '2026-10-01T00:00:00.000Z');
    assert.equal(status.history.length, 5);
    assert.equal(status.history[4]?.bank_usd, 10000);
    assert.equal(status.activity.length, 5);
    assert.equal(status.activity[0]?.kind, 'FILL');
    assert.equal(status.activity[1]?.usd, null);
  });

  it('rejects payloads that cannot show an age', () => {
    assert.equal(parseTradingDeskStatus(null), null);
    assert.equal(parseTradingDeskStatus([]), null);
    assert.equal(parseTradingDeskStatus({ mode: 'shadow', seats: [] }), null);
    assert.equal(parseTradingDeskStatus('desk'), null);
  });

  it('keeps a partial snapshot and drops unnamed rows', () => {
    const status = parseTradingDeskStatus({
      updated_at: '2026-10-04T22:40:00.000Z',
      seats: [{ status: 'ok' }, { name: 'RISK', status: 'ERROR', note: 12 }],
      positions: [{ chain: 'solana' }, { symbol: 'BONK', pnl_pct: '15.5', status: 'open' }],
      totals: { trades: '4' },
    });
    assert.ok(status);
    assert.equal(status.mode, 'unknown');
    assert.equal(status.seats.length, 1);
    assert.equal(status.seats[0]?.status, 'error');
    assert.equal(status.seats[0]?.note, '');
    assert.equal(status.positions.length, 1);
    assert.equal(status.positions[0]?.pnl_pct, 15.5);
    assert.equal(status.totals.trades, 4);
    assert.equal(status.totals.paper_bank_usd, null);
    assert.equal(status.last_cycle, null);
    assert.deepEqual(status.history, []);
    assert.deepEqual(status.activity, []);
    assert.equal(status.name, '');
    assert.equal(status.started_at, '');
  });

  it('keeps an older snapshot without history and does not treat a missing pnl side as zero', () => {
    const status = parseTradingDeskStatus({
      updated_at: '2026-10-05T00:00:07.787Z',
      mode: 'shadow',
      seats: [{ name: 'SCAN', status: 'ok', note: '62 names' }],
      positions: [{ symbol: 'SWAP', status: 'open', pnl_usd_after_fees: -5.16 }],
      totals: { paper_bank_usd: 1000, realized_usd: 0, unrealized_usd: -5.16, win_rate: null },
    });
    assert.ok(status);
    assert.equal(status.history.length, 0);
    assert.equal(status.totals.win_rate, null);
    assert.equal(deskTotalPnl(status.totals), -5.16);
    assert.equal(deskTotalPnl({ ...status.totals, unrealized_usd: null }), null);
    const view = buildDeskHqView(status, { stale: false, refreshFailed: false, now: Date.parse(status.updated_at) });
    assert.equal(view.dayLabel, '—');
    assert.equal(view.uptimeLabel, '—');
    assert.equal(view.winLabel, '—');
    assert.equal(view.openLabel, '1');
    assert.equal(view.history.length, 0);
    assert.equal(view.activityTotal, 0);
    assert.equal(view.featured?.symbol, 'SWAP');
    assert.equal(view.showShadow, true);
    const missing = buildDeskHqView(null, { stale: false, refreshFailed: true });
    assert.equal(missing.hasSnapshot, false);
    assert.equal(missing.bankLabel, '—');
    assert.equal(missing.pnlLabel, '—');
    assert.equal(deskPnlPercent(status.totals) != null, true);
  });

  it('marks a snapshot stale after the desk freshness window', () => {
    const status = parseTradingDeskStatus(sample);
    assert.ok(status);
    const updatedAt = Date.parse(status.updated_at);
    assert.equal(isTradingDeskStale(status, updatedAt + TRADING_DESK_STALE_AFTER_MS), false);
    assert.equal(isTradingDeskStale(status, updatedAt + TRADING_DESK_STALE_AFTER_MS + 1), true);
    assert.equal(formatTradingDeskAge(status.updated_at, updatedAt + 50_000), 'just now');
    assert.equal(formatTradingDeskAge(status.updated_at, updatedAt + 5 * 60_000), '5m ago');
    assert.equal(formatTradingDeskAge('not-a-date'), 'unknown');
    assert.equal(formatTradingDeskAge(null), 'unknown');
  });
});
