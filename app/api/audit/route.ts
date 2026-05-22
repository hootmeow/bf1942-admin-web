import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/index'

const PAGE_SIZE = 50

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const skip = (page - 1) * PAGE_SIZE

  const [items, total] = await Promise.all([
    db.auditLog.findMany({
      skip,
      take: PAGE_SIZE,
      orderBy: { timestamp: 'desc' },
      include: {
        user: { select: { username: true } },
        server: { select: { name: true } },
      },
    }),
    db.auditLog.count(),
  ])

  return NextResponse.json({ items, page, pages: Math.ceil(total / PAGE_SIZE), total })
}
