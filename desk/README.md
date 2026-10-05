# Trading desk status

The Trading Desk panel is a read-only view of a paper-trading desk. The desk runs in **shadow mode**: agents may record hypothetical crypto tickets, and this dashboard never sends an order or moves real funds.

The committed `desk/status.json` in this branch is **example data**. It is not a live book. Publish the live file on the `desk-data` branch (or any other HTTPS URL) and point the panel at it.

## Status URL

Set `VITE_TRADING_DESK_STATUS_URL` to an `http:` or `https:` URL that returns the JSON document below. When the variable is unset or empty, the panel uses:

`https://raw.githubusercontent.com/windaBOTZ/worldmonitor/desk-data/desk/status.json`

A value that is not an absolute HTTP(S) URL is ignored. The panel then shows **No desk data yet** instead of fetching an unexpected address.

The panel polls about every 60 seconds while it is on screen. A snapshot whose `updated_at` is older than 15 minutes is still rendered, with a **Stale** marker and the last-updated age. A missing file, a network failure, or JSON that has no `updated_at` shows **No desk data yet** and the last-updated age (`unknown` until a snapshot has been read). Those failures stay inside the panel.

Desk HQ (`/desk`, also `desk.html`) is a separate full-page view of the same file. It polls on the same 60 second interval. The Trading Desk panel links to it. Numbers on that page come only from this document: a missing `history` or `activity` array leaves that section empty, and a missing total renders as an em dash.

## Schema

`example` is optional. The panel ignores it. Use it on sample files so a reader can tell they are not live.

```json
{
  "example": true,
  "updated_at": "2026-10-04T22:40:00.000Z",
  "mode": "shadow",
  "seats": [
    { "name": "SCAN", "status": "ok", "note": "short status line" }
  ],
  "last_cycle": {
    "at": "2026-10-04T22:39:12.000Z",
    "outcome": "pick",
    "universe": 42,
    "survivors": 3,
    "reason": "why the cycle ended this way"
  },
  "positions": [
    {
      "symbol": "BONK",
      "chain": "solana",
      "address": "token mint or contract",
      "entry_price": 0.0000214,
      "current_price": 0.0000248,
      "ticket_usd": 250,
      "pnl_pct": 15.89,
      "pnl_usd_after_fees": 37.42,
      "opened_at": "2026-10-04T18:12:00.000Z",
      "status": "open"
    }
  ],
  "totals": {
    "paper_bank_usd": 10000,
    "realized_usd": -16.4,
    "unrealized_usd": 12.32,
    "trades": 3,
    "win_rate": 0.333
  },
  "started_at": "2026-10-01T00:00:00.000Z",
  "history": [
    { "at": "2026-10-01T00:00:00.000Z", "bank_usd": 10000 }
  ],
  "activity": [
    { "at": "2026-10-04T22:39:12.000Z", "seat": "CHIEF", "kind": "ORDER", "text": "what happened", "usd": 250 }
  ]
}
```

| Field | Meaning |
|---|---|
| `updated_at` | ISO-8601 time the writer finished this file. Required. |
| `mode` | `shadow` for paper trading. Other strings still render. |
| `seats[].name` | Agent seat. The desk uses `SCAN`, `VET`, `SOCIAL`, `CHIEF`, `SIZE`, `FILLS`, `RISK`, `COORDINATOR`. |
| `seats[].status` | `ok`, `idle`, `warn`, or `error`. |
| `seats[].note` | One line shown on the seat chip. |
| `last_cycle.outcome` | `pick`, `no_trade`, or `aborted`. |
| `last_cycle.universe` | Names considered this cycle. |
| `last_cycle.survivors` | Names that passed the filters. |
| `positions[].status` | `open` or `closed`. |
| `positions[].pnl_pct` | Percent return on the ticket, after fees. Positive is green. |
| `positions[].pnl_usd_after_fees` | Dollar P&L after fees. |
| `totals.paper_bank_usd` | Paper capital, not a live balance. |
| `totals.win_rate` | Fraction from 0 to 1. A value already above 1 is shown as a percent. `null` renders as an em dash. |
| `name` | Optional desk title. Desk HQ uses **Desk HQ** when this is empty. |
| `started_at` | Optional ISO-8601 start. Desk HQ derives day and uptime from `started_at` to `updated_at`. Missing or out of order stays an em dash. |
| `history[]` | Optional `{ at, bank_usd }` points for the balance chart. Older files omit this. |
| `activity[]` | Optional log rows: `{ at, seat, kind, text, usd }`. `kind` is usually `ORDER`, `FILL`, `RESEARCH`, `SETTLE`, `KILL`, or `PASS`. Other kinds still render. |

Unknown extra fields are ignored. Missing optional numbers render as an em dash. A seat or position without a name or symbol is skipped. A history point needs both a time and a bank figure to be drawn. An activity row with no time, seat, kind, or text is skipped.

Desk HQ total P&L is `realized_usd + unrealized_usd` only when both numbers are present. The percent is that sum divided by `paper_bank_usd` minus the sum (the paper bank before this P&L). If either input is missing, or the divisor is 0, the percent is an em dash. Open positions are a count of rows whose `status` is `open`.
