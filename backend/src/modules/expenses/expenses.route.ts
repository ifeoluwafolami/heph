import { Router } from 'express'
import { Expense } from './expense.model'
import { BudgetCategory } from '../budgets/budget.model'
import { Types } from 'mongoose'
import { requireAuth } from '../../middleware/auth.middleware'

const router = Router()

router.use(requireAuth)

// GET /expenses?limit=&page=&from=&to=&categoryId=
router.get('/', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const limit = Math.min(Number(req.query.limit) || 20, 200)
  const page = Math.max(Number(req.query.page) || 1, 1)
  const skip = (page - 1) * limit

  const q: Record<string, unknown> = { userId }
  if (req.query.categoryId) q.categoryId = req.query.categoryId
  if (req.query.from || req.query.to) {
    const expenseDate: { $gte?: Date; $lte?: Date } = {}
    if (req.query.from) expenseDate.$gte = new Date(String(req.query.from))
    if (req.query.to) expenseDate.$lte = new Date(String(req.query.to))
    q.expenseDate = expenseDate
  }

  const total = await Expense.countDocuments(q)
  const items = await Expense.find(q).sort({ expenseDate: -1 }).skip(skip).limit(limit).lean()
  res.json({ success: true, data: items, meta: { total, page, limit } })
})

router.get('/summary', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  // summary for current month if not provided
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  const agg = await Expense.aggregate([
    { $match: { userId: new Types.ObjectId(userId), expenseDate: { $gte: first, $lte: last } } },
    { $group: { _id: null, totalSpent: { $sum: '$amount' }, count: { $sum: 1 } } },
  ])

  const budgetAgg = await BudgetCategory.aggregate([
    { $match: { userId: new Types.ObjectId(userId) } },
    { $group: { _id: null, totalBudgeted: { $sum: '$monthlyBudget' } } },
  ])

  const totalSpent = agg[0]?.totalSpent || 0
  const totalBudgeted = budgetAgg[0]?.totalBudgeted || 0
  res.json({
    success: true,
    data: {
      totalSpent,
      totalBudgeted,
      remaining: totalBudgeted - totalSpent,
      count: agg[0]?.count || 0,
    },
  })
})

router.post('/', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const { title, amount, currency, categoryId, categoryName, expenseDate, note } = req.body as {
    title: string
    amount: number
    currency?: string
    categoryId?: string
    categoryName?: string
    expenseDate: string
    note?: string
  }

  if (!title || !amount || !expenseDate) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'title, amount and expenseDate are required' } })
  }

  let finalCategoryId = categoryId || null
  if (!finalCategoryId && categoryName) {
    const cat = await BudgetCategory.findOneAndUpdate(
      { name: categoryName, userId },
      { $setOnInsert: { monthlyBudget: 0 } },
      { upsert: true, new: true }
    )
    finalCategoryId = cat? String(cat._id) : null
  }

  const e = new Expense({
    title,
    amount,
    currency: currency || 'NGN',
    categoryId: finalCategoryId,
    expenseDate: new Date(expenseDate),
    note,
    userId,
  })
  await e.save()
  res.status(201).json({ success: true, data: e })
})

router.get('/:id', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const id = req.params.id
  if (!Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, error: { code: 'INVALID_ID' } })
  const e = await Expense.findOne({ _id: id, userId: new Types.ObjectId(userId) }).lean()
  if (!e) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } })
  res.json({ success: true, data: e })
})

router.patch('/:id', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const id = req.params.id
  if (!Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, error: { code: 'INVALID_ID' } })
  const update = req.body as Record<string, unknown>
  if (update.expenseDate) update.expenseDate = new Date(String(update.expenseDate))
  const e = await Expense.findOneAndUpdate({ _id: id, userId: new Types.ObjectId(userId) }, update, { new: true }).lean()
  if (!e) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } })
  res.json({ success: true, data: e })
})

router.delete('/:id', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const id = req.params.id
  if (!Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, error: { code: 'INVALID_ID' } })
  await Expense.findOneAndDelete({ _id: id, userId: new Types.ObjectId(userId) })
  res.json({ success: true, data: { id } })
})

export default router
