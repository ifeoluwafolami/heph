import { Router } from 'express'
import { Types } from 'mongoose'
import { requireAuth } from '../../middleware/auth.middleware'
import { Goal } from '../goals/goal.model'
import { Habit } from './habit.model'

type HabitFrequency = 'daily' | 'weekly' | 'monthly'

const router = Router()
const dateKeyPattern = /^\d{4}-\d{2}-\d{2}$/

router.use(requireAuth)

function normalizeFrequency(input: unknown): HabitFrequency {
  const value = String(input || '').toLowerCase()
  if (value === 'weekly' || value === 'monthly') return value
  return 'daily'
}

function normalizeTarget(frequency: HabitFrequency, input: unknown) {
  const value = Math.max(1, Math.floor(Number(input) || 1))
  return frequency === 'daily' ? 1 : value
}

function normalizeLogs(input: unknown) {
  if (!Array.isArray(input)) return []
  return Array.from(new Set(input.map(String).filter((date) => dateKeyPattern.test(date))))
}

async function normalizeGoalId(input: unknown, userId: string) {
  const value = String(input || '').trim()
  if (!value) return null
  if (!Types.ObjectId.isValid(value)) return null
  const goal = await Goal.findOne({ _id: value, userId: new Types.ObjectId(userId) }).select('_id').lean()
  return goal ? new Types.ObjectId(value) : null
}

router.get('/', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const items = await Habit.find({ userId: new Types.ObjectId(userId) }).sort({ createdAt: -1 }).lean()
  res.json({ success: true, data: items })
})

router.post('/', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const title = String(req.body?.title || '').trim()
  if (!title) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'title is required' } })
  }

  const frequency = normalizeFrequency(req.body?.frequency)
  const item = new Habit({
    userId: new Types.ObjectId(userId),
    goalId: await normalizeGoalId(req.body?.goalId, userId),
    title,
    frequency,
    target: normalizeTarget(frequency, req.body?.target),
    logs: normalizeLogs(req.body?.logs),
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
  const update: Partial<{ title: string; frequency: HabitFrequency; target: number; logs: string[]; goalId: Types.ObjectId | null }> = {}
  if ('title' in body) {
    const title = String(body.title || '').trim()
    if (!title) return res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'title is required' } })
    update.title = title
  }

  const current = await Habit.findOne({ _id: id, userId: new Types.ObjectId(userId) }).lean()
  if (!current) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } })

  const frequency = 'frequency' in body ? normalizeFrequency(body.frequency) : (current.frequency as HabitFrequency)
  update.frequency = frequency
  if ('target' in body || 'frequency' in body) update.target = normalizeTarget(frequency, body.target ?? current.target)
  if ('logs' in body) update.logs = normalizeLogs(body.logs)
  if ('goalId' in body) update.goalId = await normalizeGoalId(body.goalId, userId)

  const item = await Habit.findOneAndUpdate({ _id: id, userId: new Types.ObjectId(userId) }, update, { new: true }).lean()
  res.json({ success: true, data: item })
})

router.patch('/:id/toggle-log', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const id = req.params.id
  if (!Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, error: { code: 'INVALID_ID' } })

  const date = String(req.body?.date || '')
  if (!dateKeyPattern.test(date)) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'date must be YYYY-MM-DD' } })
  }

  const item = await Habit.findOne({ _id: id, userId: new Types.ObjectId(userId) })
  if (!item) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } })

  item.logs = item.logs.includes(date) ? item.logs.filter((log) => log !== date) : [...item.logs, date]
  await item.save()
  res.json({ success: true, data: item })
})

router.delete('/:id', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const id = req.params.id
  if (!Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, error: { code: 'INVALID_ID' } })

  await Habit.findOneAndDelete({ _id: id, userId: new Types.ObjectId(userId) })
  res.json({ success: true, data: { id } })
})

export default router
