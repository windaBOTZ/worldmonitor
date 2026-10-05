import type { DeskHqSeatView } from '@/desk-hq/view';

export const OFFICE_LOGICAL = { w: 320, h: 180 };

export const OFFICE_SCREEN = { x: 86, y: 18, w: 124, h: 54 };

export interface OfficeSlot {
  name: string;
  x: number;
  y: number;
  scale: number;
}

export const OFFICE_SLOTS: OfficeSlot[] = [
  { name: 'SCAN', x: 36, y: 112, scale: 1 },
  { name: 'VET', x: 78, y: 114, scale: 1 },
  { name: 'SOCIAL', x: 120, y: 112, scale: 1 },
  { name: 'CHIEF', x: 162, y: 116, scale: 1 },
  { name: 'SIZE', x: 58, y: 150, scale: 1 },
  { name: 'FILLS', x: 108, y: 152, scale: 1 },
  { name: 'RISK', x: 158, y: 150, scale: 1 },
  { name: 'COORDINATOR', x: 268, y: 132, scale: 1.25 },
];

interface OfficeFrame {
  seats: DeskHqSeatView[];
  selected: string | null;
  clockLabel: string;
}

function slotFor(name: string): OfficeSlot | undefined {
  return OFFICE_SLOTS.find((slot) => slot.name === name);
}

function px(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function drawBlob(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, status: string, scale: number): void {
  const r = 6 * scale;
  px(ctx, x - 5 * scale, y + 6 * scale, 4 * scale, 3 * scale, '#14120f');
  px(ctx, x + 2 * scale, y + 6 * scale, 4 * scale, 3 * scale, '#14120f');
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  px(ctx, x - 3 * scale, y - 3 * scale, 2 * scale, 2 * scale, 'rgba(255,255,255,0.4)');
  const eye = status === 'error' ? 1 : 2;
  px(ctx, x - 3 * scale, y - 1 * scale, 2 * scale, eye * scale, '#14120f');
  px(ctx, x + 1 * scale, y - 1 * scale, 2 * scale, eye * scale, '#14120f');
}

function drawDesk(
  ctx: CanvasRenderingContext2D,
  slot: OfficeSlot,
  seat: DeskHqSeatView | undefined,
  selected: boolean,
  time: number,
): void {
  const { x, y, scale } = slot;
  const status = seat?.status || '';
  const working = !!seat?.working;
  const bob = working && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? Math.sin(time / 220 + x) * 1.4
    : 0;
  if (selected) {
    ctx.strokeStyle = seat?.color ?? '#e0a15a';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 18 * scale, y - 22, 40 * scale, 46);
  }
  px(ctx, x - 12, y + 10, 28, 5, '#0c0b09');
  px(ctx, x - 16, y + 2, 34, 10, '#6a5132');
  px(ctx, x - 16, y + 2, 34, 3, '#8d6b40');
  px(ctx, x - 14, y + 12, 3, 8, '#3a2c1c');
  px(ctx, x + 14, y + 12, 3, 8, '#3a2c1c');
  px(ctx, x - 7, y - 12, 16, 12, '#22262e');
  const screen = status === 'ok' ? '#123d2a' : status === 'warn' ? '#3a3014' : status === 'error' ? '#3d1618' : '#12141a';
  px(ctx, x - 5, y - 10, 12, 8, screen);
  if (working) {
    const bar = Math.floor(time / 180) % 3;
    px(ctx, x - 4 + bar * 3, y - 8, 2, 4, status === 'warn' ? '#e0a15a' : '#3dd68c');
  }
  drawBlob(ctx, x + 1, y - 1 + bob, seat?.color ?? '#6d675f', status, scale);
  ctx.fillStyle = '#c8c0b0';
  ctx.font = '6px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(slot.name.slice(0, 4), x + 1, y + 26);
}

function drawRoom(ctx: CanvasRenderingContext2D, clockLabel: string): void {
  const { w, h } = OFFICE_LOGICAL;
  px(ctx, 0, 0, w, 96, '#12141c');
  px(ctx, 0, 96, w, h - 96, '#1a1712');
  ctx.strokeStyle = '#2a261e';
  ctx.lineWidth = 1;
  for (let x = 8; x < w; x += 18) {
    ctx.beginPath();
    ctx.moveTo(x, 96);
    ctx.lineTo(x - 24, h);
    ctx.stroke();
  }
  px(ctx, 0, 94, w, 3, '#3a3228');

  px(ctx, 14, 28, 18, 18, '#e0a15a');
  px(ctx, 18, 32, 10, 10, '#14120f');
  px(ctx, 22, 36, 2, 2, '#e0a15a');
  px(ctx, 16, 78, 4, 14, '#5c4630');
  px(ctx, 10, 66, 16, 12, '#1f6b45');
  px(ctx, 12, 58, 12, 10, '#2f8a58');

  px(ctx, 236, 28, 22, 40, '#2a241c');
  const spines = ['#e0a15a', '#3dd68c', '#6aa7ff', '#ff7ab2', '#ff5d6c'];
  spines.forEach((color, index) => px(ctx, 238 + index * 4, 32, 3, 32, color));

  if (clockLabel) {
    px(ctx, 268, 24, 36, 16, '#10140f');
    ctx.strokeStyle = '#3dd68c';
    ctx.strokeRect(268, 24, 36, 16);
    ctx.fillStyle = '#3dd68c';
    ctx.font = '8px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(clockLabel, 286, 35);
  }

  const screen = OFFICE_SCREEN;
  px(ctx, screen.x - 4, screen.y - 4, screen.w + 8, screen.h + 10, '#3a3226');
  px(ctx, screen.x, screen.y, screen.w, screen.h, '#07140e');
  ctx.fillStyle = 'rgba(61,214,140,0.08)';
  for (let y = screen.y + 2; y < screen.y + screen.h; y += 4) {
    ctx.fillRect(screen.x, y, screen.w, 1);
  }
}

export function startOffice(
  canvas: HTMLCanvasElement,
  read: () => OfficeFrame,
): () => void {
  const ratio = 2;
  canvas.width = OFFICE_LOGICAL.w * ratio;
  canvas.height = OFFICE_LOGICAL.h * ratio;
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};
  let frame = 0;
  let stopped = false;

  const draw = (time: number) => {
    if (stopped) return;
    frame = requestAnimationFrame(draw);
    const model = read();
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.imageSmoothingEnabled = false;
    drawRoom(ctx, model.clockLabel);
    const byName = new Map(model.seats.map((seat) => [seat.name.toUpperCase(), seat]));
    for (const slot of OFFICE_SLOTS) {
      const seat = byName.get(slot.name);
      drawDesk(ctx, slot, seat, model.selected?.toUpperCase() === slot.name, time);
    }
  };
  frame = requestAnimationFrame(draw);
  return () => {
    stopped = true;
    cancelAnimationFrame(frame);
  };
}

export function bubbleAnchor(name: string): { left: string; top: string } | null {
  const slot = slotFor(name);
  if (!slot) return null;
  return {
    left: `${(slot.x / OFFICE_LOGICAL.w) * 100}%`,
    top: `${((slot.y - 28) / OFFICE_LOGICAL.h) * 100}%`,
  };
}
