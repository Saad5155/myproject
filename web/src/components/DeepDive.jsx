import React, { useState, useEffect } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, Cell,
} from 'recharts'
import { Panel, ErrBox, LoadingSequence, SourceBadge } from './common'
import TickerSearch from './TickerSearch'
import { ScreenerChecklist } from './Screener'
import { evaluateScreener } from '../lib/screener'
import { money, num, pct, compact, moneyCompact, classFor, uid, stamp } from '../lib/format'

const CH = { green: '#2bff88', amber: '#ffb000', red: '#ff3b5c', cyan: '#35d6ff', grid: '#143b1f', text: '#5f8f70' }

const STEPS = [
  'CONNECTING TO WIRE',
  'FETCHING PROFILE & QUOTE',
  'PULLING 5Y INCOME STATEMENT',
  'PARSING BALANCE SHEET',
  'FETCHING ANALYST DESK',
  'DETECTING PEERS',
  'RUNNING SCREENER',
]

function chartTooltip() {
  return {
    contentStyle: { background: '#060a06', border: `1px solid ${CH.grid}`, fontFamily: 'monospace', fontSize: 11, color: '#c9f7d8' },
    labelStyle: { color: CH.amber },
    itemStyle: { color: '#c9f7d8' },
  }
}

function ChartBox({ cap, children }) {
  return (
    <div className="chartbox">
      <div className="cap">{cap}</div>
      <ResponsiveContainer width="100%" height="88%">{children}</ResponsiveContainer>
    </div>
  )
}

export default function DeepDive({ symbol, onConsumeSymbol, research, onSaveCard, onDeleteCard, className }) {
  const [ticker, setTicker] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [report, setReport] = useState(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (symbol) { setTicker(symbol); run(symbol); onConsumeSymbol && onConsumeSymbol() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol])

  async function run(sym) {
    const s = (sym || ticker).toUpperCase().trim()
    if (!s) return
    setBusy(true); setError(null); setReport(null); setSaved(false)
    try {
      const res = await fetch('/api/deepdive', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ symbol: s }),
      })
      const r = await res.json().catch(() => null)
      if (!res.ok) throw new Error(r?.error || `Deep dive failed (${res.status})`)
      if (!r || !r.ticker) throw new Error('Could not assemble a report for ' + s + '. Try again.')
      setReport(r)
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  async function saveCard() {
    if (!report || saved) return
    setSaved(true)
    try { await onSaveCard(report) } catch { setSaved(false) }
  }

  return (
    <Panel
      title="Company Deep Dive" fk="F7" className={className}
      right={report && <button className="btn amber" onClick={saveCard} disabled={saved}>{saved ? '✓ SAVED' : '💾 SAVE CARD'}</button>}
    >
      <div style={{ marginBottom: 8 }}>
        <TickerSearch placeholder="Search a company or ticker → full research…"
          onSelect={(s) => { setTicker(s); run(s) }} />
      </div>

      {error && <ErrBox>{error}</ErrBox>}

      {busy && <LoadingSequence steps={STEPS} />}

      {!report && !busy && !error && (
        <>
          <div className="muted-box">Type any ticker for a full research report — profile, 5Y financials, charts, valuation, analyst desk, peers, and your screener verdict — built live.</div>
          {research.length > 0 && <ResearchLibrary research={research} onDelete={onDeleteCard} onOpen={(r) => setReport(r.report)} />}
        </>
      )}

      {report && <Report report={report} />}
    </Panel>
  )
}

function ResearchLibrary({ research, onDelete, onOpen }) {
  return (
    <>
      <div className="section-title">RESEARCH LIBRARY ({research.length})</div>
      {research.map((r) => (
        <div className="cal-item" key={r.id}>
          <div className="cal-body">
            <div className="ev"><span className="green bold" style={{ cursor: 'pointer' }} onClick={() => onOpen(r)}>{r.ticker}</span> <span className="dim">{r.report?.name}</span></div>
            <div className="dt">saved {stamp(r.time)}</div>
          </div>
          <span className="red" style={{ cursor: 'pointer' }} onClick={() => onDelete(r.id)}>✕</span>
        </div>
      ))}
    </>
  )
}

