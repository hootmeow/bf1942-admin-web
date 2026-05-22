import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const secret = () => new TextEncoder().encode(process.env.JWT_SECRET!)

export interface AuthPayload {
  userId: number
  username: string
  role: string
}

export async function signToken(payload: AuthPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('8h')
    .setIssuedAt()
    .sign(secret())
}

export async function verifyToken(token: string): Promise<AuthPayload> {
  const { payload } = await jwtVerify(token, secret())
  return payload as unknown as AuthPayload
}

export async function getAuthUser(): Promise<AuthPayload | null> {
  const token = (await cookies()).get('auth-token')?.value
  if (!token) return null
  try {
    return await verifyToken(token)
  } catch {
    return null
  }
}
