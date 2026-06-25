import { Router } from 'express'
import { Types } from 'mongoose'
import { requireAuth } from '../../middleware/auth.middleware'
import { FoodPlanEntry, FoodPlanSettings } from './foodPlan.model'

const router = Router()
const dateKeyPattern = /^\d{4}-\d{2}-\d{2}$/
const mealTypes = new Set(['breakfast', 'brunch', 'lunch', 'preworkout', 'snack', 'dinner'])

router.use(requireAuth)

router.get('/settings', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const settings = await FoodPlanSettings.findOneAndUpdate(
    { userId: new Types.ObjectId(userId) },
    { $setOnInsert: { dailyCalorieTarget: 2000 } },
    { new: true, upsert: true }
  ).lean()
  res.json({ success: true, data: settings })
})

router.patch('/settings', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const dailyCalorieTarget = Number(req.body?.dailyCalorieTarget)
  if (!Number.isFinite(dailyCalorieTarget) || dailyCalorieTarget < 0) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'dailyCalorieTarget must be zero or greater' } })
  }

  const settings = await FoodPlanSettings.findOneAndUpdate(
    { userId: new Types.ObjectId(userId) },
    { dailyCalorieTarget },
    { new: true, upsert: true }
  ).lean()
  res.json({ success: true, data: settings })
})

router.get('/', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const query: Record<string, unknown> = { userId: new Types.ObjectId(userId) }
  if (typeof req.query.start === 'string' && dateKeyPattern.test(req.query.start) && typeof req.query.end === 'string' && dateKeyPattern.test(req.query.end)) {
    query.date = { $gte: req.query.start, $lte: req.query.end }
  }

  const items = await FoodPlanEntry.find(query).sort({ date: 1, createdAt: 1 }).lean()
  res.json({ success: true, data: items })
})

router.post('/', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const date = String(req.body?.date || '')
  const meal = String(req.body?.meal || '')
  const food = String(req.body?.food || '').trim()
  const calories = Number(req.body?.calories)
  const recipeId = String(req.body?.recipeId || '')

  if (!dateKeyPattern.test(date) || !mealTypes.has(meal) || !food || !Number.isFinite(calories) || calories < 0) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'date, meal, food and calories are required' } })
  }

  const item = await FoodPlanEntry.create({
    userId: new Types.ObjectId(userId),
    date,
    meal,
    food,
    calories,
    recipeId: Types.ObjectId.isValid(recipeId) ? new Types.ObjectId(recipeId) : undefined,
  })
  res.status(201).json({ success: true, data: item })
})

router.delete('/:id', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const id = req.params.id
  if (!Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, error: { code: 'INVALID_ID' } })

  await FoodPlanEntry.findOneAndDelete({ _id: id, userId: new Types.ObjectId(userId) })
  res.json({ success: true, data: { id } })
})

export default router
