import { Router } from 'express'
import { Types } from 'mongoose'
import { requireAuth } from '../../middleware/auth.middleware'
import { BloomPlan } from './bloomPlan.model'
import { BloomCourse, BloomDeepDive } from './bloomLearning.model'

const router = Router()
const dateKeyPattern = /^\d{4}-\d{2}-\d{2}$/
const colorPattern = /^#[0-9a-fA-F]{6}$/

router.use(requireAuth)

function getUserObjectId(userId?: string) {
  return userId ? new Types.ObjectId(userId) : null
}

function sanitizeMinutes(value: unknown) {
  return Math.max(0, Math.round(Number(value) || 0))
}

function sanitizeReferences(input: unknown) {
  if (!Array.isArray(input)) return []
  return input
    .map((item, index) => {
      const ref = item as { id?: string; label?: string; url?: string }
      const url = String(ref?.url || '').trim()
      if (!url) return null
      return {
        id: String(ref?.id || `ref-${Date.now()}-${index}`),
        label: String(ref?.label || '').trim(),
        url,
      }
    })
    .filter((item): item is { id: string; label: string; url: string } => Boolean(item))
}

router.get('/courses', async (req, res) => {
  const userObjectId = getUserObjectId(req.auth?.userId)
  if (!userObjectId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const items = await BloomCourse.find({ userId: userObjectId }).sort({ createdAt: -1 }).lean()
  res.json({ success: true, data: items })
})

router.post('/courses', async (req, res) => {
  const userObjectId = getUserObjectId(req.auth?.userId)
  if (!userObjectId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const title = String(req.body?.title || '').trim()
  const durationMinutes = sanitizeMinutes(req.body?.durationMinutes)
  if (!title || durationMinutes < 1) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'title and duration are required' } })
  }

  const item = await BloomCourse.create({ userId: userObjectId, title, durationMinutes, logs: [] })
  res.status(201).json({ success: true, data: item })
})

router.patch('/courses/:id', async (req, res) => {
  const userObjectId = getUserObjectId(req.auth?.userId)
  if (!userObjectId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })
  if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, error: { code: 'INVALID_ID' } })

  const update: Partial<{ title: string; durationMinutes: number }> = {}
  if ('title' in req.body) {
    const title = String(req.body.title || '').trim()
    if (!title) return res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'title is required' } })
    update.title = title
  }
  if ('durationMinutes' in req.body) {
    const durationMinutes = sanitizeMinutes(req.body.durationMinutes)
    if (durationMinutes < 1) return res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'duration is required' } })
    update.durationMinutes = durationMinutes
  }

  const item = await BloomCourse.findOneAndUpdate({ _id: req.params.id, userId: userObjectId }, update, { new: true }).lean()
  if (!item) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } })
  res.json({ success: true, data: item })
})

router.post('/courses/:id/logs', async (req, res) => {
  const userObjectId = getUserObjectId(req.auth?.userId)
  if (!userObjectId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })
  if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, error: { code: 'INVALID_ID' } })

  const date = String(req.body?.date || '')
  const minutes = sanitizeMinutes(req.body?.minutes)
  if (!dateKeyPattern.test(date) || minutes < 1) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'date and minutes are required' } })
  }

  const item = await BloomCourse.findOneAndUpdate(
    { _id: req.params.id, userId: userObjectId },
    { $push: { logs: { id: `log-${Date.now()}`, date, minutes } } },
    { new: true }
  ).lean()
  if (!item) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } })
  res.status(201).json({ success: true, data: item })
})

router.delete('/courses/:id/logs/:logId', async (req, res) => {
  const userObjectId = getUserObjectId(req.auth?.userId)
  if (!userObjectId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })
  if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, error: { code: 'INVALID_ID' } })

  const item = await BloomCourse.findOneAndUpdate(
    { _id: req.params.id, userId: userObjectId },
    { $pull: { logs: { id: req.params.logId } } },
    { new: true }
  ).lean()
  if (!item) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } })
  res.json({ success: true, data: item })
})

router.delete('/courses/:id', async (req, res) => {
  const userObjectId = getUserObjectId(req.auth?.userId)
  if (!userObjectId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })
  if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, error: { code: 'INVALID_ID' } })

  await BloomCourse.findOneAndDelete({ _id: req.params.id, userId: userObjectId })
  res.json({ success: true, data: { id: req.params.id } })
})

router.get('/deep-dives', async (req, res) => {
  const userObjectId = getUserObjectId(req.auth?.userId)
  if (!userObjectId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const items = await BloomDeepDive.find({ userId: userObjectId }).sort({ createdAt: -1 }).lean()
  res.json({ success: true, data: items })
})

router.post('/deep-dives', async (req, res) => {
  const userObjectId = getUserObjectId(req.auth?.userId)
  if (!userObjectId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const topic = String(req.body?.topic || '').trim()
  if (!topic) return res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'topic is required' } })

  const item = await BloomDeepDive.create({
    userId: userObjectId,
    topic,
    tidbits: String(req.body?.tidbits || '').trim(),
    references: sanitizeReferences(req.body?.references),
    logs: [],
  })
  res.status(201).json({ success: true, data: item })
})

router.patch('/deep-dives/:id', async (req, res) => {
  const userObjectId = getUserObjectId(req.auth?.userId)
  if (!userObjectId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })
  if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, error: { code: 'INVALID_ID' } })

  const update: Partial<{ topic: string; tidbits: string; references: ReturnType<typeof sanitizeReferences> }> = {}
  if ('topic' in req.body) {
    const topic = String(req.body.topic || '').trim()
    if (!topic) return res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'topic is required' } })
    update.topic = topic
  }
  if ('tidbits' in req.body) update.tidbits = String(req.body.tidbits || '').trim()
  if ('references' in req.body) update.references = sanitizeReferences(req.body.references)

  const item = await BloomDeepDive.findOneAndUpdate({ _id: req.params.id, userId: userObjectId }, update, { new: true }).lean()
  if (!item) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } })
  res.json({ success: true, data: item })
})

router.post('/deep-dives/:id/logs', async (req, res) => {
  const userObjectId = getUserObjectId(req.auth?.userId)
  if (!userObjectId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })
  if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, error: { code: 'INVALID_ID' } })

  const date = String(req.body?.date || '')
  const minutes = sanitizeMinutes(req.body?.minutes)
  if (!dateKeyPattern.test(date) || minutes < 1) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'date and minutes are required' } })
  }

  const item = await BloomDeepDive.findOneAndUpdate(
    { _id: req.params.id, userId: userObjectId },
    { $push: { logs: { id: `log-${Date.now()}`, date, minutes } } },
    { new: true }
  ).lean()
  if (!item) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } })
  res.status(201).json({ success: true, data: item })
})

router.delete('/deep-dives/:id/logs/:logId', async (req, res) => {
  const userObjectId = getUserObjectId(req.auth?.userId)
  if (!userObjectId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })
  if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, error: { code: 'INVALID_ID' } })

  const item = await BloomDeepDive.findOneAndUpdate(
    { _id: req.params.id, userId: userObjectId },
    { $pull: { logs: { id: req.params.logId } } },
    { new: true }
  ).lean()
  if (!item) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } })
  res.json({ success: true, data: item })
})

router.delete('/deep-dives/:id', async (req, res) => {
  const userObjectId = getUserObjectId(req.auth?.userId)
  if (!userObjectId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })
  if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, error: { code: 'INVALID_ID' } })

  await BloomDeepDive.findOneAndDelete({ _id: req.params.id, userId: userObjectId })
  res.json({ success: true, data: { id: req.params.id } })
})

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
