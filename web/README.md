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

Deploy to **Vercel**: import the repo, set the same env vars, deploy. `maxDuration` is set on the
AI routes for long web-search / deep-dive calls (raise the Vercel function limit if needed).

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
