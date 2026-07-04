import React, { useState, useEffect } from 'react'
import { Modal, LoadingSequence, ErrBox } from './common'
import { money, signMoney, pct, classFor } from '../lib/format'
import { askClaudeWithSearch, hasClaudeKey } from '../lib/claude'
import { checkAlerts } from './Alerts'

const STEPS = ['REFRESHING PRICES', 'CHECKING ALERTS', 'PULLING OVERNIGHT NEWS', 'SUMMARIZING WHAT MATTERS']

// One button that runs everything: refresh prices, check alerts, pull news, AI summary.
export default function MorningBrief({ onClose, portfolio, quotes, refreshQuotes, alerts }) {
  const [phase, setPhase] = useState('run') // 'run' | 'done' | 'error'
  const [summary, setSummary] = useState('')
  const [error, setError] = useState(null)
  const [snapshot, setSnapshot] = useState(null)

  useEffect(() => { run() /* eslint-disable-next-line */ }, [])

  async function run() {
    if (!hasClaudeKey()) { setError('Set your Claude API key in SETTINGS first.'); setPhase('error'); return }
    setPhase('run'); setError(null)
    try {
      const positions = portfolio.positions || []
      const tickers = positions.map((p) => p.ticker)
      // 1) refresh prices
      const fresh = await refreshQuotes(tickers)
      // 2) compute P/L snapshot
      let cost = 0, value = 0
      positions.forEach((p) => {
        const q = fresh[p.ticker]
        if (p.buyPrice != null) cost += p.shares * p.buyPrice
        if (q && !q.error) value += p.shares * q.price
      })
      const pl = value && cost ? value - cost : null
      // 3) alerts
      const triggered = checkAlerts(alerts, fresh)
      setSnapshot({ cost, value, pl, plPct: pl != null && cost ? (pl / cost) * 100 : null, triggered })
      // 4) AI summary
      const holdings = tickers.length ? tickers.join(', ') : '(no holdings)'
      const text = await askClaudeWithSearch(
        `Give me a MORNING BRIEF in exactly 3 sentences about what matters TODAY for my money. ` +
        `My holdings: ${holdings}. Consider overnight/pre-market moves, news on these names, and macro ` +
        `(Fed, rates, oil, big data releases). Be specific and actionable. Plain text, no markdown.`,
        { maxTokens: 900, maxUses: 6 }
      )
      setSummary(text)
      setPhase('done')
    } catch (e) { setError(e.message); setPhase('error') }
  }

  return (
    <Modal title="☀ Morning Brief" onClose={onClose}>
      {phase === 'run' && <LoadingSequence steps={STEPS} />}
      {phase === 'error' && <ErrBox>{error}</ErrBox>}
      {phase === 'done' && (
        <>
          {snapshot && (
            <div className="grid3" style={{ marginBottom: 12 }}>
              <div className="card"><h4>Value</h4><div className="big-num white">{money(snapshot.value, 0)}</div></div>
              <div className="card"><h4>Open P/L</h4><div className={`big-num ${classFor(snapshot.pl)}`}>{snapshot.pl != null ? signMoney(snapshot.pl, 0) : '—'}</div></div>
              <div className="card"><h4>Alerts</h4><div className={`big-num ${snapshot.triggered.length ? 'red' : 'green'}`}>{snapshot.triggered.length ? snapshot.triggered.length + ' HIT' : 'CLEAR'}</div></div>
            </div>
          )}
          {snapshot?.triggered?.length > 0 && (
            <div className="err-box" style={{ marginBottom: 10 }}>
              {snapshot.triggered.map((a) => (
                <div key={a.id}>⚠ {a.ticker} {a.condition} {money(a.price)} — now {money(a.currentPrice)}</div>
              ))}
            </div>
          )}
          <div className="section-title">WHAT MATTERS TODAY</div>
          <div className="term-out green">{summary}</div>
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button className="btn" onClick={run}>↻ RE-RUN</button>
            <button className="btn amber" onClick={onClose}>DONE</button>
          </div>
        </>
      )}
    </Modal>
  )
}
