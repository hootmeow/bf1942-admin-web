import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import { getAuthUser } from '@/lib/auth'
import { disconnectServer } from '@/lib/rcon/registry'

type Params = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: Params) {
  const user = await getAuthUser()
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const serverId = parseInt(id)
  const body = await req.json().catch(() => null)
  const { name, host, port, rconPort, rconUser, rconPass } = body ?? {}

  const update: Record<string, string | number> = {}
  if (name?.trim()) update.name = name.trim()
  if (host?.trim()) update.host = host.trim()
  if (port) update.port = parseInt(port)
  if (rconPort) update.rconPort = parseInt(rconPort)
  if (rconUser !== undefined) update.rconUser = rconUser.trim()
  if (rconPass?.trim()) update.rconPass = rconPass.trim()

  const server = await db.server.update({ where: { id: serverId }, data: update })

  // Force reconnect so new credentials take effect
  disconnectServer(serverId)

  return NextResponse.json(server)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getAuthUser()
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const serverId = parseInt(id)

  disconnectServer(serverId)
  await db.server.delete({ where: { id: serverId } })

  return NextResponse.json({ ok: true })
}
