import { Router } from 'express'
import { Types } from 'mongoose'
import { requireAuth } from '../../middleware/auth.middleware'
import { WeightEntry } from './weight.model'

const router = Router()

router.use(requireAuth)

router.get('/', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const limit = Math.min(Number(req.query.limit) || 20, 200)
  const page = Math.max(Number(req.query.page) || 1, 1)
  const skip = (page - 1) * limit

  const total = await WeightEntry.countDocuments({ userId: new Types.ObjectId(userId) })
  const items = await WeightEntry.find({ userId: new Types.ObjectId(userId) }).sort({ entryDate: -1 }).skip(skip).limit(limit).lean()
  res.json({ success: true, data: items, meta: { total, page, limit } })
})

router.post('/', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const { weightKg, changeKg, note, entryDate } = req.body as {
    weightKg: number
    changeKg?: number
    note?: string
    entryDate: string
  }

  if (typeof weightKg !== 'number' || !entryDate) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'weightKg and entryDate are required' } })
  }

  const item = new WeightEntry({
    userId: new Types.ObjectId(userId),
    weightKg,
    changeKg: typeof changeKg === 'number' ? changeKg : null,
    note: note || '',
    entryDate: new Date(entryDate),
  })
  await item.save()
  res.status(201).json({ success: true, data: item })
})

router.patch('/:id', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const id = req.params.id
  if (!Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, error: { code: 'INVALID_ID' } })

  const update = req.body as Record<string, unknown>
  if (update.entryDate) update.entryDate = new Date(String(update.entryDate))

  const item = await WeightEntry.findOneAndUpdate({ _id: id, userId: new Types.ObjectId(userId) }, update, { new: true }).lean()
  if (!item) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } })
  res.json({ success: true, data: item })
})

router.delete('/:id', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const id = req.params.id
  if (!Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, error: { code: 'INVALID_ID' } })

  await WeightEntry.findOneAndDelete({ _id: id, userId: new Types.ObjectId(userId) })
  res.json({ success: true, data: { id } })
})

export default router
