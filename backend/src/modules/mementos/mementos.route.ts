import { Router } from 'express'
import { Types } from 'mongoose'
import { requireAuth } from '../../middleware/auth.middleware'
import { Memento } from './memento.model'

const router = Router()

router.use(requireAuth)

router.get('/', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const limit = Math.min(Number(req.query.limit) || 20, 200)
  const page = Math.max(Number(req.query.page) || 1, 1)
  const skip = (page - 1) * limit

  const total = await Memento.countDocuments({ userId: new Types.ObjectId(userId) })
  const items = await Memento.find({ userId: new Types.ObjectId(userId) }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean()
  res.json({ success: true, data: items, meta: { total, page, limit } })
})

router.post('/', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const { title, content } = req.body as { title: string; content: string }
  if (!title || !content) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'title and content are required' } })
  }

  const item = new Memento({ userId: new Types.ObjectId(userId), title, content })
  await item.save()
  res.status(201).json({ success: true, data: item })
})

router.patch('/:id', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const id = req.params.id
  if (!Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, error: { code: 'INVALID_ID' } })

  const update = { ...req.body, editedAt: new Date() }
  const item = await Memento.findOneAndUpdate({ _id: id, userId: new Types.ObjectId(userId) }, update, { new: true }).lean()
  if (!item) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } })
  res.json({ success: true, data: item })
})

router.delete('/:id', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const id = req.params.id
  if (!Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, error: { code: 'INVALID_ID' } })

  await Memento.findOneAndDelete({ _id: id, userId: new Types.ObjectId(userId) })
  res.json({ success: true, data: { id } })
})

export default router
