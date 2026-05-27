import { Router } from 'express'
import { User } from '../users/user.model'
import { loginSchema } from '../../validation/users.schema'
import { comparePassword } from '../../utils/hash'
import { signToken, verifyToken } from '../../utils/jwt'
import { requireAuth } from '../../middleware/auth.middleware'

const router = Router()

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'Invalid input', details: parsed.error.errors } })
  const { email, password } = parsed.data
  const user = await User.findOne({ email })
  if (!user) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR', message: 'Invalid credentials' } })
  const ok = await comparePassword(password, user.passwordHash)
  if (!ok) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR', message: 'Invalid credentials' } })
  const accessToken = signToken({ userId: String(user._id), type: 'access' }, '7d')
  const refreshToken = signToken({ userId: String(user._id), type: 'refresh' }, '30d')
  res.json({ success: true, data: { accessToken, refreshToken, user: { id: user._id, email: user.email, nickname: user.nickname } } })
})

router.post('/refresh', async (req, res) => {
  const refreshToken = req.body?.refreshToken as string | undefined
  if (!refreshToken) return res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'refreshToken is required' } })

  const payload = verifyToken(refreshToken)
  if (!payload || payload.type !== 'refresh') {
    return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR', message: 'Invalid refresh token' } })
  }

  const accessToken = signToken({ userId: payload.userId, type: 'access' }, '7d')
  res.json({ success: true, data: { accessToken } })
})

router.post('/logout', async (_req, res) => {
  // Stateless JWT logout: handled client-side by deleting stored token(s)
  res.json({ success: true, data: { loggedOut: true } })
})

router.get('/me', requireAuth, async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR', message: 'Invalid auth payload' } })
  const user = await User.findById(userId).lean()
  if (!user) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } })
  res.json({ success: true, data: { id: user._id, email: user.email, nickname: user.nickname } })
})

export default router
