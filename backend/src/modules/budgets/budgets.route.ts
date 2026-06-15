import { Router } from 'express'
import { BudgetCategory } from './budget.model'
import { Expense } from '../expenses/expense.model'
import { Types } from 'mongoose'
import { requireAuth } from '../../middleware/auth.middleware'

const router = Router()

router.use(requireAuth)

function getLagosMonthRange(monthInput?: string) {
  let year: number
  let month: number

  if (monthInput && /^\d{4}-\d{2}$/.test(monthInput)) {
    const [rawYear, rawMonth] = monthInput.split('-')
    year = Number(rawYear)
    month = Number(rawMonth) - 1
  } else {
    const parts = new Intl.DateTimeFormat('en-NG', {
      timeZone: 'Africa/Lagos',
      year: 'numeric',
      month: 'numeric',
    }).formatToParts(new Date())
    year = Number(parts.find((part) => part.type === 'year')?.value)
    month = Number(parts.find((part) => part.type === 'month')?.value) - 1
  }

  return {
    first: new Date(Date.UTC(year, month, 1) - 60 * 60 * 1000),
    next: new Date(Date.UTC(year, month + 1, 1) - 60 * 60 * 1000),
    monthKey: `${year}-${String(month + 1).padStart(2, '0')}`,
  }
}

router.get('/', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  // pagination
  const limit = Math.min(Number(req.query.limit) || 50, 200)
  const page = Math.max(Number(req.query.page) || 1, 1)
  const skip = (page - 1) * limit

  // compute spentAmount for the current month for each budget category
  const total = await BudgetCategory.countDocuments({ userId: new Types.ObjectId(userId) })
  const items = await BudgetCategory.find({ userId: new Types.ObjectId(userId) }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean()
  const { first, next } = getLagosMonthRange()

  const agg = await Expense.aggregate([
    { $match: { userId: new Types.ObjectId(userId), expenseDate: { $gte: first, $lt: next } } },
    { $group: { _id: '$categoryId', total: { $sum: '$amount' } } },
  ])

  const map = new Map<string, number>()
  agg.forEach((a: any) => {
    if (a._id) map.set(String(a._id), a.total || 0)
  })

  const withSpent = items.map((it: any) => ({
    ...it,
    spentAmount: map.get(String(it._id)) || 0,
  }))

  res.json({ success: true, data: withSpent, meta: { total, page, limit } })
})

router.get('/history', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const { first, next, monthKey } = getLagosMonthRange(typeof req.query.month === 'string' ? req.query.month : undefined)
  const userObjectId = new Types.ObjectId(userId)
  const categories = await BudgetCategory.find({ userId: userObjectId }).sort({ createdAt: -1 }).lean()
  const agg = await Expense.aggregate([
    { $match: { userId: userObjectId, expenseDate: { $gte: first, $lt: next } } },
    { $group: { _id: '$categoryId', total: { $sum: '$amount' } } },
  ])

  const map = new Map<string, number>()
  agg.forEach((a: any) => {
    if (a._id) map.set(String(a._id), a.total || 0)
  })

  const categoriesWithSpent = categories.map((category: any) => ({
    _id: category._id,
    name: category.name,
    monthlyBudget: category.monthlyBudget,
    spentAmount: map.get(String(category._id)) || 0,
  }))
  const totalSpent = categoriesWithSpent.reduce((sum, category) => sum + category.spentAmount, 0)
  const totalBudgeted = categoriesWithSpent.reduce((sum, category) => sum + category.monthlyBudget, 0)

  res.json({
    success: true,
    data: {
      month: monthKey,
      totalSpent,
      totalBudgeted,
      categories: categoriesWithSpent,
    },
  })
})

router.post('/', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const { name, monthlyBudget } = req.body as { name: string; monthlyBudget: number }
  if (!name || typeof monthlyBudget !== 'number' || monthlyBudget < 0) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'name and monthlyBudget are required' } })
  }

  // Use findOneAndUpdate + upsert to avoid duplicate creates. If already exists, return existing.
  try {
    const doc = await BudgetCategory.findOneAndUpdate(
      { userId: new Types.ObjectId(userId), name },
      { $setOnInsert: { monthlyBudget } },
      { upsert: true, new: true }
    ).lean()
    res.status(201).json({ success: true, data: doc })
  } catch (err: any) {
    // handle duplicate key race (should be rare) by returning existing doc
    if (err?.code === 11000) {
      const existing = await BudgetCategory.findOne({ userId: new Types.ObjectId(userId), name }).lean()
      return res.status(200).json({ success: true, data: existing })
    }
    throw err
  }
})

router.patch('/bulk', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const items = (req.body.items || []) as Array<{ id: string; monthlyBudget: number }>
  const ops = items
    .filter((it) => Types.ObjectId.isValid(it.id))
    .map((it) => ({
      updateOne: {
        // use string ids in the filter so Mongoose can cast them; this keeps TS happy
        filter: { _id: it.id, userId },
        update: { $set: { monthlyBudget: it.monthlyBudget } },
      },
    }))
  if (ops.length) await BudgetCategory.bulkWrite(ops as any)
  res.json({ success: true, data: { updated: ops.length } })
})

router.patch('/:id', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const id = req.params.id
  if (!Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, error: { code: 'INVALID_ID' } })
  const updated = await BudgetCategory.findOneAndUpdate({ _id: id, userId: new Types.ObjectId(userId) }, req.body, { new: true }).lean()
  if (!updated) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } })
  res.json({ success: true, data: updated })
})

router.delete('/:id', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const id = req.params.id
  if (!Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, error: { code: 'INVALID_ID' } })
  const deleted = await BudgetCategory.findOneAndDelete({ _id: id, userId: new Types.ObjectId(userId) })
  if (deleted) {
    // remove any expenses tied to this category for the same user
    await Expense.deleteMany({ categoryId: id, userId: new Types.ObjectId(userId) })
  }
  res.json({ success: true, data: { id, deleted: !!deleted } })
})

// POST /budgets/:id/log-expense -> create Expense and update category spentAmount
router.post('/:id/log-expense', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const id = req.params.id
  const { title, amount, currency, expenseDate, note } = req.body as {
    title: string
    amount: number
    currency?: string
    expenseDate: string
    note?: string
  }
  if (!Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, error: { code: 'INVALID_ID' } })

  const cat = await BudgetCategory.findOne({ _id: id, userId: new Types.ObjectId(userId) })
  if (!cat) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } })

  const e = new Expense({
    title,
    amount,
    currency: currency || 'NGN',
    categoryId: id,
    expenseDate: new Date(expenseDate),
    userId: new Types.ObjectId(userId),
    note,
  })
  await e.save()

  // We compute spentAmount on read (per-month), so avoid mutating stored spentAmount here.
  res.status(201).json({ success: true, data: { expense: e, category: cat } })
})

export default router
