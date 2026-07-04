import { NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase/server'
import { buildDeepDive } from '@/lib/server/deepdive'

export const maxDuration = 60 // statements + AI gap-fill can take a while

export async function POST(req) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  try {
    const { symbol } = await req.json()
    if (!symbol || !/^[A-Za-z.\-]{1,10}$/.test(symbol)) {
      return NextResponse.json({ error: 'valid symbol required' }, { status: 400 })
    }
    const report = await buildDeepDive(symbol)
    return NextResponse.json(report)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 })
  }
}
