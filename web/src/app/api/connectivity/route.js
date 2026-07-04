import { NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase/server'
import { testConnectivity } from '@/lib/server/providers'

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  try {
    return NextResponse.json(await testConnectivity())
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
