import { NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase/server'
import { searchSymbols } from '@/lib/server/providers'

export const maxDuration = 20

export async function GET(req) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  try {
    const q = new URL(req.url).searchParams.get('q') || ''
    return NextResponse.json(await searchSymbols(q), {
      // symbol lists are stable → let the browser reuse repeats for an hour
      headers: { 'Cache-Control': 'private, max-age=3600' },
    })
  } catch (e) {
    return NextResponse.json([], { status: 200 }) // search failures are non-fatal
  }
}
