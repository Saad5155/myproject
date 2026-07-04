'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getQuotes } from '@/lib/dataEngine'

import StatusLine from '@/components/StatusLine'
import MarketTape from '@/components/MarketTape'
import Portfolio from '@/components/Portfolio'
import CommandLine from '@/components/CommandLine'
import NewsWire from '@/components/NewsWire'
import Screener from '@/components/Screener'
import Alerts, { checkAlerts, AlertKlaxon } from '@/components/Alerts'
import Calendar from '@/components/Calendar'
import DeepDive from '@/components/DeepDive'
import Settings from '@/components/Settings'
import MorningBrief from '@/components/MorningBrief'
import SearchModal from '@/components/SearchModal'

const PANELS = [
  { key: 'portfolio', label: 'PORTFOLIO', fk: 'F1', ic: '▤' },
  { key: 'research', label: 'RESEARCH', fk: 'F2', ic: '❯' },
  { key: 'news', label: 'WIRE', fk: 'F3', ic: '✉' },
  { key: 'screener', label: 'SCREEN', fk: 'F4', ic: '✓' },
  { key: 'alerts', label: 'ALERTS', fk: 'F5', ic: '!' },
  { key: 'calendar', label: 'CAL', fk: 'F6', ic: '▦' },
  { key: 'deepdive', label: 'DEEP DIVE', fk: 'F7', ic: '◎' },
]

const DEFAULTS = { portfolio: { positions: [], size: 7500 }, alerts: [], watchlist: [], news: null, calendar: null }

function useIsMobile() {
  const [m, setM] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 820px)')
    const h = (e) => setM(e.matches)
    setM(mq.matches); mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])
  return m
}

function Clock() {
  const [t, setT] = useState(null)
  useEffect(() => { setT(new Date()); const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id) }, [])
  if (!t) return <span className="clock" />
  return (
    <span className="clock">
      {t.toLocaleTimeString('en-US', { hour12: false })}
      {' · '}<span className="dim">{t.toISOString().slice(0, 10)}</span>
      <span className="blink amber"> ▋</span>
    </span>
  )
}

