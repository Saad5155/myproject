import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase/server'
import { isDemo } from '@/lib/server/demo'

export const maxDuration = 20

const WINDOW_MS = 60 * 60 * 1000 // 1 hour
const MAX = 3                    // attempts per window

// POST /api/auth/login-guard { email }
// Records a sign-in attempt and reports whether it's allowed. Enforced
// server-side (Supabase service role) so it holds across serverless instances
// and can't be bypassed by refreshing the page.
export async function POST(req) {
  if (isDemo()) return NextResponse.json({ allowed: true, remaining: MAX })

  let email = ''
  try { email = (await req.json())?.email || '' } catch { /* ignore */ }
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown'
  const ident = (String(email).trim().toLowerCase() || ip).slice(0, 200)

  let sb
  try { sb = createServiceSupabase() } catch {
    return NextResponse.json({ allowed: true, remaining: MAX }) // fail open if unconfigured
  }

  const windowStart = new Date(Date.now() - WINDOW_MS).toISOString()
  try {
    // prune expired rows for this identity, then count what's left in the window
    await sb.from('login_attempts').delete().eq('ident', ident).lt('at', windowStart)
    const { data: recent, error } = await sb
      .from('login_attempts').select('at').eq('ident', ident).gte('at', windowStart).order('at', { ascending: true })
    if (error) return NextResponse.json({ allowed: true, remaining: MAX }) // fail open on error

    if ((recent?.length || 0) >= MAX) {
      const oldest = new Date(recent[0].at).getTime()
      const retryAfterMin = Math.max(1, Math.ceil((oldest + WINDOW_MS - Date.now()) / 60000))
      return NextResponse.json({ allowed: false, retryAfterMin }, { status: 429 })
    }

    await sb.from('login_attempts').insert({ ident })
    return NextResponse.json({ allowed: true, remaining: MAX - 1 - (recent?.length || 0) })
  } catch {
    return NextResponse.json({ allowed: true, remaining: MAX }) // never block on infra error
  }
}
