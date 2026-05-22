import { NextRequest, NextResponse } from 'next/server'
import { compare } from 'bcryptjs'
import { db } from '@/lib/db/index'
import { signToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const { username, password } = body ?? {}

  if (!username || !password) {
    return NextResponse.json({ error: 'Missing credentials' }, { status: 400 })
  }

  const user = await db.user.findUnique({ where: { username } })
  const passwordHash = user?.password ?? '$2b$12$invalid.hash.to.prevent.timing.attacks.padding'

  const valid = await compare(password, passwordHash)

  if (!user || !valid) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const token = await signToken({ userId: user.id, username: user.username, role: user.role })

  const res = NextResponse.json({ ok: true })
  res.cookies.set('auth-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8,
  })
  return res
}
