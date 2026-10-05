import '@/styles/desk-hq.css';
import { TRADING_DESK_POLL_MS } from '@/config/trading-desk';
import {
  isTradingDeskStale,
  loadTradingDeskStatus,
  type TradingDeskStatus,
} from '@/services/trading-desk';
import { renderDeskHq } from '@/desk-hq/page';
import { buildDeskHqView } from '@/desk-hq/view';

const root = document.querySelector<HTMLElement>('#desk-hq');
if (root) {
  let status: TradingDeskStatus | null = null;
  let stale = false;
  let refreshFailed = false;
  let inFlight = false;
  let dispose = () => {};
  const poll = new AbortController();

  const paint = () => {
    dispose();
    dispose = renderDeskHq(root, buildDeskHqView(status, { stale, refreshFailed }));
  };

  const refresh = async () => {
    if (inFlight || poll.signal.aborted) return;
    inFlight = true;
    try {
      const result = await loadTradingDeskStatus(poll.signal);
      if (poll.signal.aborted) return;
      if (result.ok) {
        status = result.status;
        stale = result.stale;
        refreshFailed = false;
      } else {
        refreshFailed = true;
        stale = status ? isTradingDeskStale(status) : false;
      }
    } catch (error) {
      if (poll.signal.aborted) return;
      const aborted = error instanceof DOMException && error.name === 'AbortError';
      if (aborted) return;
      refreshFailed = true;
      stale = status ? isTradingDeskStale(status) : false;
    } finally {
      inFlight = false;
    }
    if (!poll.signal.aborted) paint();
  };

  paint();
  void refresh();
  const timer = window.setInterval(() => {
    void refresh();
  }, TRADING_DESK_POLL_MS);
  window.addEventListener('pagehide', () => {
    window.clearInterval(timer);
    poll.abort();
    dispose();
  }, { once: true });
}
