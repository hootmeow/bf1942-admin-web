import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import { getAuthUser } from '@/lib/auth'
import { getManager } from '@/lib/process/registry'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const serverId = parseInt(id)

  const body = await req.json().catch(() => null)
  const { command, reason, playerName } = body ?? {}

  if (!command || typeof command !== 'string' || command.trim().length === 0) {
    return NextResponse.json({ error: 'Invalid command' }, { status: 400 })
  }

  const server = await db.server.findUnique({ where: { id: serverId }, select: { id: true } })
  if (!server) return NextResponse.json({ error: 'Server not found' }, { status: 404 })

  await db.auditLog.create({
    data: {
      userId: user.userId,
      serverId,
      action: classifyCommand(command),
      detail: JSON.stringify({ command: command.trim(), reason, playerName }),
    },
  })

  const mgr = getManager(serverId)
  if (!mgr?.isRunning) {
    return NextResponse.json({ error: 'Server is not running' }, { status: 503 })
  }

  try {
    mgr.sendCommand(command.trim())
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

function classifyCommand(cmd: string): string {
  const lower = cmd.toLowerCase().trim()
  if (lower.startsWith('admin.kickplayer')) return 'kick'
  if (lower.startsWith('admin.banplayer')) return 'ban'
  if (lower.startsWith('admin.setnextlevel') || lower.startsWith('game.setnextlevel')) return 'map_change'
  if (lower.startsWith('admin.runnextlevel')) return 'map_change'
  if (lower.startsWith('admin.restartmap')) return 'map_restart'
  if (lower.startsWith('admin.sendtextmessage')) return 'message'
  return 'exec'
}
