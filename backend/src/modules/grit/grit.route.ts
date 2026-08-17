import { Router } from 'express'
import { Types } from 'mongoose'
import { requireAuth } from '../../middleware/auth.middleware'
import { GritChallenge } from './gritChallenge.model'

const router = Router()
const dateKeyPattern = /^\d{4}-\d{2}-\d{2}$/

router.use(requireAuth)

function getUserObjectId(userId?: string) {
  return userId ? new Types.ObjectId(userId) : null
}

function toDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00`)
  date.setDate(date.getDate() + days)
  return toDateKey(date)
}

function isChallengeActive(challenge: { startDate: string; durationDays: number; status: string }) {
  if (challenge.status !== 'active') return false
  const today = toDateKey(new Date())
  const endDate = addDays(challenge.startDate, challenge.durationDays - 1)
  return challenge.startDate <= today && today <= endDate
}

function normalizeFrequency(input: unknown) {
  const value = String(input || '').toLowerCase()
  if (value === 'weekly' || value === 'monthly') return value
  return 'daily'
}

function normalizeTarget(frequency: string, input: unknown) {
  const value = Math.max(1, Math.floor(Number(input) || 1))
  return frequency === 'daily' ? 1 : value
}

function sanitizeGoals(input: unknown) {
  if (!Array.isArray(input)) return []
  return input
    .map((item, index) => {
      const goal = item as { id?: string; title?: string; notes?: string }
      const title = String(goal?.title || '').trim()
      if (!title) return null
      return {
        id: String(goal?.id || `goal-${Date.now()}-${index}`),
        title,
        notes: String(goal?.notes || '').trim(),
      }
    })
    .filter((item): item is { id: string; title: string; notes: string } => Boolean(item))
}

function sanitizeTasks(input: unknown) {
  if (!Array.isArray(input)) return []
  return input
    .map((item, index) => {
      const task = item as { id?: string; goalId?: string; title?: string; frequency?: string; target?: number }
      const title = String(task?.title || '').trim()
      if (!title) return null
      const frequency = normalizeFrequency(task?.frequency)
      return {
        id: String(task?.id || `task-${Date.now()}-${index}`),
        goalId: String(task?.goalId || ''),
        title,
        frequency,
        target: normalizeTarget(frequency, task?.target),
      }
    })
    .filter((item): item is { id: string; goalId: string; title: string; frequency: string; target: number } => Boolean(item))
}

function normalizeCompletedTaskIds(input: unknown, allowedIds: string[]) {
  if (!Array.isArray(input)) return []
  const allowed = new Set(allowedIds)
  return Array.from(new Set(input.map(String).filter((id) => allowed.has(id))))
}

function normalizeCheckIns(input: unknown, allowedIds: string[]) {
  if (!Array.isArray(input)) return []
  const allowed = new Set(allowedIds)
  const seen = new Set<string>()
  return input
    .map((item, index) => {
      const checkIn = item as { id?: string; taskId?: string; createdAt?: string }
      const taskId = String(checkIn?.taskId || '')
      if (!allowed.has(taskId)) return null
      if (seen.has(taskId)) return null
      seen.add(taskId)
      return {
        id: String(checkIn?.id || `check-${Date.now()}-${index}`),
        taskId,
        createdAt: String(checkIn?.createdAt || new Date().toISOString()),
      }
    })
    .filter((item): item is { id: string; taskId: string; createdAt: string } => Boolean(item))
}

function normalizeNotes(input: unknown) {
  if (typeof input === 'string') {
    const text = input.trim()
    return text ? [{ id: `note-${Date.now()}`, text, createdAt: new Date().toISOString() }] : []
  }
  if (!Array.isArray(input)) return []
  return input
    .map((item, index) => {
      const note = item as { id?: string; text?: string; createdAt?: string }
      const text = String(note?.text || '').trim()
      if (!text) return null
      return {
        id: String(note?.id || `note-${Date.now()}-${index}`),
        text,
        createdAt: String(note?.createdAt || new Date().toISOString()),
      }
    })
    .filter((item): item is { id: string; text: string; createdAt: string } => Boolean(item))
}

router.get('/', async (req, res) => {
  const userObjectId = getUserObjectId(req.auth?.userId)
  if (!userObjectId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const items = await GritChallenge.find({ userId: userObjectId }).sort({ createdAt: -1 }).lean()
  res.json({ success: true, data: items })
})

router.get('/active', async (req, res) => {
  const userObjectId = getUserObjectId(req.auth?.userId)
  if (!userObjectId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const activeItems = await GritChallenge.find({ userId: userObjectId, status: 'active' }).sort({ createdAt: -1 }).lean()
  const activeChallenge = activeItems.find(isChallengeActive) || activeItems[0] || null
  res.json({ success: true, data: activeChallenge })
})

router.post('/', async (req, res) => {
  const userObjectId = getUserObjectId(req.auth?.userId)
  if (!userObjectId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const title = String(req.body?.title || '').trim()
  const startDate = String(req.body?.startDate || '')
  const durationDays = Math.max(1, Math.floor(Number(req.body?.durationDays) || 0))
  const goals = sanitizeGoals(req.body?.goals)
  const tasks = sanitizeTasks(req.body?.tasks)

  if (!title || !dateKeyPattern.test(startDate) || durationDays < 1 || goals.length < 1 || tasks.length < 1) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'title, start date, duration, goals and tasks are required' } })
  }

  const item = await GritChallenge.create({
    userId: userObjectId,
    title,
    startDate,
    durationDays,
    goals,
    tasks,
    dailyLogs: [],
    status: 'active',
  })
  res.status(201).json({ success: true, data: item })
})

router.patch('/:id', async (req, res) => {
  const userObjectId = getUserObjectId(req.auth?.userId)
  if (!userObjectId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })
  if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, error: { code: 'INVALID_ID' } })

  const current = await GritChallenge.findOne({ _id: req.params.id, userId: userObjectId }).lean()
  if (!current) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } })

  const update: Partial<{ title: string; startDate: string; durationDays: number; goals: ReturnType<typeof sanitizeGoals>; tasks: ReturnType<typeof sanitizeTasks>; status: string }> = {}
  if ('title' in req.body) {
    const title = String(req.body.title || '').trim()
    if (!title) return res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'title is required' } })
    update.title = title
  }
  if ('startDate' in req.body) {
    const startDate = String(req.body.startDate || '')
    if (!dateKeyPattern.test(startDate)) return res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'start date is invalid' } })
    update.startDate = startDate
  }
  if ('durationDays' in req.body) {
    const durationDays = Math.max(1, Math.floor(Number(req.body.durationDays) || 0))
    if (durationDays < 1) return res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'duration is required' } })
    update.durationDays = durationDays
  }
  if ('goals' in req.body) {
    const goals = sanitizeGoals(req.body.goals)
    if (!goals.length) return res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'at least one goal is required' } })
    update.goals = goals
  }
  if ('tasks' in req.body) {
    const tasks = sanitizeTasks(req.body.tasks)
    if (!tasks.length) return res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'at least one task is required' } })
    update.tasks = tasks
  }
  if ('status' in req.body) {
    const status = String(req.body.status || '')
    if (!['active', 'completed', 'archived'].includes(status)) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'status is invalid' } })
    }
    update.status = status
  }

  const item = await GritChallenge.findOneAndUpdate({ _id: req.params.id, userId: userObjectId }, update, { new: true }).lean()
  res.json({ success: true, data: item })
})

router.patch('/:id/days/:date', async (req, res) => {
  const userObjectId = getUserObjectId(req.auth?.userId)
  if (!userObjectId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })
  if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, error: { code: 'INVALID_ID' } })
  if (!dateKeyPattern.test(req.params.date)) return res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'date must be YYYY-MM-DD' } })

  const item = await GritChallenge.findOne({ _id: req.params.id, userId: userObjectId })
  if (!item) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } })

  const body = req.body || {}
  const taskIds = item.tasks.map((task) => task.id)
  const checkIns = 'checkIns' in body
    ? normalizeCheckIns(req.body?.checkIns, taskIds)
    : normalizeCompletedTaskIds(req.body?.completedTaskIds, taskIds).map((taskId, index) => ({
        id: `check-${Date.now()}-${index}`,
        taskId,
        createdAt: new Date().toISOString(),
      }))
  const completedTaskIds = Array.from(new Set(checkIns.map((checkIn) => checkIn.taskId)))
  const notes = normalizeNotes(req.body?.notes)
  const existingLog = item.dailyLogs.find((log) => log.date === req.params.date)

  if (existingLog) {
    existingLog.completedTaskIds = completedTaskIds
    existingLog.checkIns = checkIns
    existingLog.notes = notes
  } else {
    item.dailyLogs.push({ date: req.params.date, completedTaskIds, checkIns, notes })
  }

  await item.save()
  res.json({ success: true, data: item })
})

router.delete('/:id', async (req, res) => {
  const userObjectId = getUserObjectId(req.auth?.userId)
  if (!userObjectId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })
  if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, error: { code: 'INVALID_ID' } })

  await GritChallenge.findOneAndDelete({ _id: req.params.id, userId: userObjectId })
  res.json({ success: true, data: { id: req.params.id } })
})

export default router
