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
  const { message } = body ?? {}

  if (!message?.trim()) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 })
  }

  const mgr = getManager(serverId)
  if (!mgr?.isRunning) {
    return NextResponse.json({ error: 'Server is not running' }, { status: 503 })
  }

  const text = message.trim().replace(/"/g, "'")
  mgr.sendCommand(`admin.sendTextMessage "${text}"`)

  await db.auditLog.create({
    data: {
      userId: user.userId,
      serverId,
      action: 'message',
      detail: JSON.stringify({ message: text }),
    },
  })

  return NextResponse.json({ ok: true })
}
