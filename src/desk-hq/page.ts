import { drawBalanceChart } from '@/desk-hq/chart';
import { drawSectorMap, MAP_SECTORS } from '@/desk-hq/maps';
import { bubbleAnchor, OFFICE_SCREEN, OFFICE_LOGICAL, startOffice } from '@/desk-hq/office';
import type { DeskHqSeatView, DeskHqView } from '@/desk-hq/view';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function toneClass(value: number | null): string {
  if (value == null || value === 0) return '';
  return value > 0 ? 'is-up' : 'is-down';
}

function statCard(label: string, value: string, hint: string, tone: number | null): HTMLElement {
  const card = el('section', `hq-stat ${toneClass(tone)}`.trim());
  card.append(el('h2', 'hq-kicker', label), el('p', 'hq-stat-value', value), el('p', 'hq-stat-hint', hint));
  return card;
}

function seatCard(seat: DeskHqSeatView, selected: boolean): HTMLButtonElement {
  const button = el('button', `hq-seat-card${selected ? ' is-selected' : ''}${seat.working ? ' is-working' : ''}`);
  button.type = 'button';
  button.dataset.seat = seat.name;
  button.style.setProperty('--seat', seat.color);
  button.title = seat.note || seat.name;
  const icon = el('span', 'hq-seat-icon');
  icon.setAttribute('aria-hidden', 'true');
  button.append(
    icon,
    el('span', 'hq-seat-num', seat.number),
    el('span', 'hq-seat-role', seat.role),
    el('span', 'hq-seat-name', seat.name),
    el('span', `hq-seat-state state-${seat.runLabel.toLowerCase()}`, seat.runLabel),
    el('span', 'hq-seat-note', seat.note),
  );
  return button;
}

function applySelection(root: HTMLElement, name: string | null, seats: DeskHqSeatView[]): void {
  root.querySelectorAll<HTMLButtonElement>('.hq-seat-card').forEach((button) => {
    button.classList.toggle('is-selected', button.dataset.seat === name);
  });
  const bubble = root.querySelector<HTMLElement>('.hq-bubble');
  const seat = seats.find((item) => item.name === name);
  if (!bubble) return;
  if (!seat?.note || !name) {
    bubble.hidden = true;
    return;
  }
  const anchor = bubbleAnchor(name);
  if (!anchor) {
    bubble.hidden = true;
    return;
  }
  bubble.hidden = false;
  bubble.style.left = anchor.left;
  bubble.style.top = anchor.top;
  bubble.textContent = seat.note;
}

