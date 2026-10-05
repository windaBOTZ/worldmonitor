export const SEAT_COLORS: Record<string, string> = {
  SCAN: '#3ec6ff',
  VET: '#6aa7ff',
  SOCIAL: '#ff7ab2',
  CHIEF: '#f0c14a',
  SIZE: '#ff9a3c',
  FILLS: '#3dd68c',
  RISK: '#ff5d6c',
  COORDINATOR: '#d7d2c8',
};

export const KIND_COLORS: Record<string, string> = {
  ORDER: '#e0a15a',
  FILL: '#3dd68c',
  RESEARCH: '#6aa7ff',
  SETTLE: '#c084fc',
  KILL: '#ff5d6c',
  PASS: '#8a8478',
};

export function seatColor(name: string): string {
  return SEAT_COLORS[name.toUpperCase()] ?? '#9aa0a6';
}

export function kindColor(kind: string): string {
  return KIND_COLORS[kind.toUpperCase()] ?? '#8a8478';
}
