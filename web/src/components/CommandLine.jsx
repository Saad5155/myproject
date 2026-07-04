import React, { useState, useRef, useEffect } from 'react'
import { Panel, Spinner } from './common'
import { timeShort } from '../lib/format'
import { askClaudeWithSearch, hasClaudeKey } from '../lib/claude'

const SYSTEM =
  'You are a terminal-based equity research assistant inside a Bloomberg-style stock terminal. ' +
  'Use web search for anything time-sensitive (prices, news, analyst targets, earnings dates). ' +
  'Answer in dense, terminal-formatted plain text — short lines, UPPERCASE section labels, no markdown headers, ' +
  'no tables with pipes. When a ticker is involved, lead with: PRICE, DAY CHANGE, then NEWS (2-3 bullets), ' +
  'ANALYST TARGETS (low/avg/high + consensus), NEXT EARNINGS (date). Keep it tight. Always end with "AS OF <UTC time>".'

const EXAMPLES = ['RTX', 'news on JPM', 'is LLY still a buy', 'what did the Fed say today', 'AAPL earnings date']

export default function CommandLine({ initialQuery, onConsumeInitial, className }) {
  const [history, setHistory] = useState([]) // {q, a, time, error}
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const bodyRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (initialQuery) { run(initialQuery); onConsumeInitial && onConsumeInitial() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery])

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [history, busy])

  async function run(q) {
    const query = q.trim()
    if (!query || busy) return
    if (!hasClaudeKey()) {
      setHistory((h) => [...h, { q: query, error: 'NO CLAUDE KEY — set it in SETTINGS (F8).', time: new Date().toISOString() }])
      return
    }
    setBusy(true)
    setHistory((h) => [...h, { q: query, a: null, time: new Date().toISOString() }])
    try {
      const ans = await askClaudeWithSearch(query, { system: SYSTEM, maxTokens: 3000 })
      setHistory((h) => h.map((it, i) => (i === h.length - 1 ? { ...it, a: ans } : it)))
    } catch (e) {
      setHistory((h) => h.map((it, i) => (i === h.length - 1 ? { ...it, error: e.message } : it)))
    } finally {
      setBusy(false)
    }
  }

  function submit(e) {
    e.preventDefault()
    run(input)
    setInput('')
  }

  return (
    <Panel title="AI Research Command Line" fk="F2" badge="web_search" className={className}>
      <div ref={bodyRef} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, overflow: 'auto' }} className="term-out">
          {history.length === 0 && (
            <div className="dim">
              Type a ticker or ask anything — live web search answers it.<br />
              <span className="dim">try: </span>
              {EXAMPLES.map((ex) => (
                <span key={ex} className="cyan" style={{ cursor: 'pointer', marginRight: 10 }} onClick={() => run(ex)}>{ex}</span>
              ))}
            </div>
          )}
          {history.map((it, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <div className="term-line"><span className="term-prompt">RSCH&gt; </span><span className="white">{it.q}</span> <span className="dim" style={{ fontSize: 10 }}>{timeShort(it.time)}</span></div>
              {it.a == null && !it.error && (i === history.length - 1 && busy) && (
                <div className="term-line amber"><Spinner label="SEARCHING THE WIRE" /></div>
              )}
              {it.error && <div className="term-line red">✗ {it.error}</div>}
              {it.a && <div className="term-out green" style={{ marginTop: 2 }}>{it.a}</div>}
            </div>
          ))}
        </div>
      </div>
      <form className="cmdrow" onSubmit={submit}>
        <span className="prompt">RSCH&gt;</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={busy ? 'working…' : 'ticker or question…'}
          disabled={busy}
          autoComplete="off" autoCapitalize="characters" spellCheck={false}
        />
      </form>
    </Panel>
  )
}