function Report({ report: r }) {
  const annual = r.financials?.annual || []
  const quarterly = r.financials?.quarterly || []
  const screen = r.screener ? evaluateScreener(r.screener) : null

  const rangePos = (r.week52Low != null && r.week52High != null && r.week52High > r.week52Low && r.price != null)
    ? Math.max(0, Math.min(100, ((r.price - r.week52Low) / (r.week52High - r.week52Low)) * 100)) : null

  const revData = annual.map((a) => ({ name: `'${String(a.year).slice(-2)}`, revenue: a.revenue, netIncome: a.netIncome }))
  const epsData = annual.map((a) => ({ name: `'${String(a.year).slice(-2)}`, eps: a.eps }))
  const marginData = annual.map((a) => ({ name: `'${String(a.year).slice(-2)}`, gross: a.grossMargin, op: a.operatingMargin, net: a.netMargin }))
  const cashDebt = [{ name: 'Balance', cash: r.balance?.cash, debt: r.balance?.totalDebt }]

  const tv = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(r.ticker)}`

  return (
    <div>
      {/* PROFILE HEADER */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <div>
            <span className="big-num amber">{r.ticker}</span> <span className="white">{r.name}</span>
            <div className="dim" style={{ fontSize: 11 }}>{r.sector} · MKT CAP {moneyCompact(r.marketCap)}</div>
          </div>
          <div className="right">
            <div className="big-num white">{money(r.price)}</div>
            <div className={classFor(r.changePct)}>{r.change != null ? money(r.change) : ''} ({pct(r.changePct)})</div>
            {r.sources?.quote && <SourceBadge source={r.sources.quote.source} time={r.sources.quote.time} />}
          </div>
        </div>
        <div className="green" style={{ margin: '6px 0', fontSize: 12 }}>{r.description}</div>
        {/* 52-week range bar */}
        {rangePos != null && (
          <>
            <div className="range">
              <div className="fill" style={{ width: '100%' }} />
              <div className="marker" style={{ left: `${rangePos}%` }} />
              <span className="lbl" style={{ left: 2 }}>{money(r.week52Low)}</span>
              <span className="lbl" style={{ right: 2 }}>{money(r.week52High)}</span>
            </div>
            <div className="dim center" style={{ fontSize: 10 }}>52-WEEK RANGE · now at {rangePos.toFixed(0)}%</div>
          </>
        )}
        <div className="btn-row" style={{ marginTop: 8 }}>
          <a className="btn ghost" href={tv} target="_blank" rel="noreferrer">📈 FULL CHART (TradingView) ↗</a>
        </div>
      </div>

      {/* SCREENER VERDICT */}
      {screen && (
        <>
          <div className="section-title">MY SCREENER VERDICT</div>
          <ScreenerChecklist result={screen} />
        </>
      )}

      {/* CHARTS */}
      <div className="section-title">CHARTS</div>
      {revData.length > 0 && (
        <ChartBox cap="Revenue vs Net Income (by year, $)">
          <BarChart data={revData} margin={{ top: 4, right: 6, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={CH.grid} vertical={false} />
            <XAxis dataKey="name" stroke={CH.text} tick={{ fontSize: 10 }} />
            <YAxis stroke={CH.text} tick={{ fontSize: 9 }} tickFormatter={compact} width={44} />
            <Tooltip {...chartTooltip()} formatter={(v) => moneyCompact(v)} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Bar dataKey="revenue" name="Revenue" fill={CH.green} />
            <Bar dataKey="netIncome" name="Net Income" fill={CH.amber} />
          </BarChart>
        </ChartBox>
      )}
      {epsData.length > 0 && (
        <ChartBox cap="EPS Trend">
          <LineChart data={epsData} margin={{ top: 4, right: 6, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={CH.grid} vertical={false} />
            <XAxis dataKey="name" stroke={CH.text} tick={{ fontSize: 10 }} />
            <YAxis stroke={CH.text} tick={{ fontSize: 9 }} width={36} />
            <Tooltip {...chartTooltip()} formatter={(v) => num(v)} />
            <Line type="monotone" dataKey="eps" name="EPS" stroke={CH.amber} strokeWidth={2} dot={{ r: 2, fill: CH.amber }} />
          </LineChart>
        </ChartBox>
      )}
      {marginData.length > 0 && (
        <ChartBox cap="Margin Trend (%)">
          <LineChart data={marginData} margin={{ top: 4, right: 6, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={CH.grid} vertical={false} />
            <XAxis dataKey="name" stroke={CH.text} tick={{ fontSize: 10 }} />
            <YAxis stroke={CH.text} tick={{ fontSize: 9 }} width={36} tickFormatter={(v) => v + '%'} />
            <Tooltip {...chartTooltip()} formatter={(v) => (v == null ? '—' : v + '%')} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Line type="monotone" dataKey="gross" name="Gross" stroke={CH.green} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="op" name="Operating" stroke={CH.amber} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="net" name="Net" stroke={CH.cyan} strokeWidth={2} dot={false} />
          </LineChart>
        </ChartBox>
      )}
      {(r.balance?.cash != null || r.balance?.totalDebt != null) && (
        <ChartBox cap="Cash vs Total Debt ($)">
          <BarChart data={cashDebt} margin={{ top: 4, right: 6, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={CH.grid} vertical={false} />
            <XAxis dataKey="name" stroke={CH.text} tick={{ fontSize: 10 }} />
            <YAxis stroke={CH.text} tick={{ fontSize: 9 }} tickFormatter={compact} width={44} />
            <Tooltip {...chartTooltip()} formatter={(v) => moneyCompact(v)} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Bar dataKey="cash" name="Cash" fill={CH.green} />
            <Bar dataKey="debt" name="Debt" fill={CH.red} />
          </BarChart>
        </ChartBox>
      )}

      {/* PRICE vs TARGET gauge */}
      {r.analysts && r.analysts.targetLow != null && r.analysts.targetHigh != null && (
        <TargetGauge price={r.price} low={r.analysts.targetLow} avg={r.analysts.targetAvg} high={r.analysts.targetHigh} />
      )}

      {/* FINANCIALS TABLE */}
      {annual.length > 0 && (
        <>
          <div className="section-title">FINANCIALS — ANNUAL {r.sources?.financials && <SourceBadge source={r.sources.financials.source} time={r.sources.financials.time} />}</div>
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead><tr><th>Year</th><th>Revenue</th><th>Net Inc</th><th>EPS</th><th>FCF</th><th>Gross%</th><th>Op%</th><th>Net%</th></tr></thead>
              <tbody>
                {annual.map((a, i) => (
                  <tr key={i}>
                    <td className="amber">{a.year}</td>
                    <td className="right">{moneyCompact(a.revenue)}</td>
                    <td className={`right ${classFor(a.netIncome)}`}>{moneyCompact(a.netIncome)}</td>
                    <td className="right">{a.eps != null ? num(a.eps) : '—'}</td>
                    <td className="right">{moneyCompact(a.fcf)}</td>
                    <td className="right dim">{a.grossMargin != null ? a.grossMargin + '%' : '—'}</td>
                    <td className="right dim">{a.operatingMargin != null ? a.operatingMargin + '%' : '—'}</td>
                    <td className="right dim">{a.netMargin != null ? a.netMargin + '%' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {quarterly.length > 0 && (
        <>
          <div className="section-title">FINANCIALS — QUARTERLY</div>
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead><tr><th>Qtr</th><th>Revenue</th><th>Net Inc</th><th>EPS</th><th>FCF</th></tr></thead>
              <tbody>
                {quarterly.map((q, i) => (
                  <tr key={i}>
                    <td className="amber">{q.period}</td>
                    <td className="right">{moneyCompact(q.revenue)}</td>
                    <td className={`right ${classFor(q.netIncome)}`}>{moneyCompact(q.netIncome)}</td>
                    <td className="right">{q.eps != null ? num(q.eps) : '—'}</td>
                    <td className="right">{moneyCompact(q.fcf)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* VALUATION */}
      {r.valuation && <Valuation v={r.valuation} />}

      {/* ANALYST DESK */}
      {r.analysts && <AnalystDesk a={r.analysts} src={r.sources?.analysts} />}

      {/* PEERS */}
      {r.peers?.length > 0 && (
        <>
          <div className="section-title">PEER COMPARISON</div>
          <table className="tbl">
            <thead><tr><th>Peer</th><th>Rev Grw</th><th>P/E</th><th>Net Mgn</th></tr></thead>
            <tbody>
              <tr style={{ background: '#0a140a' }}>
                <td className="green bold">{r.ticker} (this)</td>
                <td className="right">{r.growth?.revenueYoY != null ? pct(r.growth.revenueYoY) : '—'}</td>
                <td className="right">{r.valuation?.peTrailing != null ? num(r.valuation.peTrailing, 1) : '—'}</td>
                <td className="right">{r.screener?.netIncome != null && r.financials?.annual?.length ? (r.financials.annual.at(-1).netMargin != null ? r.financials.annual.at(-1).netMargin + '%' : '—') : '—'}</td>
              </tr>
              {r.peers.map((p, i) => (
                <tr key={i}>
                  <td className="cyan">{p.ticker} <span className="dim">{p.name}</span></td>
                  <td className="right">{p.revenueGrowthPct != null ? pct(p.revenueGrowthPct) : '—'}</td>
                  <td className="right">{p.pe != null ? num(p.pe, 1) : '—'}</td>
                  <td className="right">{p.netMarginPct != null ? p.netMarginPct + '%' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <div className="dim center" style={{ fontSize: 10, marginTop: 12 }}>
        {r.dataMode === 'hybrid'
          ? 'financial statements: LIVE-API (Alpha Vantage) · analyst extras: AI-SEARCH · verify before trading'
          : 'report assembled live via AI-SEARCH · verify before trading'}
      </div>
    </div>
  )
}

function TargetGauge({ price, low, avg, high }) {
  const lo = Math.min(low, price), hi = Math.max(high, price)
  const span = hi - lo || 1
  const posOf = (v) => Math.max(0, Math.min(100, ((v - lo) / span) * 100))
  return (
    <>
      <div className="section-title">PRICE vs ANALYST TARGETS</div>
      <div className="range" style={{ height: 30 }}>
        <div className="fill" style={{ left: `${posOf(low)}%`, width: `${posOf(high) - posOf(low)}%` }} />
        <div className="marker" style={{ left: `${posOf(price)}%`, background: 'var(--cyan)', boxShadow: '0 0 8px var(--cyan)' }} />
        {avg != null && <div className="marker" style={{ left: `${posOf(avg)}%` }} />}
      </div>
      <div className="grid3" style={{ fontSize: 11 }}>
        <div><span className="dim">LOW </span><span className="red">{money(low)}</span></div>
        <div className="center"><span className="dim">AVG </span><span className="amber">{avg != null ? money(avg) : '—'}</span></div>
        <div className="right"><span className="dim">HIGH </span><span className="green">{money(high)}</span></div>
      </div>
      <div className="center dim" style={{ fontSize: 10 }}>◆ cyan = current {money(price)} · amber = avg target · {avg != null && price != null ? (avg > price ? `${pct(((avg - price) / price) * 100)} upside to avg` : `${pct(((avg - price) / price) * 100)} to avg`) : ''}</div>
    </>
  )
}

const RATIO_NOTES = {
  peTrailing: (v) => (v == null ? '' : v > 40 ? 'expensive' : v > 20 ? 'fair-to-rich' : v > 0 ? 'reasonable' : 'no earnings'),
  peForward: (v) => (v == null ? '' : v > 40 ? 'priced for growth' : v > 0 ? 'forward-cheaper' : '—'),
  peg: (v) => (v == null ? '' : v < 1 ? 'growth at a discount' : v < 1.5 ? 'fair for growth' : 'pricey vs growth'),
  ps: (v) => (v == null ? '' : v > 10 ? 'very rich' : v > 5 ? 'premium' : 'modest'),
  roe: (v) => (v == null ? '' : v > 20 ? 'high returns' : v > 10 ? 'solid' : 'weak'),
  divYield: (v) => (v == null ? '' : v === 0 ? 'no dividend' : v > 3 ? 'income play' : 'small yield'),
}

function Valuation({ v }) {
  const rows = [
    ['P/E (trailing)', v.peTrailing, 'peTrailing', (x) => num(x, 1) + 'x'],
    ['P/E (forward)', v.peForward, 'peForward', (x) => num(x, 1) + 'x'],
    ['PEG', v.peg, 'peg', (x) => num(x, 2)],
    ['P/S', v.ps, 'ps', (x) => num(x, 1) + 'x'],
    ['ROE', v.roe, 'roe', (x) => x + '%'],
    ['Div Yield', v.divYield, 'divYield', (x) => x + '%'],
  ]
  return (
    <>
      <div className="section-title">VALUATION & RATIOS</div>
      <table className="tbl">
        <tbody>
          {rows.map(([label, val, key, fmt]) => (
            <tr key={key}>
              <td>{label}</td>
              <td className="right amber">{val != null ? fmt(val) : '—'}</td>
              <td className="dim" style={{ fontSize: 11 }}>{val != null ? RATIO_NOTES[key](val) : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

function AnalystDesk({ a, src }) {
  const actColor = { upgrade: 'green', downgrade: 'red', initiate: 'cyan', maintain: 'dim' }
  return (
    <>
      <div className="section-title">ANALYST DESK {src && <SourceBadge source={src.source} time={src.time} />}</div>
      <div className="grid2" style={{ marginBottom: 6 }}>
        <div className="stat"><span className="k">CONSENSUS</span><span className="v amber bold">{a.consensus || '—'}</span></div>
        <div className="stat"><span className="k">RATINGS</span><span className="v"><span className="green">{a.buy ?? '—'}B</span> / <span className="dim">{a.hold ?? '—'}H</span> / <span className="red">{a.sell ?? '—'}S</span></span></div>
      </div>
      {a.recent?.length > 0 && (
        <div className="wire">
          {a.recent.map((rc, i) => (
            <div className="wire-item" key={i}>
              <div className="meta">
                <span className={actColor[rc.action] || 'dim'}>{(rc.action || '').toUpperCase()}</span>
                <span className="white">{rc.firm}</span>
                <span className="dim">{rc.date}</span>
              </div>
              {rc.note && <div className="why">{rc.note}</div>}
            </div>
          ))}
        </div>
      )}
    </>
  )
}
