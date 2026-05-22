import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import { getAuthUser } from '@/lib/auth'
import { getManager } from '@/lib/process/registry'
import { readBanList, writeBanList } from '@/lib/process/settings'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const bans = await db.ban.findMany({
    where: { serverId: parseInt(id) },
    orderBy: { bannedAt: 'desc' },
  })
  return NextResponse.json(bans)
}

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const serverId = parseInt(id)
  const body = await req.json().catch(() => null)
  const { playerKey, ipAddress, playerName, slot, reason, banType = 'key' } = body ?? {}

  if (!playerName?.trim()) {
    return NextResponse.json({ error: 'playerName is required' }, { status: 400 })
  }
  if (banType === 'key' && !playerKey?.trim()) {
    return NextResponse.json({ error: 'playerKey is required for key bans' }, { status: 400 })
  }
  if (banType === 'ip' && !ipAddress?.trim()) {
    return NextResponse.json({ error: 'ipAddress is required for IP bans' }, { status: 400 })
  }

  const server = await db.server.findUnique({ where: { id: serverId }, select: { gameDir: true } })
  if (!server) return NextResponse.json({ error: 'Server not found' }, { status: 404 })

  const ban = await db.ban.create({
    data: {
      serverId,
      banType,
      playerKey: playerKey?.trim() || `IP:${ipAddress?.trim()}`,
      ipAddress: ipAddress?.trim() || null,
      playerName: playerName.trim(),
      reason: reason?.trim() || null,
      bannedBy: user.username,
    },
  })

  // Sync to banlist.con
  try {
    const existing = readBanList(server.gameDir)
    if (banType === 'key' && !existing.some(b => b.type === 'key' && b.value === playerKey.trim())) {
      existing.push({ type: 'key', value: playerKey.trim() })
      writeBanList(server.gameDir, existing)
    } else if (banType === 'ip' && !existing.some(b => b.type === 'ip' && b.value === ipAddress.trim())) {
      existing.push({ type: 'ip', value: ipAddress.trim() })
      writeBanList(server.gameDir, existing)
    }
  } catch (err) {
    console.error('[Bans] Failed to write banlist.con:', (err as Error).message)
  }

  // Send ban command to running server
  const mgr = getManager(serverId)
  if (mgr?.isRunning && slot !== undefined) {
    try {
      if (banType === 'ip') {
        mgr.sendCommand(`admin.banPlayerIp ${slot}`)
      } else {
        mgr.sendCommand(`admin.banPlayerKey ${slot}`)
      }
      mgr.sendCommand(`admin.kickPlayer ${slot}`)
    } catch (err) {
      console.error('[Bans] Failed to send ban command:', (err as Error).message)
    }
  }

  await db.auditLog.create({
    data: {
      userId: user.userId,
      serverId,
      action: 'ban',
      detail: JSON.stringify({ playerKey, ipAddress, playerName, reason, slot, banType }),
    },
  })

  return NextResponse.json(ban, { status: 201 })
}
