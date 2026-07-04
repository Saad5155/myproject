import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

// app_state holds a single JSON blob per user:
// { portfolio, alerts, watchlist, settings, news, calendar }
export async function GET() {
  const sb = createServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data, error } = await sb.from('app_state').select('data').eq('user_id', user.id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data?.data || {})
}

export async function PUT(req) {
  const sb = createServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json()
  const { error } = await sb.from('app_state').upsert({ user_id: user.id, data: body, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
