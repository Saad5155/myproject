import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export async function GET() {
  const sb = createServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data, error } = await sb.from('research_cards')
    .select('id, ticker, report, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // shape to what the client expects: { id, ticker, time, report }
  return NextResponse.json((data || []).map((r) => ({ id: r.id, ticker: r.ticker, time: r.created_at, report: r.report })))
}

export async function POST(req) {
  const sb = createServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { ticker, report } = await req.json()
  if (!ticker || !report) return NextResponse.json({ error: 'ticker + report required' }, { status: 400 })
  const { data, error } = await sb.from('research_cards')
    .insert({ user_id: user.id, ticker, report }).select('id, ticker, report, created_at').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id, ticker: data.ticker, time: data.created_at, report: data.report })
}

export async function DELETE(req) {
  const sb = createServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await sb.from('research_cards').delete().eq('user_id', user.id).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
