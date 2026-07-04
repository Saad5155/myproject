import React, { useState, useMemo } from 'react'
import { Panel, SourceBadge, ErrBox, Spinner } from './common'
import { money, signMoney, pct, num, classFor, uid } from '../lib/format'
import { parseScreenshot, askClaude, parseJSONLoose, hasClaudeKey } from '../lib/claude'

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1])
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

function normalizePositions(arr) {
  if (!Array.isArray(arr)) return []
  return arr
    .map((p) => ({
      id: uid(),
      ticker: String(p.ticker || p.symbol || '').toUpperCase().trim(),
      shares: Number(p.shares) || 0,
      buyPrice: p.buyPrice == null ? null : Number(p.buyPrice),
    }))
    .filter((p) => p.ticker && p.shares > 0)
}

export default function Portfolio({ portfolio, setPortfolio, quotes, onRefresh, refreshing, openTicker, className }) {
  const [mode, setMode] = useState(null) // 'screenshot' | 'paste' | 'manual' | null
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [preview, setPreview] = useState(null) // parsed positions awaiting confirm
  const [pasteText, setPasteText] = useState('')
  const [manual, setManual] = useState({ ticker: '', shares: '', buyPrice: '' })

  const positions = portfolio.positions || []
  const size = portfolio.size ?? 7500

  const stats = useMemo(() => computeStats(positions, quotes, size), [positions, quotes, size])

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!hasClaudeKey()) { setError('Add your Claude API key in SETTINGS first.'); return }
    setBusy(true); setError(null)
    try {
      const b64 = await fileToBase64(file)
      const parsed = await parseScreenshot(b64, file.type || 'image/png')
      const norm = normalizePositions(parsed)
      if (!norm.length) throw new Error('Could not read any positions from that image.')
      setPreview(norm)
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  async function handlePaste() {
    if (!pasteText.trim()) return
    if (!hasClaudeKey()) { setError('Add your Claude API key in SETTINGS first.'); return }
    setBusy(true); setError(null)
    try {
      const text = await askClaude(
        'Parse these stock positions into JSON. Return ONLY a JSON array, no prose: ' +
        '[{"ticker":"SYM","shares":number,"buyPrice":number}]. buyPrice = per-share cost if given, else null.\n\n' +
        pasteText,
        { maxTokens: 1024 }
      )
      const norm = normalizePositions(parseJSONLoose(text))
      if (!norm.length) throw new Error('Could not parse any positions from that text.')
      setPreview(norm)
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  function confirmPreview() {
    setPortfolio((p) => ({ ...p, positions: [...(p.positions || []), ...preview] }))
    setPreview(null); setMode(null); setPasteText('')
  }

  function addManual() {
    const t = manual.ticker.toUpperCase().trim()
    const sh = Number(manual.shares)
    if (!t || !(sh > 0)) { setError('Ticker and share count required.'); return }
    setPortfolio((p) => ({
      ...p,
      positions: [...(p.positions || []), { id: uid(), ticker: t, shares: sh, buyPrice: manual.buyPrice === '' ? null : Number(manual.buyPrice) }],
    }))
    setManual({ ticker: '', shares: '', buyPrice: '' }); setError(null); setMode(null)
  }

  function removePosition(id) {
    setPortfolio((p) => ({ ...p, positions: p.positions.filter((x) => x.id !== id) }))
  }

  function editSize(v) {
    const n = Number(v)
    if (!isNaN(n) && n >= 0) setPortfolio((p) => ({ ...p, size: n }))
  }

  return (
    <Panel
      title="Portfolio" fk="F1" className={className}
      right={
        <button className="btn ghost" onClick={onRefresh} disabled={refreshing || !positions.length}>
          {refreshing ? <Spinner label="SYNC" /> : '↻ QUOTES'}
        </button>
      }
    >
      {/* summary strip */}
      <div className="grid3" style={{ marginBottom: 10 }}>
        <div className="card">
          <h4>Cost Basis</h4>
          <div className="big-num amber">{money(stats.totalCost, 0)}</div>
        </div>
        <div className="card">
          <h4>Current Value</h4>
          <div className="big-num white">{stats.hasQuotes ? money(stats.totalValue, 0) : <span className="dim">—</span>}</div>
        </div>
        <div className="card">
          <h4>Open P/L</h4>
          <div className={`big-num ${classFor(stats.totalPL)}`}>
            {stats.hasQuotes ? signMoney(stats.totalPL, 0) : '—'}
            {stats.hasQuotes && <span style={{ fontSize: 13 }}> {pct(stats.totalPLPct)}</span>}
          </div>
        </div>
      </div>

      <div className="grid2" style={{ marginBottom: 8 }}>
        <div className="stat">
          <span className="k">PORTFOLIO SIZE</span>
          <span className="v inline-field">
            $<input style={{ width: 90 }} value={size} onChange={(e) => editSize(e.target.value)} />
          </span>
        </div>
        <div className="stat">
          <span className="k">CASH REMAINING</span>
          <span className={`v ${stats.cash < 0 ? 'red' : 'green'}`}>{money(stats.cash, 0)}</span>
        </div>
      </div>

      {error && <ErrBox>{error}</ErrBox>}

      {/* import controls */}
      {!preview && (
        <div className="btn-row" style={{ margin: '8px 0' }}>
          <button className={`btn ${mode === 'screenshot' ? 'amber' : ''}`} onClick={() => setMode(mode === 'screenshot' ? null : 'screenshot')}>📷 Screenshot</button>
          <button className={`btn ${mode === 'paste' ? 'amber' : ''}`} onClick={() => setMode(mode === 'paste' ? null : 'paste')}>📋 Paste</button>
          <button className={`btn ${mode === 'manual' ? 'amber' : ''}`} onClick={() => setMode(mode === 'manual' ? null : 'manual')}>＋ Manual</button>
        </div>
      )}

      {mode === 'screenshot' && !preview && (
        <div className="card" style={{ marginBottom: 8 }}>
          <div className="dim" style={{ marginBottom: 6 }}>Upload a screenshot of your brokerage app — the AI reads tickers, share counts & buy prices.</div>
          {busy ? <Spinner label="PARSING IMAGE" /> : <input type="file" accept="image/*" onChange={handleFile} />}
        </div>
      )}

      {mode === 'paste' && !preview && (
        <div className="card" style={{ marginBottom: 8 }}>
          <textarea rows={3} placeholder={'e.g. 10 JPM at 329, 5 RTX 190, 3 LLY @ 1180'} value={pasteText} onChange={(e) => setPasteText(e.target.value)} />
          <div className="btn-row" style={{ marginTop: 6 }}>
            <button className="btn amber" onClick={handlePaste} disabled={busy}>{busy ? <Spinner label="PARSING" /> : 'PARSE'}</button>
          </div>
        </div>
      )}

      {mode === 'manual' && !preview && (
        <div className="card" style={{ marginBottom: 8 }}>
          <div className="btn-row">
            <input style={{ width: 80 }} placeholder="TICKER" value={manual.ticker} onChange={(e) => setManual({ ...manual, ticker: e.target.value })} />
            <input style={{ width: 80 }} placeholder="SHARES" value={manual.shares} onChange={(e) => setManual({ ...manual, shares: e.target.value })} />
            <input style={{ width: 90 }} placeholder="BUY $" value={manual.buyPrice} onChange={(e) => setManual({ ...manual, buyPrice: e.target.value })} />
            <button className="btn" onClick={addManual}>ADD</button>
          </div>
        </div>
      )}

      {/* parsed preview / confirmation */}
      {preview && (
        <div className="card" style={{ marginBottom: 8, borderColor: 'var(--amber-dim)' }}>
          <h4 className="amber">Confirm parsed positions</h4>
          <table className="tbl">
            <thead><tr><th>Sym</th><th>Shares</th><th>Buy $</th></tr></thead>
            <tbody>
              {preview.map((p) => (
                <tr key={p.id}>
                  <td className="green bold">{p.ticker}</td>
                  <td className="right">{num(p.shares, 2)}</td>
                  <td className="right">{p.buyPrice == null ? <span className="dim">?</span> : money(p.buyPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="btn-row" style={{ marginTop: 8 }}>
            <button className="btn amber" onClick={confirmPreview}>✓ SAVE {preview.length}</button>
            <button className="btn red ghost" onClick={() => setPreview(null)}>DISCARD</button>
          </div>
        </div>
      )}

      {/* holdings table */}
      {positions.length === 0 ? (
        <div className="muted-box">No positions yet. Import a screenshot, paste text, or add manually.</div>
      ) : (
        <table className="tbl">
          <thead>
            <tr><th>Sym</th><th>Shr</th><th>Cost</th><th>Last</th><th>Value</th><th>P/L</th><th>Alloc</th><th></th></tr>
          </thead>
          <tbody>
            {stats.rows.map((r) => (
              <tr key={r.id} className="tickerrow" onClick={() => openTicker && openTicker(r.ticker)}>
                <td className="green bold">
                  {r.ticker}
                  {r.quote && <SourceBadge source={r.quote.source} />}
                </td>
                <td className="right">{num(r.shares, 0)}</td>
                <td className="right dim">{r.buyPrice == null ? '?' : money(r.buyPrice)}</td>
                <td className="right">{r.price ? money(r.price) : <span className="dim">—</span>}</td>
                <td className="right">{r.value ? money(r.value, 0) : <span className="dim">—</span>}</td>
                <td className={`right ${classFor(r.pl)}`}>{r.pl == null ? '—' : <>{signMoney(r.pl, 0)}<br /><span style={{ fontSize: 10 }}>{pct(r.plPct)}</span></>}</td>
                <td style={{ minWidth: 70 }}>
                  <div className="allocbar"><i style={{ width: `${Math.min(100, r.alloc || 0)}%` }} /></div>
                  <span className="dim" style={{ fontSize: 10 }}>{r.alloc != null ? r.alloc.toFixed(0) + '%' : ''}</span>
                </td>
                <td><span className="red" style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); removePosition(r.id) }}>✕</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {positions.length > 0 && <div className="swipe-hint">tap a row → COMPANY DEEP DIVE</div>}
    </Panel>
  )
}

function computeStats(positions, quotes, size) {
  let totalCost = 0, totalValue = 0, hasQuotes = false
  const rows = positions.map((p) => {
    const q = quotes[p.ticker]
    const price = q && !q.error ? q.price : null
    if (price) hasQuotes = true
    const cost = p.buyPrice != null ? p.shares * p.buyPrice : null
    const value = price != null ? p.shares * price : null
    const pl = value != null && cost != null ? value - cost : null
    const plPct = pl != null && cost ? (pl / cost) * 100 : null
    if (cost != null) totalCost += cost
    if (value != null) totalValue += value
    return { ...p, quote: q, price, cost, value, pl, plPct }
  })
  // allocation vs current value (fallback to cost)
  const denom = totalValue || totalCost || 1
  rows.forEach((r) => { r.alloc = (r.value ?? r.cost ?? 0) / denom * 100 })
  const totalPL = totalValue && totalCost ? totalValue - totalCost : null
  const totalPLPct = totalPL != null && totalCost ? (totalPL / totalCost) * 100 : null
  const cash = size - totalCost
  return { rows, totalCost, totalValue, totalPL, totalPLPct, cash, hasQuotes }
}
