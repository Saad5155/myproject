import React, { useState } from 'react'
import { Panel, Spinner, ErrBox } from './common'
import { SCREENER_RULES, evaluateScreener, SCREENER_PROMPT_SPEC } from '../lib/screener'
import { askClaudeWithSearch, parseJSONLoose, hasClaudeKey } from '../lib/claude'

function mark(status) {
  if (status === 'pass') return <span className="green bold">✓</span>
  if (status === 'fail') return <span className="red bold">✗</span>
  return <span className="dim">?</span>
}

export function ScreenerChecklist({ result }) {
  if (!result) return null
  const verdictCls = result.verdict === 'PASS' ? 'pass' : result.verdict === 'FAIL' ? 'fail' : 'neutral'
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <span className={`tag ${verdictCls}`} style={{ fontSize: 14, padding: '3px 10px' }}>{result.verdict}</span>
        <span className="dim">{result.passed}/{result.total} rules passed</span>
      </div>
      <ul className="checklist">
        {result.list.map((r) => (
          <li key={r.key}>
            <span className="mark">{mark(r.status)}</span>
            <span className="rule">
              {r.label}
              {r.detail && <span className="why">{r.detail}</span>}
            </span>
          </li>
        ))}
      </ul>
    </>
  )
}

export default function Screener({ className }) {
  const [ticker, setTicker] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [subject, setSubject] = useState('')

  async function run() {
    const sym = ticker.toUpperCase().trim()
    if (!sym) return
    if (!hasClaudeKey()) { setError('Set your Claude API key in SETTINGS.'); return }
    setBusy(true); setError(null); setResult(null)
    try {
      const text = await askClaudeWithSearch(
        `Fetch current fundamentals for ${sym} to evaluate a screener. ${SCREENER_PROMPT_SPEC} Return ONLY that JSON.`,
        { maxTokens: 1500, maxUses: 5 }
      )
      const metrics = parseJSONLoose(text)
      if (!metrics) throw new Error('Could not fetch fundamentals for ' + sym)
      setResult(evaluateScreener(metrics))
      setSubject(sym)
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  return (
    <Panel title="My Screener" fk="F4" className={className}>
      <div className="btn-row" style={{ marginBottom: 8 }}>
        <input
          style={{ flex: 1 }} placeholder="TICKER to screen…" value={ticker}
          onChange={(e) => setTicker(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && run()}
          autoCapitalize="characters" spellCheck={false}
        />
        <button className="btn amber" onClick={run} disabled={busy}>{busy ? <Spinner label="EVAL" /> : 'RUN'}</button>
      </div>

      {error && <ErrBox>{error}</ErrBox>}

      {!result && !busy && (
        <>
          <div className="dim" style={{ marginBottom: 6, fontSize: 11 }}>MY RULES:</div>
          <ul className="checklist">
            {SCREENER_RULES.map((r) => (
              <li key={r.key}><span className="mark dim">·</span><span className="rule dim">{r.label}</span></li>
            ))}
          </ul>
        </>
      )}

      {busy && (
        <div className="loading-seq">
          <div className="term-line active">[..] FETCHING FUNDAMENTALS<span className="term-caret" /></div>
          <div className="term-line dim">[  ] APPLYING 7 RULES</div>
        </div>
      )}

      {result && (
        <>
          <div className="section-title">{subject} — SCREEN RESULT</div>
          <ScreenerChecklist result={result} />
        </>
      )}
    </Panel>
  )
}
