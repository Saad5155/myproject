# TERMINAL X

A personal Bloomberg-style stock terminal — **Next.js + Supabase**, fully server-backed.
Black CRT theme, amber/green monospace, dense multi-panel grid on desktop, tab + swipe
navigation on mobile, installable as a PWA.

## Architecture

- **Frontend**: Next.js 14 (App Router), React, Recharts. Single terminal page with 7 panels.
- **Backend**: Next.js API routes own **every** external call — the browser only talks to `/api/*`.
  - `/api/ai`, `/api/ai/vision` → Claude (research, news, screener, deep-dive, screenshot import)
  - `/api/quotes`, `/api/macro`, `/api/connectivity` → Finnhub / Alpha Vantage market data
  - `/api/state`, `/api/research-cards` → Supabase persistence
- **Data engine**: Finnhub (quotes/profiles) → Alpha Vantage (fundamentals/econ) → Claude web-search
  fallback. Every datum is badged `[LIVE-API]` or `[AI-SEARCH]` with a timestamp.
- **Real financial statements**: the deep dive pulls actual filings data from Alpha Vantage
  (INCOME_STATEMENT, BALANCE_SHEET, CASH_FLOW, EARNINGS, OVERVIEW, EARNINGS_CALENDAR) — 5 years
  annual + 8 quarters, margins computed from the statements, real analyst rating counts, real
  52-week range. Claude web-search fills only what free APIs lack (target low/high, rating
  actions, upcoming catalysts, peer metrics), each section badged with its source. One deep dive
  = 6 AV calls cached 24h (free tier 25/day → ~4 fresh tickers/day; repeats are free).
- **Macro tape**: live index / commodity / bond proxies (SPY·QQQ·DIA·IWM·USO·GLD·TLT·VIXY) +
  Alpha Vantage economic indicators (10Y yield, Fed funds, CPI, unemployment, WTI).
- **Cache**: Supabase `quote_cache` — quotes 60s, fundamentals/econ 24h (keeps you inside free tiers).
- **Auth**: Supabase email+password, single user, enforced by `src/middleware.js`. RLS scopes rows to your user.
- **Secrets**: all in server-side env vars — never shipped to the browser.
- **PWA**: `manifest.webmanifest` + `sw.js` (installable, offline app shell; `/api/*` always live).

## Setup

### 1. Supabase
1. Create a project at [supabase.com](https://supabase.com).
2. SQL Editor → run [`supabase/schema.sql`](supabase/schema.sql) (creates `app_state`, `research_cards`, `quote_cache` + RLS).
3. Authentication → Users → **Add user** (your email + password). *(Or enable email sign-up and register once from `/login`.)*

### 2. Environment
Copy `.env.example` → `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...        # server only — used for the shared quote cache
ANTHROPIC_API_KEY=sk-ant-...         # required
CLAUDE_MODEL=claude-sonnet-4-6       # optional
FINNHUB_API_KEY=...                  # optional (free: finnhub.io) — live quotes/macro
ALPHAVANTAGE_API_KEY=...             # optional (free) — fundamentals + econ indicators
```

Without Finnhub/Alpha Vantage the app still works — it falls back to Claude web-search
(badged `[AI-SEARCH]`).

### 3. Run
```bash
npm install
npm run dev      # http://localhost:3000
# or: npm run build && npm run start
```

### Zero-setup demo
Try the whole terminal with **no keys and no Supabase**:
```bash
DEMO_MODE=true npm run dev
```
Auth is bypassed, state is in-memory, market/AI data is canned (badged `DEMO`); the deep-dive
demo report is built from real IBM statements so charts and tables show genuine shapes.
Never set `DEMO_MODE` in production.

## Deploy (one console: Vercel)

1. **Import** — vercel.com → Add New → Project → pick this repo → set **Root Directory** to `web/` → Framework: Next.js (auto-detected).
2. **Database** — in the Vercel project: **Storage → Create → Supabase (Marketplace)**. This provisions
   the Postgres/auth backend *from inside Vercel* and auto-injects `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — exactly the names this app reads.
3. **Schema** — from the Storage tab, open the Supabase dashboard → SQL Editor → paste and run
   [`supabase/schema.sql`](supabase/schema.sql). Then Authentication → Users → **Add user**
   (your email + password — this is your terminal login).
4. **Keys** — Project → Settings → Environment Variables: add `ANTHROPIC_API_KEY` (required),
   `FINNHUB_API_KEY`, `ALPHAVANTAGE_API_KEY`, and optionally `CLAUDE_MODEL`.
5. **Deploy** — trigger a deployment; open the URL; sign in; on your phone use
   "Add to Home Screen" to install the PWA.

`maxDuration = 300` is set on the AI/deep-dive routes for long web-search calls (works on
Vercel's fluid compute; raise plan limits if you ever hit them).

## Panels
1. **Portfolio** — screenshot / paste / manual import, cost basis, P/L, allocation, cash remaining
2. **AI Research Command Line** — ask anything, live web-search answers
3. **News & Sentiment Wire** — headlines for your holdings + macro, AI sentiment-tagged
4. **Screener** — your 7 hard rules, pass/fail checklist
5. **Alerts** — price alerts, auto-checked on every open (full-screen klaxon on trigger)
6. **Catalyst Calendar** — earnings + Fed/CPI countdowns
7. **Company Deep Dive** — full research report: financials, Recharts charts, valuation, analyst desk,
   peers, screener verdict, save-to-library, TradingView link

Plus a **Morning Brief** button (refresh prices → check alerts → pull news → 3-sentence AI summary),
a live **Macro Tape**, `F1`–`F8` keyboard shortcuts (desktop) and swipe (mobile).
