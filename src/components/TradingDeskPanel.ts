import { Panel } from './Panel';
import { joinSafeHtml, safeHtml } from '@/utils/sanitize';
import type { SafeHtml } from '@/utils/sanitize';
import {
  formatTradingDeskAge,
  isTradingDeskStale,
  loadTradingDeskStatus,
  type TradingDeskPosition,
  type TradingDeskStatus,
} from '@/services/trading-desk';

const SEAT_STATUSES = new Set(['ok', 'idle', 'warn', 'error']);

function seatClass(status: string): string {
  return SEAT_STATUSES.has(status) ? status : 'idle';
}

function pnlClass(value: number | null): string {
  if (value == null || value === 0) return 'change-neutral';
  return value > 0 ? 'change-positive' : 'change-negative';
}

function formatSigned(value: number | null, digits: number, suffix = ''): string {
  if (value == null) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}${suffix}`;
}

function formatPrice(value: number | null): string {
  if (value == null) return '—';
  const abs = Math.abs(value);
  if (abs === 0) return '0';
  if (abs >= 1000) return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (abs >= 1) return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return value.toPrecision(4);
}

function formatUsd(value: number | null, signed = false): string {
  if (value == null) return '—';
  const formatted = Math.abs(value).toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  });
  if (!signed) return value < 0 ? `-${formatted}` : formatted;
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return formatted;
}

function formatWinRate(value: number | null): string {
  if (value == null) return '—';
  const pct = Math.abs(value) <= 1 ? value * 100 : value;
  return `${pct.toFixed(1)}%`;
}

function formatWhen(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value || '—';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

function shortAddress(address: string): string {
  if (!address) return '';
  if (address.length <= 14) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function outcomeClass(outcome: string): string {
  if (outcome === 'pick' || outcome === 'no_trade' || outcome === 'aborted') return outcome;
  return 'unknown';
}

function outcomeLabel(outcome: string): string {
  if (outcome === 'pick') return 'Pick';
  if (outcome === 'no_trade') return 'No trade';
  if (outcome === 'aborted') return 'Aborted';
  return outcome || '—';
}

function comparePositions(a: TradingDeskPosition, b: TradingDeskPosition): number {
  const rank = (status: string) => (status === 'open' ? 0 : 1);
  const byStatus = rank(a.status) - rank(b.status);
  if (byStatus !== 0) return byStatus;
  return Math.abs(b.pnl_usd_after_fees ?? 0) - Math.abs(a.pnl_usd_after_fees ?? 0);
}

/**
 * Shadow-mode crypto desk. Reads a status JSON document on a timer and
 * renders the last good snapshot. A missing, unreachable, or unreadable
 * file becomes an empty state instead of an error that takes down the grid.
 */
export class TradingDeskPanel extends Panel {
  private status: TradingDeskStatus | null = null;
  private stale = false;
  private refreshFailed = false;
  private inFlight = false;

  constructor() {
    super({
      id: 'trading-desk',
      title: 'Trading Desk',
      defaultRowSpan: 2,
      className: 'panel-wide',
      infoTooltip: 'Read-only paper-trading desk. Shadow mode does not send real orders. Status is polled from a JSON file about once a minute.',
    });
  }

  public async fetchData(pollSignal?: AbortSignal): Promise<void> {
    if (this.inFlight) return;
    this.inFlight = true;
    const signals = [this.signal, pollSignal].filter((signal): signal is AbortSignal => !!signal);
    const signal = signals.length > 1 ? AbortSignal.any(signals) : signals[0];
    try {
      const result = await loadTradingDeskStatus(signal);
      if (!this.element?.isConnected) return;
      if (result.ok) {
        this.status = result.status;
        this.stale = result.stale;
        this.refreshFailed = false;
      } else {
        this.refreshFailed = true;
        this.stale = this.status ? isTradingDeskStale(this.status) : false;
      }
      this.renderDesk();
    } catch (error) {
      if (this.isAbortError(error)) return;
      if (!this.element?.isConnected) return;
      this.refreshFailed = true;
      this.renderDesk();
    } finally {
      this.inFlight = false;
    }
  }

  private renderDesk(): void {
    if (!this.status) {
      this.setSafeContent(this.renderEmpty());
      return;
    }
    const status = this.status;
    const age = formatTradingDeskAge(status.updated_at);
    const chains = [...new Set(status.positions.map((row) => row.chain.trim()).filter(Boolean))];
    this.setSafeContent(safeHtml`
      <div class="td-desk" data-trading-desk="ready">
        ${this.renderHeader(status, age)}
        ${this.renderSeats(status)}
        ${this.renderCycle(status)}
        ${this.renderPositions(status)}
        ${chains.length > 0 ? this.renderChains(chains) : safeHtml``}
        ${this.renderTotals(status)}
      </div>
    `);
  }

  private renderEmpty(): SafeHtml {
    const age = this.status ? formatTradingDeskAge(this.status.updated_at) : 'unknown';
    return safeHtml`
      <div class="td-empty" data-trading-desk="empty">
        <div class="td-empty-title">No desk data yet</div>
        <div class="td-empty-age">Last updated: ${age}</div>
      </div>
    `;
  }

  private renderHeader(status: TradingDeskStatus, age: string): SafeHtml {
    const modeClass = status.mode === 'shadow' ? 'td-mode-shadow' : 'td-mode-other';
    const modeLabel = status.mode === 'shadow' ? 'Shadow' : status.mode;
    const staleNote = this.stale ? safeHtml`<span class="td-stale">Stale</span>` : safeHtml``;
    const refreshNote = this.refreshFailed
      ? safeHtml`<span class="td-refresh-failed">Refresh failed</span>`
      : safeHtml``;
    return safeHtml`
      <div class="td-header">
        <span class="td-mode ${modeClass}">${modeLabel}</span>
        ${staleNote}
        ${refreshNote}
        <span class="td-updated">Last updated: ${age}</span>
      </div>
    `;
  }

  private renderSeats(status: TradingDeskStatus): SafeHtml {
    if (status.seats.length === 0) {
      return safeHtml`<div class="td-section td-muted">No seat status in this snapshot.</div>`;
    }
    const chips = joinSafeHtml(status.seats.map((seat) => safeHtml`
      <span class="td-seat td-seat-${seatClass(seat.status)}" title="${seat.note}">
        <span class="td-seat-name">${seat.name}</span>
        <span class="td-seat-status">${seat.status}</span>
      </span>
    `));
    return safeHtml`<div class="td-seats">${chips}</div>`;
  }

  private renderCycle(status: TradingDeskStatus): SafeHtml {
    const cycle = status.last_cycle;
    if (!cycle) {
      return safeHtml`<div class="td-section td-muted">No cycle recorded.</div>`;
    }
    const counts = cycle.universe == null && cycle.survivors == null
      ? '—'
      : `${cycle.universe ?? '—'} scanned · ${cycle.survivors ?? '—'} survivors`;
    return safeHtml`
      <div class="td-cycle">
        <div class="td-section-label">Last cycle</div>
        <div class="td-cycle-row">
          <span class="td-outcome td-outcome-${outcomeClass(cycle.outcome)}">${outcomeLabel(cycle.outcome)}</span>
          <span class="td-cycle-when">${formatWhen(cycle.at)}</span>
          <span class="td-cycle-counts">${counts}</span>
        </div>
        ${cycle.reason ? safeHtml`<div class="td-cycle-reason">${cycle.reason}</div>` : safeHtml``}
      </div>
    `;
  }

  private renderPositions(status: TradingDeskStatus): SafeHtml {
    if (status.positions.length === 0) {
      return safeHtml`<div class="td-section td-muted">No paper positions in this snapshot.</div>`;
    }
    const rows = joinSafeHtml([...status.positions].sort(comparePositions).map((row) => {
      const closed = row.status === 'closed' ? ' td-closed' : '';
      const address = shortAddress(row.address);
      return safeHtml`
        <tr class="${closed.trim()}">
          <td class="td-symbol">
            <span class="td-symbol-name">${row.symbol}</span>
            ${address ? safeHtml`<span class="td-address" title="${row.address}">${address}</span>` : safeHtml``}
          </td>
          <td>${row.chain || '—'}</td>
          <td class="td-pos-status">${row.status}</td>
          <td class="td-num">${formatPrice(row.entry_price)}</td>
          <td class="td-num">${formatPrice(row.current_price)}</td>
          <td class="td-num">${formatUsd(row.ticket_usd)}</td>
          <td class="td-num ${pnlClass(row.pnl_pct)}">${formatSigned(row.pnl_pct, 2, '%')}</td>
          <td class="td-num ${pnlClass(row.pnl_usd_after_fees)}">${formatUsd(row.pnl_usd_after_fees, true)}</td>
          <td class="td-when">${formatWhen(row.opened_at)}</td>
        </tr>
      `;
    }));
    return safeHtml`
      <div class="td-table-wrap">
        <table class="td-table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Chain</th>
              <th>Status</th>
              <th>Entry</th>
              <th>Last</th>
              <th>Ticket</th>
              <th>P&amp;L %</th>
              <th>P&amp;L $</th>
              <th>Opened</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  private renderChains(chains: string[]): SafeHtml {
    const chips = joinSafeHtml(chains.map((chain) => safeHtml`<span class="td-chain">${chain}</span>`));
    return safeHtml`<div class="td-chains"><span class="td-section-label">Chains</span>${chips}</div>`;
  }

  private renderTotals(status: TradingDeskStatus): SafeHtml {
    const totals = status.totals;
    const cells: Array<[string, string, string]> = [
      ['Paper bank', formatUsd(totals.paper_bank_usd), ''],
      ['Realized', formatUsd(totals.realized_usd, true), pnlClass(totals.realized_usd)],
      ['Unrealized', formatUsd(totals.unrealized_usd, true), pnlClass(totals.unrealized_usd)],
      ['Trades', totals.trades == null ? '—' : String(Math.round(totals.trades)), ''],
      ['Win rate', formatWinRate(totals.win_rate), ''],
    ];
    const markup = joinSafeHtml(cells.map(([label, value, tone]) => safeHtml`
      <div class="td-total">
        <span class="td-total-label">${label}</span>
        <span class="td-total-value ${tone}">${value}</span>
      </div>
    `));
    return safeHtml`<div class="td-totals">${markup}</div>`;
  }
}
