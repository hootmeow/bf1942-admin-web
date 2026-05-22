import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import { getAuthUser } from '@/lib/auth'
import { getManager } from '@/lib/process/registry'
import { writeMapList, readMapList } from '@/lib/process/settings'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const serverId = parseInt(id)

  // Try DB first, fall back to reading the file directly
  let rotation = await db.mapRotation.findFirst({ where: { serverId, active: true } })

  if (!rotation) {
    const server = await db.server.findUnique({ where: { id: serverId }, select: { gameDir: true } })
    const fileMaps = server ? readMapList(server.gameDir).map(m => m.name) : []
    if (fileMaps.length > 0) {
      rotation = await db.mapRotation.create({
        data: { serverId, name: 'Default', maps: JSON.stringify(fileMaps), active: true },
      })
    } else {
      rotation = await db.mapRotation.create({
        data: { serverId, name: 'Default', maps: '[]', active: true },
      })
    }
  }

  const maps = JSON.parse(rotation.maps) as string[]
  const mgr = getManager(serverId)
  return NextResponse.json({ id: rotation.id, name: rotation.name, maps, currentMap: mgr?.currentMap ?? '' })
}

export async function PUT(req: NextRequest, { params }: Params) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const serverId = parseInt(id)
  const body = await req.json().catch(() => null)
  const { maps, mode = 'gpm_conquest', pushToServer } = body ?? {}

  if (!Array.isArray(maps)) {
    return NextResponse.json({ error: 'maps must be an array' }, { status: 400 })
  }

  const server = await db.server.findUnique({ where: { id: serverId }, select: { gameDir: true } })
  if (!server) return NextResponse.json({ error: 'Server not found' }, { status: 404 })

  // Persist to DB
  const existing = await db.mapRotation.findFirst({ where: { serverId, active: true } })
  if (existing) {
    await db.mapRotation.update({ where: { id: existing.id }, data: { maps: JSON.stringify(maps) } })
  } else {
    await db.mapRotation.create({ data: { serverId, name: 'Default', maps: JSON.stringify(maps), active: true } })
  }

  // Write to maplist.con
  try {
    writeMapList(server.gameDir, maps.map((name: string) => ({ name, mode })))
  } catch (err) {
    console.error('[Maps] Failed to write maplist.con:', (err as Error).message)
  }

  await db.auditLog.create({
    data: { userId: user.userId, serverId, action: 'map_rotation_update', detail: JSON.stringify({ maps }) },
  })

  let warning: string | undefined
  if (pushToServer && maps.length > 0) {
    const mgr = getManager(serverId)
    if (mgr?.isRunning) {
      try { mgr.sendCommand(`game.setNextLevel "${maps[0]}"`) }
      catch (err) { warning = 'Rotation saved but failed to push: ' + (err as Error).message }
    } else {
      warning = 'Rotation saved. Server is not running — changes take effect on next start.'
    }
  }

  return NextResponse.json({ ok: true, ...(warning ? { warning } : {}) })
}
