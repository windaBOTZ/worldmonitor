import type { DeskHqHistoryPoint } from '@/desk-hq/view';
import { formatDeskUsd } from '@/desk-hq/format';

export function drawBalanceChart(canvas: HTMLCanvasElement, points: DeskHqHistoryPoint[]): void {
  const width = Math.max(320, canvas.clientWidth || 640);
  const height = 220;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#07080b';
  ctx.fillRect(0, 0, width, height);
  if (points.length === 0) return;

  const banks = points.map((point) => point.bank);
  const min = Math.min(...banks);
  const max = Math.max(...banks);
  const span = max - min || Math.max(Math.abs(max) * 0.02, 1);
  const padLeft = 8;
  const padRight = 78;
  const padTop = 16;
  const padBottom = 36;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  const xAt = (index: number) => padLeft + (points.length === 1 ? plotW / 2 : (index / (points.length - 1)) * plotW);
  const yAt = (value: number) => padTop + ((max + span * 0.08 - value) / (span * 1.16)) * plotH;
  const rising = points[points.length - 1]!.bank >= points[0]!.bank;
  const tone = rising ? '#3dd68c' : '#ff5d6c';

  if (points.length > 1) {
    const barW = Math.max(2, plotW / points.length - 2);
    for (let index = 1; index < points.length; index += 1) {
      const delta = points[index]!.bank - points[index - 1]!.bank;
      const barH = Math.max(2, (Math.abs(delta) / span) * 28);
      ctx.fillStyle = delta >= 0 ? 'rgba(61,214,140,0.35)' : 'rgba(255,93,108,0.4)';
      ctx.fillRect(xAt(index) - barW / 2, height - 8 - barH, barW, barH);
    }
  }

  ctx.beginPath();
  points.forEach((point, index) => {
    const x = xAt(index);
    const y = yAt(point.bank);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = tone;
  ctx.lineWidth = 2;
  ctx.stroke();

  const last = points[points.length - 1]!;
  const lastX = xAt(points.length - 1);
  const lastY = yAt(last.bank);
  ctx.fillStyle = tone;
  ctx.beginPath();
  ctx.arc(lastX, lastY, 3.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#e6e1d6';
  ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  ctx.textAlign = 'left';
  ctx.fillText(formatDeskUsd(last.bank), Math.min(lastX + 8, width - 74), Math.max(16, lastY + 4));
  ctx.fillStyle = '#8a8478';
  ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  ctx.fillText(formatDeskUsd(min), 8, height - 14);
  ctx.fillText(formatDeskUsd(max), 8, 14);
}
