import { NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase/server'
import { getMarketSnapshot } from '@/lib/server/providers'

export const maxDuration = 60

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  try {
    return NextResponse.json(await getMarketSnapshot())
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 })
  }
}
