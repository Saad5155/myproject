'use client'
import React, { useState, useEffect } from 'react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceDot } from 'recharts'
import { money, pct } from '../lib/format'

const CH = { green: '#2bff88', amber: '#ffb000', red: '#ff3b5c', grid: '#143b1f', text: '#5f8f70' }

function useHistory(symbol, range) {
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!symbol) return
    let alive = true
    setBusy(true)
    fetch(`/api/history?symbol=${encodeURIComponent(symbol)}&range=${range}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive) setData(j) })
      .catch(() => {})
      .finally(() => { if (alive) setBusy(false) })
    return () => { alive = false }
  }, [symbol, range])
  return { data, busy }
}

const tooltip = {
  contentStyle: { background: '#060a06', border: `1px solid ${CH.grid}`, fontFamily: 'monospace', fontSize: 11, color: '#c9f7d8' },
  labelStyle: { color: CH.amber },
  itemStyle: { color: '#c9f7d8' },
}

// Tiny no-axis area chart for dense grids (index cards). Colored by direction.
export function Sparkline({ symbol, range = '1M', height = 34, width = 96 }) {
  const { data } = useHistory(symbol, range)
  const points = data?.points || []
  if (points.length < 2) return <div style={{ width, height }} />
  const up = points[points.length - 1].c >= points[0].c
  const color = up ? CH.green : CH.red
  const gid = `spk-${symbol}-${range}`.replace(/[^a-zA-Z0-9-]/g, '')
  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="c" stroke={color} strokeWidth={1.5} fill={`url(#${gid})`} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// TradingView-style card chart: a taller filled area with an end dot, no axes.
// Direction color from `up` (day change) when given, else first→last.
export function IndexArea({ symbol, up, range = '1M', height = 72 }) {
  const { data } = useHistory(symbol, range)
  const points = data?.points || []
  if (points.length < 2) return <div style={{ height }} />
  const rising = up != null ? up : points[points.length - 1].c >= points[0].c
  const color = rising ? CH.green : CH.red
  const last = points[points.length - 1]
  const gid = `idx-${symbol}-${range}`.replace(/[^a-zA-Z0-9-]/g, '')
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.32} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="t" type="number" hide domain={['dataMin', 'dataMax']} />
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Area type="monotone" dataKey="c" stroke={color} strokeWidth={2} fill={`url(#${gid})`} dot={false} isAnimationActive={false} />
          <ReferenceDot x={last.t} y={last.c} r={3.5} fill={color} stroke="none" isFront />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// Full price chart with range toggle. `ranges` defaults to 1M/1Y/5Y.
export default function PriceChart({ symbol, ranges = ['1M', '1Y', '5Y'], height = 200, defaultRange = '1Y' }) {
  const [range, setRange] = useState(defaultRange)
  const { data, busy } = useHistory(symbol, range)
  const points = (data?.points || []).map((p) => ({ t: p.t, c: p.c }))
  const first = points[0]?.c
  const lastPt = points[points.length - 1]?.c
  const chg = first && lastPt ? ((lastPt - first) / first) * 100 : null
  const up = chg == null ? true : chg >= 0
  const color = up ? CH.green : CH.red
  const fmtDate = (t) => {
    const d = new Date(t * 1000)
    if (range === '5Y') return `'${String(d.getFullYear()).slice(-2)}`
    if (range === '1M') return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return d.toLocaleDateString('en-US', { month: 'short' })
  }

  return (
    <>
      <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span>PRICE</span>
        {chg != null && <span className={up ? 'up' : 'down'} style={{ fontSize: 12 }}>{pct(chg)} {range}</span>}
        <span className="spacer" style={{ flex: 1 }} />
        {ranges.map((r) => (
          <span key={r} onClick={() => setRange(r)}
            style={{ cursor: 'pointer', fontSize: 11, padding: '1px 7px', border: '1px solid var(--grid-line)', color: range === r ? 'var(--amber)' : 'var(--text-dim)', background: range === r ? '#1a1200' : 'transparent' }}>
            {r}
          </span>
        ))}
      </div>
      <div className="chartbox" style={{ height }}>
        {points.length < 2 ? (
          <div className="dim center" style={{ paddingTop: height / 3, fontSize: 12 }}>
            {busy ? 'loading price history…' : 'price history unavailable for this ticker'}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="94%">
            <AreaChart data={points} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="pxfill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={CH.grid} vertical={false} />
              <XAxis dataKey="t" tickFormatter={fmtDate} stroke={CH.text} tick={{ fontSize: 10 }} minTickGap={28} />
              <YAxis stroke={CH.text} tick={{ fontSize: 9 }} width={44} domain={['auto', 'auto']}
                tickFormatter={(v) => '$' + Math.round(v)} />
              <Tooltip {...tooltip} labelFormatter={(t) => new Date(t * 1000).toLocaleDateString()}
                formatter={(v) => [money(v), 'Close']} />
              <Area type="monotone" dataKey="c" stroke={color} strokeWidth={2} fill="url(#pxfill)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </>
  )
}