export function renderDeskHq(root: HTMLElement, view: DeskHqView): () => void {
  root.replaceChildren();
  const page = el('div', 'hq');
  page.dataset.deskState = view.hasSnapshot ? 'ready' : 'empty';

  const header = el('header', 'hq-top');
  const brand = el('div', 'hq-brand');
  const mark = el('span', 'hq-mark');
  mark.setAttribute('aria-hidden', 'true');
  const titles = el('div');
  titles.append(el('p', 'hq-kicker', 'Paper trading floor'), el('h1', 'hq-title', view.title));
  brand.append(mark, titles);

  const meta = el('div', 'hq-meta');
  const day = el('div', 'hq-meta-item');
  day.append(el('span', 'hq-meta-label', 'Day'), el('span', 'hq-meta-value', view.dayLabel));
  const uptime = el('div', 'hq-meta-item');
  uptime.append(el('span', 'hq-meta-label', 'Uptime'), el('span', 'hq-meta-value', view.uptimeLabel));
  const updated = el('div', 'hq-meta-item');
  updated.append(el('span', 'hq-meta-label', 'Updated'), el('span', 'hq-meta-value', view.ageLabel));
  meta.append(day, uptime, updated);
  if (view.showShadow) meta.append(el('span', 'hq-badge hq-badge-shadow', 'Shadow'));
  if (view.showPaper) meta.append(el('span', 'hq-badge', 'Paper'));
  if (view.modeLabel) meta.append(el('span', 'hq-badge', view.modeLabel));
  if (view.stale) meta.append(el('span', 'hq-badge hq-badge-stale', 'Stale'));
  if (view.refreshFailed) meta.append(el('span', 'hq-badge hq-badge-fail', 'Refresh failed'));
  header.append(brand, meta);

  const banner = el('p', 'hq-banner');
  banner.hidden = view.hasSnapshot;
  banner.textContent = `No desk data yet. Last updated: ${view.ageLabel}`;

  const stats = el('section', 'hq-stats');
  stats.append(
    statCard('Paper bank', view.bankLabel, view.bankHint, null),
    statCard('Total P&L', view.pnlLabel, view.pnlPctLabel, view.pnlValue),
    statCard('Open positions', view.openLabel, view.hasSnapshot ? 'in snapshot' : '—', null),
    statCard('Win rate', view.winLabel, view.tradesLabel, null),
  );

  const split = el('div', 'hq-split');
  const chartPanel = el('section', 'hq-panel');
  chartPanel.append(el('h2', 'hq-kicker', 'Balance history'));
  const chartCanvas = el('canvas', 'hq-chart');
  chartCanvas.setAttribute('role', 'img');
  chartCanvas.setAttribute('aria-label', view.history.length > 0 ? 'Paper bank history' : 'No balance history yet');
  const chartEmpty = el('p', 'hq-empty', 'No balance history yet');
  chartEmpty.hidden = view.history.length > 0;
  chartCanvas.hidden = view.history.length === 0;
  chartPanel.append(chartCanvas, chartEmpty);
  if (view.historyTruncated) chartPanel.append(el('p', 'hq-footnote', 'Showing the latest 400 points'));

  const activityPanel = el('section', 'hq-panel');
  const activityHead = el('div', 'hq-panel-head');
  activityHead.append(
    el('h2', 'hq-kicker', 'Activity log'),
    el('span', 'hq-count', view.hasSnapshot ? `${view.activityTotal} in snapshot` : '—'),
  );
  const activityList = el('ol', 'hq-activity');
  if (view.activity.length === 0) {
    activityList.append(el('li', 'hq-empty', 'No activity in this snapshot'));
  } else {
    for (const row of view.activity) {
      const item = el('li', 'hq-activity-row');
      const tag = el('span', 'hq-tag', row.seat);
      tag.style.color = row.color;
      const kind = el('span', 'hq-kind', row.kind);
      const text = el('span', 'hq-activity-text', row.text || '—');
      const usd = el('span', `hq-activity-usd ${toneClass(row.usdValue)}`.trim(), row.usdLabel);
      const when = el('time', 'hq-activity-when', row.atLabel);
      item.append(tag, kind, text, usd, when);
      activityList.append(item);
    }
  }
  activityPanel.append(activityHead, activityList);
  if (view.activityTotal > view.activity.length) {
    activityPanel.append(el('p', 'hq-footnote', `Showing the latest ${view.activity.length}`));
  }
  split.append(chartPanel, activityPanel);

  const maps = el('section', 'hq-panel');
  const mapHead = el('div', 'hq-panel-head');
  mapHead.append(el('h2', 'hq-kicker', 'Global event feed'), el('span', 'hq-count', 'World Monitor · 3 sectors'));
  const mapGrid = el('div', 'hq-maps');
  const mapCanvases: HTMLCanvasElement[] = [];
  for (const sector of MAP_SECTORS) {
    const link = el('a', 'hq-map-link');
    link.href = '/dashboard';
    link.dataset.sector = sector.id;
    const canvas = el('canvas', 'hq-map');
    canvas.setAttribute('aria-hidden', 'true');
    link.append(canvas, el('span', 'hq-map-label', sector.label));
    link.setAttribute('aria-label', `Open the World Monitor map, ${sector.label}`);
    mapCanvases.push(canvas);
    mapGrid.append(link);
  }
  maps.append(mapHead, el('p', 'hq-footnote', 'Map previews link to the live dashboard. They are not a feed of desk trades.'), mapGrid);

  const floor = el('section', 'hq-panel hq-floor');
  const floorHead = el('div', 'hq-panel-head');
  floorHead.append(el('h2', 'hq-kicker', 'Desk floor'), el('span', 'hq-count', view.hasSnapshot ? `${view.seatCountLabel} seats` : '— seats'));
  const stage = el('div', 'hq-stage');
  const office = el('canvas', 'hq-office');
  office.setAttribute('role', 'img');
  office.setAttribute('aria-label', 'Pixel-art desk floor');
  const screen = el('div', 'hq-screen');
  const screenLeft = (OFFICE_SCREEN.x / OFFICE_LOGICAL.w) * 100;
  const screenTop = (OFFICE_SCREEN.y / OFFICE_LOGICAL.h) * 100;
  const screenWidth = (OFFICE_SCREEN.w / OFFICE_LOGICAL.w) * 100;
  const screenHeight = (OFFICE_SCREEN.h / OFFICE_LOGICAL.h) * 100;
  screen.style.left = `${screenLeft}%`;
  screen.style.top = `${screenTop}%`;
  screen.style.width = `${screenWidth}%`;
  screen.style.height = `${screenHeight}%`;
  if (view.featured) {
    const pnl = el('p', `hq-screen-pnl ${toneClass(view.featured.pnlValue)}`.trim());
    pnl.append(el('span', '', view.featured.pnlUsd), document.createTextNode(' '), el('span', '', view.featured.pnlPct));
    screen.append(
      el('p', 'hq-screen-symbol', view.featured.symbol),
      el('p', 'hq-screen-line', `Entry ${view.featured.entry}`),
      el('p', 'hq-screen-line', `Last ${view.featured.current}`),
      pnl,
      el('p', 'hq-screen-line', `${view.featured.status} · ${view.featured.chain}`),
    );
  } else {
    screen.append(el('p', 'hq-screen-symbol', '—'), el('p', 'hq-screen-line', 'No position in this snapshot'));
  }
  const bubble = el('p', 'hq-bubble');
  bubble.hidden = true;
  stage.append(office, screen, bubble);
  floor.append(floorHead, stage);
  if (view.cycleLabel) floor.append(el('p', 'hq-cycle', view.cycleLabel));
  if (view.cycleReason) floor.append(el('p', 'hq-footnote', view.cycleReason));

  const seatRow = el('div', 'hq-seats');
  for (const seat of view.seats) seatRow.append(seatCard(seat, seat.name === view.selectedSeat));

  const back = el('a', 'hq-back', 'World Monitor');
  back.href = '/dashboard';

  page.append(header, banner, stats, split, maps, floor, seatRow, back);
  root.append(page);

  let selected = view.selectedSeat;
  const seats = view.seats;
  applySelection(root, selected, seats);
  seatRow.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('.hq-seat-card');
    if (!button?.dataset.seat) return;
    selected = button.dataset.seat;
    applySelection(root, selected, seats);
  });

  let alive = true;
  let stopOffice = () => {};
  const frame = requestAnimationFrame(() => {
    if (!alive) return;
    if (view.history.length > 0) drawBalanceChart(chartCanvas, view.history);
    MAP_SECTORS.forEach((sector, index) => {
      const canvas = mapCanvases[index];
      if (canvas) drawSectorMap(canvas, sector);
    });
    stopOffice = startOffice(office, () => ({
      seats,
      selected,
      clockLabel: view.clockLabel,
    }));
  });

  return () => {
    alive = false;
    cancelAnimationFrame(frame);
    stopOffice();
  };
}
