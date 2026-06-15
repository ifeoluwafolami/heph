import { Router } from 'express'
import { Types } from 'mongoose'
import { requireAuth } from '../../middleware/auth.middleware'
import { TheOneItem } from './theOneItem.model'

const router = Router()

router.use(requireAuth)

router.get('/', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const items = await TheOneItem.find({ userId: new Types.ObjectId(userId) }).sort({ createdAt: 1 }).lean()
  res.json({ success: true, data: items })
})

router.post('/', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const title = String(req.body?.title || '').trim()
  if (!title) return res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'title is required' } })

  const item = new TheOneItem({
    userId: new Types.ObjectId(userId),
    title,
    note: String(req.body?.note || '').trim(),
  })
  await item.save()
  res.status(201).json({ success: true, data: item })
})

router.delete('/:id', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const id = req.params.id
  if (!Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, error: { code: 'INVALID_ID' } })

  await TheOneItem.findOneAndDelete({ _id: id, userId: new Types.ObjectId(userId) })
  res.json({ success: true, data: { id } })
})

export default router
