import jwt, { SignOptions } from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET || 'dev-secret'

export type AuthTokenPayload = {
  userId: string
  type?: 'access' | 'refresh'
}

export function signToken(payload: AuthTokenPayload, expiresIn: SignOptions['expiresIn'] = '7d') {
  return jwt.sign(payload, Buffer.from(SECRET), { expiresIn })
}

export function verifyToken(token: string) {
  try {
    return jwt.verify(token, Buffer.from(SECRET)) as AuthTokenPayload
  } catch (err) {
    return null
  }
}