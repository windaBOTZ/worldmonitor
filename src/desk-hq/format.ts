const DASH = '—';

export function formatDeskUsd(value: number | null, signed = false): string {
  if (value == null || !Number.isFinite(value)) return DASH;
  const formatted = Math.abs(value).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  });
  if (!signed) return value < 0 ? `-${formatted}` : formatted;
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return formatted;
}

export function formatDeskPrice(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return DASH;
  const abs = Math.abs(value);
  if (abs === 0) return '0';
  if (abs >= 1000) return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (abs >= 1) return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return value.toPrecision(4);
}

export function formatDeskWinRate(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return DASH;
  const pct = Math.abs(value) <= 1 ? value * 100 : value;
  return `${pct.toFixed(1)}%`;
}

export function formatDeskSignedPct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return DASH;
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function formatDeskClock(iso: string): string {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return '';
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'UTC',
  }).format(parsed);
}

export function formatDeskWhen(iso: string): string {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return iso || DASH;
  return new Intl.DateTimeFormat('en-GB', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'UTC',
  }).format(parsed);
}

export function formatDeskDuration(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return DASH;
  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes - days * 24 * 60) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
