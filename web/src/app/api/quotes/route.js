import { NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase/server'
import { getQuotes } from '@/lib/server/providers'

export const maxDuration = 120

export async function POST(req) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  try {
    const { symbols } = await req.json()
    if (!Array.isArray(symbols)) return NextResponse.json({ error: 'symbols[] required' }, { status: 400 })
    const map = await getQuotes(symbols)
    return NextResponse.json(map)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 })
  }
}
