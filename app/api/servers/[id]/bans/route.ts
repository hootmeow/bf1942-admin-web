import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import { getAuthUser } from '@/lib/auth'
import { getClient } from '@/lib/rcon/registry'

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
  const { playerKey, playerName, slot, reason } = body ?? {}

  if (!playerKey?.trim() || !playerName?.trim()) {
    return NextResponse.json({ error: 'playerKey and playerName are required' }, { status: 400 })
  }

  const ban = await db.ban.create({
    data: {
      serverId,
      playerKey: playerKey.trim(),
      playerName: playerName.trim(),
      reason: reason?.trim() || null,
      bannedBy: user.username,
    },
  })

  const client = getClient(serverId)
  if (client?.isAuthenticated && slot !== undefined) {
    try {
      client.sendCommand(`admin.banPlayerKey ${slot}`)
    } catch (err) {
      console.error('[Bans] Failed to send ban command:', err)
    }
  }

  await db.auditLog.create({
    data: {
      userId: user.userId,
      serverId,
      action: 'ban',
      detail: JSON.stringify({ playerKey, playerName, reason, slot }),
    },
  })

  return NextResponse.json(ban, { status: 201 })
}
