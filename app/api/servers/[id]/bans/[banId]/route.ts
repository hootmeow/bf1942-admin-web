import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import { getAuthUser } from '@/lib/auth'
import { getManager } from '@/lib/process/registry'
import { readBanList, writeBanList } from '@/lib/process/settings'

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

  const server = await db.server.findUnique({ where: { id: serverId }, select: { gameDir: true } })

  await db.ban.delete({ where: { id: ban.id } })

  // Remove from banlist.con
  if (server) {
    try {
      const bans = readBanList(server.gameDir)
      const filtered = bans.filter(b => {
        if (ban.banType === 'key') return !(b.type === 'key' && b.value === ban.playerKey)
        if (ban.banType === 'ip') return !(b.type === 'ip' && b.value === (ban.ipAddress ?? ''))
        return true
      })
      writeBanList(server.gameDir, filtered)
    } catch (err) {
      console.error('[Bans] Failed to update banlist.con:', (err as Error).message)
    }
  }

  // Send live unban command
  const mgr = getManager(serverId)
  if (mgr?.isRunning) {
    try {
      if (ban.banType === 'ip' && ban.ipAddress) {
        mgr.sendCommand(`admin.removeIpBan ${ban.ipAddress}`)
      } else if (ban.banType === 'key') {
        mgr.sendCommand(`admin.removeKeyBan ${ban.playerKey}`)
      }
    } catch {}
  }

  await db.auditLog.create({
    data: {
      userId: user.userId,
      serverId,
      action: 'unban',
      detail: JSON.stringify({ playerKey: ban.playerKey, ipAddress: ban.ipAddress, playerName: ban.playerName }),
    },
  })

  return NextResponse.json({ ok: true })
}
