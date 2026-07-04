import { NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase/server'
import { getPriceHistory } from '@/lib/server/providers'

export const maxDuration = 30

export async function GET(req) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  try {
    const url = new URL(req.url)
    const symbol = url.searchParams.get('symbol')
    const range = url.searchParams.get('range') || '1Y'
    if (!symbol) return NextResponse.json({ error: 'symbol required' }, { status: 400 })
    // 1M is daily (fresher); 1Y/5Y move slowly → let the browser reuse longer.
    const maxAge = range === '1M' ? 1800 : 21600
    return NextResponse.json(await getPriceHistory(symbol, range), {
      headers: { 'Cache-Control': `private, max-age=${maxAge}` },
    })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
