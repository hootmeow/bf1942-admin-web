import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import { getAuthUser } from '@/lib/auth'
import { readServerSettings, writeServerSettings } from '@/lib/process/settings'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const serverId = parseInt(id)

  const server = await db.server.findUnique({ where: { id: serverId }, select: { gameDir: true } })
  if (!server) return NextResponse.json({ error: 'Server not found' }, { status: 404 })

  const settings = readServerSettings(server.gameDir)
  return NextResponse.json({ settings })
}

export async function PUT(req: NextRequest, { params }: Params) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const serverId = parseInt(id)
  const body = await req.json().catch(() => null)
  const { settings } = body ?? {}

  if (!settings || typeof settings !== 'object') {
    return NextResponse.json({ error: 'settings object required' }, { status: 400 })
  }

  const server = await db.server.findUnique({ where: { id: serverId }, select: { gameDir: true } })
  if (!server) return NextResponse.json({ error: 'Server not found' }, { status: 404 })

  try {
    writeServerSettings(server.gameDir, settings)
  } catch (err) {
    return NextResponse.json({ error: 'Failed to write settings: ' + (err as Error).message }, { status: 500 })
  }

  await db.auditLog.create({
    data: {
      userId: user.userId,
      serverId,
      action: 'settings_update',
      detail: JSON.stringify({ keys: Object.keys(settings) }),
    },
  })

  return NextResponse.json({ ok: true })
}
