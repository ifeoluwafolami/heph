import { Router } from 'express'
import { Types } from 'mongoose'
import { requireAuth } from '../../middleware/auth.middleware'
import { Habit } from '../habits/habit.model'
import { Goal } from './goal.model'

const router = Router()
const dateKeyPattern = /^\d{4}-\d{2}-\d{2}$/

router.use(requireAuth)

function normalizeStatus(input: unknown) {
  const value = String(input || '').toLowerCase()
  if (value === 'completed' || value === 'paused') return value
  return 'active'
}

router.get('/', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const items = await Goal.find({ userId: new Types.ObjectId(userId) }).sort({ createdAt: -1 }).lean()
  res.json({ success: true, data: items })
})

router.post('/', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const title = String(req.body?.title || '').trim()
  if (!title) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'title is required' } })
  }

  const targetDate = String(req.body?.targetDate || '').trim()
  if (targetDate && !dateKeyPattern.test(targetDate)) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'targetDate must be YYYY-MM-DD' } })
  }

  const item = new Goal({
    userId: new Types.ObjectId(userId),
    title,
    description: String(req.body?.description || '').trim(),
    status: normalizeStatus(req.body?.status),
    targetDate,
  })
  await item.save()
  res.status(201).json({ success: true, data: item })
})

router.put('/:id', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const id = req.params.id
  if (!Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, error: { code: 'INVALID_ID' } })

  const body = req.body || {}
  const update: Partial<{ title: string; description: string; status: string; targetDate: string }> = {}
  if ('title' in body) {
    const title = String(body.title || '').trim()
    if (!title) return res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'title is required' } })
    update.title = title
  }
  if ('description' in body) update.description = String(body.description || '').trim()
  if ('status' in body) update.status = normalizeStatus(body.status)
  if ('targetDate' in body) {
    const targetDate = String(body.targetDate || '').trim()
    if (targetDate && !dateKeyPattern.test(targetDate)) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'targetDate must be YYYY-MM-DD' } })
    }
    update.targetDate = targetDate
  }

  const item = await Goal.findOneAndUpdate({ _id: id, userId: new Types.ObjectId(userId) }, update, { new: true }).lean()
  if (!item) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } })
  res.json({ success: true, data: item })
})

router.delete('/:id', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const id = req.params.id
  if (!Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, error: { code: 'INVALID_ID' } })

  await Goal.findOneAndDelete({ _id: id, userId: new Types.ObjectId(userId) })
  await Habit.updateMany({ goalId: id, userId: new Types.ObjectId(userId) }, { $set: { goalId: null } })
  res.json({ success: true, data: { id } })
})

export default router
