'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [mode, setMode] = useState('signin')
  const [err, setErr] = useState(null)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const router = useRouter()

  // Best-effort sign-in notification (Telegram + email). Never blocks navigation.
  function notifyLogin() {
    // keepalive lets the request finish even as we navigate to '/'.
    try { fetch('/api/notify/login', { method: 'POST', keepalive: true }).catch(() => {}) } catch { /* noop */ }
  }

  // Server-side rate limit: max 3 sign-in attempts per hour per email/IP.
  async function guardAllows() {
    try {
      const r = await fetch('/api/auth/login-guard', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }),
      })
      if (r.status === 429) {
        const j = await r.json().catch(() => ({}))
        setErr(`Too many sign-in attempts. Try again in ${j.retryAfterMin || 60} min.`)
        return false
      }
      return true
    } catch { return true } // never lock the user out on a network hiccup
  }

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setErr(null); setMsg(null)
    const sb = createClient()
    try {
      if (mode === 'signin') {
        if (!(await guardAllows())) return
        const { error } = await sb.auth.signInWithPassword({ email, password: pw })
        if (error) throw error
        notifyLogin()
        router.replace('/'); router.refresh()
      } else {
        const { data, error } = await sb.auth.signUp({ email, password: pw })
        if (error) throw error
        if (data.session) { notifyLogin(); router.replace('/'); router.refresh() }
        else setMsg('Account created. Check your email to confirm, then sign in.')
      }
    } catch (e2) { setErr(e2.message) } finally { setBusy(false) }
  }

  return (
    <div className="app" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <form onSubmit={submit} className="panel" style={{ maxWidth: 380, width: '92%' }}>
        <div className="panel-head"><span className="title">TERMINAL X · AUTH</span></div>
        <div className="panel-body">
          <div className="brand" style={{ fontSize: 22, marginBottom: 12 }}>TERMINAL&nbsp;<span className="x">X</span></div>
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" required />
          </div>
          {err && <div className="err-box">⚠ {err}</div>}
          {msg && <div className="muted-box green">{msg}</div>}
          <button className="btn amber big" disabled={busy} type="submit" style={{ marginTop: 8 }}>
            {busy ? 'WORKING…' : mode === 'signin' ? '▶ SIGN IN' : '＋ CREATE ACCOUNT'}
          </button>
          <div className="center dim" style={{ marginTop: 10, fontSize: 11, cursor: 'pointer' }}
            onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setErr(null); setMsg(null) }}>
            {mode === 'signin' ? 'need an account? → sign up' : 'have an account? → sign in'}
          </div>
        </div>
      </form>
    </div>
  )
}
