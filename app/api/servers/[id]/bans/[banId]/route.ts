import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import { getAuthUser } from '@/lib/auth'

type Params = { params: Promise<{ id: string; banId: string }> }

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, banId } = await params
  const serverId = parseInt(id)

  const ban = await db.ban.findUnique({ where: { id: parseInt(banId) } })
  if (!ban || ban.serverId !== serverId) {
    return NextResponse.json({ error: 'Ban not found' }, { status: 404 })
  }

  await db.ban.delete({ where: { id: ban.id } })

  // Note: BF1942 RCON does not expose a "remove ban by key" command.
  // The ban will persist in the server's ban file until manually removed
  // or the server is restarted with an updated banlist.cfg.

  await db.auditLog.create({
    data: {
      userId: user.userId,
      serverId,
      action: 'unban',
      detail: JSON.stringify({ playerKey: ban.playerKey, playerName: ban.playerName }),
    },
  })

  return NextResponse.json({ ok: true })
}
