import { Router } from 'express'
import { Types } from 'mongoose'
import { requireAuth } from '../../middleware/auth.middleware'
import { BloomPlan } from './bloomPlan.model'

const router = Router()
const dateKeyPattern = /^\d{4}-\d{2}-\d{2}$/
const colorPattern = /^#[0-9a-fA-F]{6}$/

router.use(requireAuth)

router.get('/', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const query: Record<string, unknown> = { userId: new Types.ObjectId(userId) }
  if (typeof req.query.start === 'string' && dateKeyPattern.test(req.query.start) && typeof req.query.end === 'string' && dateKeyPattern.test(req.query.end)) {
    query.date = { $gte: req.query.start, $lte: req.query.end }
  }

  const items = await BloomPlan.find(query).sort({ date: 1, createdAt: 1 }).lean()
  res.json({ success: true, data: items })
})

router.post('/', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const title = String(req.body?.title || '').trim()
  const date = String(req.body?.date || '')
  const color = String(req.body?.color || '')
  const notes = String(req.body?.notes || '').trim()

  if (!title || !dateKeyPattern.test(date) || !colorPattern.test(color)) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'title, date and color are required' } })
  }

  const item = await BloomPlan.create({
    userId: new Types.ObjectId(userId),
    title,
    date,
    color,
    notes,
  })
  res.status(201).json({ success: true, data: item })
})

router.patch('/:id', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const id = req.params.id
  if (!Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, error: { code: 'INVALID_ID' } })

  const update: Partial<{ title: string; date: string; color: string; notes: string }> = {}
  if ('title' in req.body) {
    const title = String(req.body.title || '').trim()
    if (!title) return res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'title is required' } })
    update.title = title
  }
  if ('date' in req.body) {
    const date = String(req.body.date || '')
    if (!dateKeyPattern.test(date)) return res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'date is invalid' } })
    update.date = date
  }
  if ('color' in req.body) {
    const color = String(req.body.color || '')
    if (!colorPattern.test(color)) return res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'color is invalid' } })
    update.color = color
  }
  if ('notes' in req.body) update.notes = String(req.body.notes || '').trim()

  const item = await BloomPlan.findOneAndUpdate(
    { _id: id, userId: new Types.ObjectId(userId) },
    update,
    { new: true }
  ).lean()
  if (!item) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } })
  res.json({ success: true, data: item })
})

router.delete('/:id', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const id = req.params.id
  if (!Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, error: { code: 'INVALID_ID' } })

  await BloomPlan.findOneAndDelete({ _id: id, userId: new Types.ObjectId(userId) })
  res.json({ success: true, data: { id } })
})

export default router
