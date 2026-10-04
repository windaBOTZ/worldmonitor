/**
 * Paper-trading desk status source.
 *
 * The dashboard only reads a JSON document. It never places orders.
 * Leave `VITE_TRADING_DESK_STATUS_URL` unset to use the public sample
 * branch. A non-URL value is ignored so a bad config cannot redirect
 * the panel at an unexpected origin.
 */
export const DEFAULT_TRADING_DESK_STATUS_URL =
  'https://raw.githubusercontent.com/windaBOTZ/worldmonitor/desk-data/desk/status.json';

/** A snapshot older than this is shown with a stale marker. */
export const TRADING_DESK_STALE_AFTER_MS = 15 * 60 * 1000;

export const TRADING_DESK_POLL_MS = 60 * 1000;

function isAbsoluteHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export function tradingDeskStatusUrl(): string {
  let configured: string | undefined;
  try {
    const value = import.meta.env.VITE_TRADING_DESK_STATUS_URL;
    configured = typeof value === 'string' ? value.trim() : undefined;
  } catch {
    configured = undefined;
  }
  if (!configured) return DEFAULT_TRADING_DESK_STATUS_URL;
  return isAbsoluteHttpUrl(configured) ? configured : '';
}
