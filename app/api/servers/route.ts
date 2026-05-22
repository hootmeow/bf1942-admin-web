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
  const { name, host, port, binaryPath, gameDir } = body ?? {}

  if (!name?.trim() || !host?.trim()) {
    return NextResponse.json({ error: 'name and host are required' }, { status: 400 })
  }

  const server = await db.server.create({
    data: {
      name: name.trim(),
      host: host.trim(),
      port: parseInt(port) || 14567,
      binaryPath: binaryPath?.trim() || '/home/bf1942_user/bf1942/bf1942_lnxded',
      gameDir: gameDir?.trim() || '/home/bf1942_user/bf1942',
    },
  })

  return NextResponse.json(server, { status: 201 })
}
