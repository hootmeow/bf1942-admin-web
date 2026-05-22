import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import { getAuthUser } from '@/lib/auth'

export async function GET() {
  const servers = await db.server.findMany({
    select: { id: true, name: true, host: true, port: true },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(servers)
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const { name, host, port, rconPort, rconUser, rconPass } = body ?? {}

  if (!name?.trim() || !host?.trim() || !rconPass?.trim()) {
    return NextResponse.json({ error: 'name, host, and rconPass are required' }, { status: 400 })
  }

  const server = await db.server.create({
    data: {
      name: name.trim(),
      host: host.trim(),
      port: parseInt(port) || 14567,
      rconPort: parseInt(rconPort) || 4711,
      rconUser: rconUser?.trim() ?? '',
      rconPass: rconPass.trim(),
    },
  })

  return NextResponse.json(server, { status: 201 })
}
