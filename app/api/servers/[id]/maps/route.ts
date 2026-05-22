import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import { getAuthUser } from '@/lib/auth'
import { getClient } from '@/lib/rcon/registry'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const serverId = parseInt(id)

  let rotation = await db.mapRotation.findFirst({ where: { serverId, active: true } })

  if (!rotation) {
    rotation = await db.mapRotation.create({
      data: { serverId, name: 'Default', maps: '[]', active: true },
    })
  }

  return NextResponse.json({ id: rotation.id, name: rotation.name, maps: JSON.parse(rotation.maps) as string[] })
}

export async function PUT(req: NextRequest, { params }: Params) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const serverId = parseInt(id)
  const body = await req.json().catch(() => null)
  const { maps, pushToServer } = body ?? {}

  if (!Array.isArray(maps)) {
    return NextResponse.json({ error: 'maps must be an array' }, { status: 400 })
  }

  const existing = await db.mapRotation.findFirst({ where: { serverId, active: true } })

  if (existing) {
    await db.mapRotation.update({ where: { id: existing.id }, data: { maps: JSON.stringify(maps) } })
  } else {
    await db.mapRotation.create({
      data: { serverId, name: 'Default', maps: JSON.stringify(maps), active: true },
    })
  }

  await db.auditLog.create({
    data: {
      userId: user.userId,
      serverId,
      action: 'map_rotation_update',
      detail: JSON.stringify({ maps }),
    },
  })

  let warning: string | undefined
  if (pushToServer && maps.length > 0) {
    const client = getClient(serverId)
    if (client?.isAuthenticated) {
      try {
        client.sendCommand(`game.setNextLevel "${maps[0]}"`)
      } catch (err) {
        warning = 'Rotation saved but failed to push to server: ' + (err as Error).message
      }
    } else {
      warning = 'Rotation saved but server is not connected.'
    }
  }

  return NextResponse.json({ ok: true, ...(warning ? { warning } : {}) })
}
