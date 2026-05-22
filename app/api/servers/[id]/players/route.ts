import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getManager } from '@/lib/process/registry'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const mgr = getManager(parseInt(id))

  if (!mgr?.isRunning) {
    return NextResponse.json([])
  }

  const players = await mgr.requestPlayerList()
  return NextResponse.json(players)
}