export default function Page() {
  const router = useRouter()
  const isMobile = useIsMobile()
  const [active, setActive] = useState('portfolio')

  const [state, setState] = useState(null)
  const [research, setResearch] = useState([])
  const [loaded, setLoaded] = useState(false)
  const skipSave = useRef(true)
  const saveTimer = useRef(null)

  const quotesRef = useRef({})
  const [quotes, setQuotes] = useState({})
  const [refreshing, setRefreshing] = useState(false)
  const [deepDiveSymbol, setDeepDiveSymbol] = useState(null)

  const [showSettings, setShowSettings] = useState(false)
  const [showBrief, setShowBrief] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [statusNonce] = useState(0)
  const [klaxon, setKlaxon] = useState([])
  const [lastCheck, setLastCheck] = useState(null)
  const [toasts, setToasts] = useState([])

  const toast = useCallback((msg, kind) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((t) => [...t, { id, msg, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600)
  }, [])

  // ---- load persisted state ----
  useEffect(() => {
    ;(async () => {
      try {
        const [sRes, rRes] = await Promise.all([fetch('/api/state'), fetch('/api/research-cards')])
        const s = sRes.ok ? await sRes.json() : {}
        const cards = rRes.ok ? await rRes.json() : []
        setState({ ...DEFAULTS, ...s, portfolio: { ...DEFAULTS.portfolio, ...(s.portfolio || {}) } })
        setResearch(Array.isArray(cards) ? cards : [])
      } catch {
        setState({ ...DEFAULTS })
      } finally {
        setLoaded(true)
      }
    })()
  }, [])

  // ---- debounced persistence of the app_state blob ----
  useEffect(() => {
    if (!loaded || state == null) return
    if (skipSave.current) { skipSave.current = false; return }
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      fetch('/api/state', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(state) }).catch(() => {})
    }, 600)
    return () => clearTimeout(saveTimer.current)
  }, [state, loaded])

  const tickers = state ? (state.portfolio.positions || []).map((p) => p.ticker) : []

  const refreshQuotes = useCallback(async (syms) => {
    const list = syms && syms.length ? syms : Object.keys(quotesRef.current)
    if (!list.length) return quotesRef.current
    setRefreshing(true)
    try {
      const map = await getQuotes(list)
      const merged = { ...quotesRef.current, ...map }
      quotesRef.current = merged
      setQuotes(merged)
      return merged
    } finally { setRefreshing(false) }
  }, [])

  // ---- on-open: one batched fetch → check alerts + warm portfolio quotes ----
  useEffect(() => {
    if (!loaded || !state) return
    const alertTickers = (state.alerts || []).filter((a) => a.active).map((a) => a.ticker)
    const toFetch = [...new Set([...alertTickers, ...tickers])]
    if (!toFetch.length) return
    ;(async () => {
      try {
        const map = await refreshQuotes(toFetch)
        setLastCheck(new Date().toISOString())
        const trig = checkAlerts(state.alerts || [], map)
        if (trig.length) setKlaxon(trig)
      } catch { /* ignore */ }
    })()
    // once, right after load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded])

  // ---- keyboard F1–F8 ----
  useEffect(() => {
    const handler = (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '')
      if (e.key === '/' && !typing) { e.preventDefault(); setShowSearch(true); return }
      const m = /^F([1-8])$/.exec(e.key)
      if (!m) return
      e.preventDefault()
      const n = Number(m[1])
      if (n === 8) { setShowSettings(true); return }
      const p = PANELS[n - 1]; if (p) setActive(p.key)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ---- state setters (functional-update aware) ----
  const patch = (key) => (updater) =>
    setState((s) => ({ ...s, [key]: typeof updater === 'function' ? updater(s[key]) : updater }))
  const setPortfolio = patch('portfolio')
  const setAlerts = patch('alerts')
  const setNews = patch('news')
  const setCalendar = patch('calendar')

  // ---- research cards (server-backed) ----
  async function saveCard(report) {
    const res = await fetch('/api/research-cards', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ticker: report.ticker, report }),
    })
    if (!res.ok) { toast('Save failed', 'err'); throw new Error('save failed') }
    const card = await res.json()
    setResearch((l) => [card, ...l].slice(0, 50))
    toast('Saved ' + report.ticker + ' to library')
    return card
  }
  async function deleteCard(id) {
    setResearch((l) => l.filter((x) => x.id !== id))
    await fetch('/api/research-cards?id=' + encodeURIComponent(id), { method: 'DELETE' }).catch(() => {})
  }

  function openTicker(sym) { setDeepDiveSymbol(sym); setActive('deepdive') }

  async function signOut() {
    try { await createClient().auth.signOut() } catch { /* noop */ }
    router.replace('/login'); router.refresh()
  }

  // swipe (mobile)
  const touch = useRef(null)
  function onTouchStart(e) { const t = e.touches[0]; touch.current = { x: t.clientX, y: t.clientY } }
  function onTouchEnd(e) {
    if (!touch.current) return
    const t = e.changedTouches[0]
    const dx = t.clientX - touch.current.x, dy = t.clientY - touch.current.y
    touch.current = null
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return
    const idx = PANELS.findIndex((p) => p.key === active)
    const next = dx < 0 ? Math.min(idx + 1, PANELS.length - 1) : Math.max(idx - 1, 0)
    setActive(PANELS[next].key)
  }

  if (!loaded || !state) {
    return (
      <div className="app" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div className="loading-seq">
          <div className="brand" style={{ fontSize: 22, marginBottom: 10 }}>TERMINAL&nbsp;<span className="x">X</span></div>
          <div className="term-line active">[..] BOOTING TERMINAL<span className="term-caret" /></div>
        </div>
      </div>
    )
  }

  const portfolioEl = (cls) => (
    <Portfolio className={cls} portfolio={state.portfolio} setPortfolio={setPortfolio} quotes={quotes}
      onRefresh={() => refreshQuotes(tickers)} refreshing={refreshing} openTicker={openTicker} />
  )
  const deepEl = (cls) => (
    <DeepDive className={cls} symbol={deepDiveSymbol} onConsumeSymbol={() => setDeepDiveSymbol(null)}
      research={research} onSaveCard={saveCard} onDeleteCard={deleteCard} />
  )

  function renderPanel(key) {
    switch (key) {
      case 'portfolio': return portfolioEl()
      case 'research': return <CommandLine />
      case 'news': return <NewsWire tickers={tickers} news={state.news} setNews={setNews} />
      case 'screener': return <Screener />
      case 'alerts': return <Alerts alerts={state.alerts} setAlerts={setAlerts} lastCheck={lastCheck} />
      case 'calendar': return <Calendar tickers={tickers} calendar={state.calendar} setCalendar={setCalendar} />
      case 'deepdive': return deepEl()
      default: return null
    }
  }

  return (
    <div className="app">
      <div className="topbar">
        <span className="brand">TERMINAL&nbsp;<span className="x">X</span></span>
        <span className="dim" style={{ fontSize: 10 }}>on-demand · not streaming</span>
        <span className="spacer" />
        <button className="iconbtn" onClick={() => setShowSearch(true)} aria-label="Search" title="Search (/)">⌕ SEARCH</button>
        <button className="btn amber" onClick={() => setShowBrief(true)}>☀ MORNING BRIEF</button>
        <button className="iconbtn" onClick={() => setShowSettings(true)} aria-label="Settings" title="Settings (F8)">CFG</button>
        <button className="iconbtn" onClick={signOut} aria-label="Sign out" title="Sign out">EXIT</button>
        <Clock />
      </div>

      <StatusLine nonce={statusNonce} />
      <MarketTape />

      {!isMobile && (
        <div className="fkeys" role="tablist" aria-label="Panels">
          {PANELS.map((p) => (
            <div key={p.key} role="tab" tabIndex={0} aria-selected={active === p.key}
              className={`fkey ${active === p.key ? 'active' : ''}`}
              onClick={() => setActive(p.key)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setActive(p.key)}>
              <span className="fk">{p.fk}</span> {p.label}
            </div>
          ))}
        </div>
      )}

      <div className="content">
        {isMobile ? (
          <div className="single" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            {renderPanel(active)}
          </div>
        ) : (
          <div className="grid">
            {portfolioEl('col-4 row-2')}
            <CommandLine className="col-4 row-2" />
            {deepEl('col-4 row-2')}
            <NewsWire className="col-6" tickers={tickers} news={state.news} setNews={setNews} />
            <Screener className="col-6" />
            <Calendar className="col-6" tickers={tickers} calendar={state.calendar} setCalendar={setCalendar} />
            <Alerts className="col-6" alerts={state.alerts} setAlerts={setAlerts} lastCheck={lastCheck} />
          </div>
        )}
      </div>

      {isMobile && (
        <div className="mobile-tabs" role="tablist" aria-label="Panels">
          {PANELS.map((p) => (
            <div key={p.key} role="tab" tabIndex={0} aria-selected={active === p.key}
              className={`mtab ${active === p.key ? 'active' : ''}`}
              onClick={() => setActive(p.key)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setActive(p.key)}>
              <span className="ic">{p.ic}</span>{p.label}
            </div>
          ))}
        </div>
      )}

      {klaxon.length > 0 && <AlertKlaxon triggered={klaxon} onDismiss={() => setKlaxon([])} />}
      {showSearch && <SearchModal onClose={() => setShowSearch(false)} onSelect={openTicker} />}
      {showSettings && (
        <Settings onClose={() => setShowSettings(false)}
          size={state.portfolio.size ?? 7500}
          onSize={(n) => setPortfolio((p) => ({ ...p, size: n }))} />
      )}
      {showBrief && (
        <MorningBrief onClose={() => setShowBrief(false)} portfolio={state.portfolio}
          quotes={quotes} refreshQuotes={refreshQuotes} alerts={state.alerts} />
      )}

      {toasts.length > 0 && (
        <div className="toasts" aria-live="polite">
          {toasts.map((t) => <div key={t.id} className={`toast ${t.kind === 'err' ? 'err' : ''}`}>{t.msg}</div>)}
        </div>
      )}
    </div>
  )
}
