import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

// TODO: fetch live player list from RCON daemon once protocol is implemented
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await params
  return NextResponse.json([])
}
