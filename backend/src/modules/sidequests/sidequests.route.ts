import { Router } from 'express'
import { Sidequest } from './sidequest.model'
import { Types } from 'mongoose'
import { requireAuth } from '../../middleware/auth.middleware'

const router = Router()

router.use(requireAuth)

type MilestoneInput = {
  id?: string
  title?: string
  done?: boolean
  cost?: number
}

type SanitizedMilestone = { id: string; title: string; done: boolean; cost?: number }

function sanitizeMilestones(input: unknown): SanitizedMilestone[] {
  if (!Array.isArray(input)) return []
  return input
    .map((m, index) => {
      const item = m as MilestoneInput
      const title = String(item?.title || '').trim()
      if (!title) return null
      const id = String(item?.id || `ms-${Date.now()}-${index}`)
      const done = Boolean(item?.done)
      const cost = item?.cost === undefined ? undefined : Math.max(0, Number(item.cost) || 0)
      return cost === undefined ? { id, title, done } : { id, title, done, cost }
    })
    .filter((m): m is SanitizedMilestone => Boolean(m))
}

function getMilestoneCostTotal(milestones: SanitizedMilestone[]) {
  return milestones.reduce((sum, milestone) => sum + (milestone.cost || 0), 0)
}

// GET /sidequests?limit=&page=
router.get('/', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const limit = Math.min(Number(req.query.limit) || 20, 200)
  const page = Math.max(Number(req.query.page) || 1, 1)
  const skip = (page - 1) * limit

  const q: Record<string, unknown> = { userId }

  const total = await Sidequest.countDocuments(q)
  const items = await Sidequest.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit).lean()
  res.json({ success: true, data: items, meta: { total, page, limit } })
})

// POST /sidequests
router.post('/', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const { title, description, cost, completed, milestones } = req.body as {
    title: string
    description: string
    cost: number
    completed?: boolean
    milestones?: MilestoneInput[]
  }

  if (!title || !description || cost === undefined) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_INPUT' } })
  }

  try {
    let normalizedMilestones = sanitizeMilestones(milestones)
    if (completed !== undefined && normalizedMilestones.length > 0) {
      normalizedMilestones = normalizedMilestones.map((m) => ({ ...m, done: Boolean(completed) }))
    }
    const resolvedCompleted = normalizedMilestones.length > 0 ? normalizedMilestones.every((m) => m.done) : Boolean(completed)
    const resolvedCost = normalizedMilestones.length > 0 ? getMilestoneCostTotal(normalizedMilestones) : cost

    const sidequest = await Sidequest.create({
      userId: new Types.ObjectId(userId),
      title,
      description,
      cost: resolvedCost,
      completed: resolvedCompleted,
      milestones: normalizedMilestones,
    })
    res.status(201).json({ success: true, data: sidequest })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR' } })
  }
})

// GET /sidequests/:id
router.get('/:id', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  try {
    const sidequest = await Sidequest.findOne({
      _id: req.params.id,
      userId: new Types.ObjectId(userId),
    }).lean()

    if (!sidequest) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } })
    }

    res.json({ success: true, data: sidequest })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR' } })
  }
})

// PUT /sidequests/:id
router.put('/:id', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const { title, description, cost, completed, milestones } = req.body as {
    title?: string
    description?: string
    cost?: number
    completed?: boolean
    milestones?: MilestoneInput[]
  }

  if (!title && !description && cost === undefined && completed === undefined && milestones === undefined) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_INPUT' } })
  }

  try {
    const sidequest = await Sidequest.findOne({ _id: req.params.id, userId: new Types.ObjectId(userId) })

    if (!sidequest) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } })
    }

    let nextMilestones = sidequest.milestones as SanitizedMilestone[]
    if (milestones !== undefined) {
      nextMilestones = sanitizeMilestones(milestones)
    }

    if (completed !== undefined && nextMilestones.length > 0) {
      nextMilestones = nextMilestones.map((m) => ({ ...m, done: Boolean(completed) }))
    }

    const resolvedCompleted = nextMilestones.length > 0 ? nextMilestones.every((m) => m.done) : (completed ?? sidequest.completed)

    if (title) sidequest.title = title
    if (description) sidequest.description = description
    if (nextMilestones.length > 0) {
      sidequest.cost = getMilestoneCostTotal(nextMilestones)
    } else if (cost !== undefined) {
      sidequest.cost = cost
    }
    sidequest.milestones = nextMilestones as any
    sidequest.completed = Boolean(resolvedCompleted)

    await sidequest.save()

    res.json({ success: true, data: sidequest })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR' } })
  }
})

// DELETE /sidequests/:id
router.delete('/:id', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  try {
    const sidequest = await Sidequest.findOneAndDelete({
      _id: req.params.id,
      userId: new Types.ObjectId(userId),
    })

    if (!sidequest) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } })
    }

    res.json({ success: true, data: { message: 'Sidequest deleted' } })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR' } })
  }
})

export default router
