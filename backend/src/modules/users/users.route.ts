import { Router } from 'express'
import { User } from './user.model'
import { registerSchema } from '../../validation/users.schema'
import { hashPassword } from '../../utils/hash'

const router = Router()

router.get('/', async (req, res) => {
  const users = await User.find().limit(50).lean()
  res.json({ success: true, data: users })
})

router.post('/', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION', details: parsed.error.errors } })
  const { email, password, nickname } = parsed.data
  const passwordHash = await hashPassword(password)
  const u = new User({ email, passwordHash, nickname })
  await u.save()
  res.status(201).json({ success: true, data: { id: u._id, email: u.email } })
})

export default router
