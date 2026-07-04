import React, { useState, useEffect, useRef } from 'react'
import { timeShort } from '../lib/format'

export function Panel({ title, fk, badge, right, children, className = '' }) {
  return (
    <div className={`panel ${className}`}>
      <div className="panel-head">
        {fk != null && <span className="badge">{fk}</span>}
        <span className="title">{title}</span>
        {badge && <span className="badge">{badge}</span>}
        <span className="spacer" />
        {right}
      </div>
      <div className="panel-body">{children}</div>
    </div>
  )
}

export function SourceBadge({ source, time }) {
  if (!source) return null
  const cls = source === 'LIVE-API' ? 'live' : source === 'AI-SEARCH' ? 'ai' : 'stale'
  return (
    <span className={`src ${cls}`} title={time ? `as of ${timeShort(time)}` : ''}>
      {source}{time ? ` ${timeShort(time)}` : ''}
    </span>
  )
}

// Animated terminal boot / fetch sequence: pass an array of step labels.
export function LoadingSequence({ steps, done = false }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (done) { setI(steps.length); return }
    const t = setInterval(() => setI((x) => Math.min(x + 1, steps.length - 1)), 700)
    return () => clearInterval(t)
  }, [steps.length, done])
  return (
    <div className="loading-seq">
      {steps.map((s, idx) => (
        <div key={idx} className="term-line">
          {idx < i ? <span className="done">[OK] {s}</span>
            : idx === i ? <span className="active">[..] {s}<span className="term-caret" /></span>
              : <span className="dim">[  ] {s}</span>}
        </div>
      ))}
    </div>
  )
}

export function Spinner({ label = 'WORKING' }) {
  const frames = ['|', '/', '-', '\\']
  const [f, setF] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setF((x) => (x + 1) % frames.length), 120)
    return () => clearInterval(t)
  }, [])
  return <span className="amber">{label} {frames[f]}</span>
}

export function ErrBox({ children }) {
  return <div className="err-box">⚠ {children}</div>
}

export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="title">{title}</span>
          <span className="close-x" onClick={onClose}>ESC ✕</span>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

// simple async runner hook
export function useAsyncButton() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])
  async function run(fn) {
    setLoading(true); setError(null)
    try { return await fn() }
    catch (e) { if (mounted.current) setError(e.message || String(e)); throw e }
    finally { if (mounted.current) setLoading(false) }
  }
  return { loading, error, setError, run }
}
