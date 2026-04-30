import { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../utils/jwt'

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization
  if (!auth) return res.status(401).json({ success: false, error: { code: 'NO_AUTH', message: 'Missing Authorization' } })
  const parts = auth.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ success: false, error: { code: 'INVALID_AUTH', message: 'Invalid Authorization header' } })
  const payload = verifyToken(parts[1])
  if (!payload) return res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid token' } })
  req.auth = payload
  next()
}
