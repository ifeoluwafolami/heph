import { Router } from 'express'
import { Types } from 'mongoose'
import { requireAuth } from '../../middleware/auth.middleware'
import { Recipe } from './recipe.model'

const router = Router()

router.use(requireAuth)

router.get('/', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const limit = Math.min(Number(req.query.limit) || 50, 200)
  const page = Math.max(Number(req.query.page) || 1, 1)
  const skip = (page - 1) * limit
  const total = await Recipe.countDocuments({ userId: new Types.ObjectId(userId) })
  const items = await Recipe.find({ userId: new Types.ObjectId(userId) }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean()
  res.json({ success: true, data: items, meta: { total, page, limit } })
})

router.post('/', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const { title, servings, caloriesPerServing, notes } = req.body as {
    title: string
    servings: number
    caloriesPerServing: number
    notes?: string
  }

  if (!title || typeof servings !== 'number' || typeof caloriesPerServing !== 'number') {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'title, servings and caloriesPerServing are required' } })
  }

  const item = new Recipe({ userId: new Types.ObjectId(userId), title, servings, caloriesPerServing, notes: notes || '' })
  await item.save()
  res.status(201).json({ success: true, data: item })
})

router.patch('/:id', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const id = req.params.id
  if (!Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, error: { code: 'INVALID_ID' } })

  const item = await Recipe.findOneAndUpdate({ _id: id, userId: new Types.ObjectId(userId) }, req.body, { new: true }).lean()
  if (!item) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } })
  res.json({ success: true, data: item })
})

router.delete('/:id', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const id = req.params.id
  if (!Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, error: { code: 'INVALID_ID' } })

  await Recipe.findOneAndDelete({ _id: id, userId: new Types.ObjectId(userId) })
  res.json({ success: true, data: { id } })
})

export default router
