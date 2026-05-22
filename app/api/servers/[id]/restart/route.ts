import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import { getAuthUser } from '@/lib/auth'
import { restartServer, startServer, getManager } from '@/lib/process/registry'

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const serverId = parseInt(id)

  const server = await db.server.findUnique({ where: { id: serverId }, select: { id: true } })
  if (!server) return NextResponse.json({ error: 'Server not found' }, { status: 404 })

  try {
    const mgr = getManager(serverId)
    if (mgr?.isRunning) {
      await restartServer(serverId)
    } else {
      await startServer(serverId)
    }
    await db.auditLog.create({
      data: { userId: user.userId, serverId, action: 'server_restart', detail: '{}' },
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
