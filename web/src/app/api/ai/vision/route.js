import { NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase/server'
import { parseScreenshot } from '@/lib/server/anthropic'

export const maxDuration = 120

export async function POST(req) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  try {
    const { base64, mediaType } = await req.json()
    if (!base64) return NextResponse.json({ error: 'image required' }, { status: 400 })
    const result = await parseScreenshot(base64, mediaType || 'image/png')
    return NextResponse.json({ result })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 })
  }
}
