import { Router } from 'express'
import { Types } from 'mongoose'
import { requireAuth } from '../../middleware/auth.middleware'
import { Expense } from '../expenses/expense.model'
import { BudgetCategory } from '../budgets/budget.model'
import { Memento } from '../mementos/memento.model'
import { WeightEntry } from '../weights/weight.model'
import { Recipe } from '../recipes/recipe.model'
import { Sidequest } from '../sidequests/sidequest.model'

const router = Router()

router.use(requireAuth)

function getLagosMonthRange(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-NG', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(date)

  const year = Number(parts.find((part) => part.type === 'year')?.value)
  const month = Number(parts.find((part) => part.type === 'month')?.value) - 1

  return {
    first: new Date(Date.UTC(year, month, 1) - 60 * 60 * 1000),
    next: new Date(Date.UTC(year, month + 1, 1) - 60 * 60 * 1000),
  }
}

router.get('/overview', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const { first, next } = getLagosMonthRange()

  const userObjectId = new Types.ObjectId(userId)

  const [expenseAgg, budgetAgg, totalMementos, totalRecipes, totalSidequests, latestWeights] = await Promise.all([
    Expense.aggregate([
      { $match: { userId: userObjectId, expenseDate: { $gte: first, $lt: next } } },
      { $group: { _id: null, totalSpent: { $sum: '$amount' } } },
    ]),
    BudgetCategory.aggregate([
      { $match: { userId: userObjectId } },
      { $group: { _id: null, totalBudgeted: { $sum: '$monthlyBudget' } } },
    ]),
    Memento.countDocuments({ userId: userObjectId }),
    Recipe.countDocuments({ userId: userObjectId }),
    Sidequest.countDocuments({ userId: userObjectId }),
    WeightEntry.find({ userId: userObjectId }).sort({ entryDate: -1, createdAt: -1 }).limit(2).lean(),
  ])

  let weightProgressKg = 0
  if (latestWeights.length >= 2) {
    weightProgressKg = Number((latestWeights[0].weightKg - latestWeights[1].weightKg).toFixed(2))
  }

  res.json({
    success: true,
    data: {
      totalSpent: expenseAgg[0]?.totalSpent || 0,
      totalBudgeted: budgetAgg[0]?.totalBudgeted || 0,
      mementosAdded: totalMementos,
      weightProgressKg,
      newRecipes: totalRecipes,
      totalRecipes,
      totalSidequests,
    },
  })
})

router.get('/recent-expenses', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const limit = Math.min(Number(req.query.limit) || 4, 20)
  const items = await Expense.find({ userId: new Types.ObjectId(userId) }).sort({ expenseDate: -1 }).limit(limit).lean()

  res.json({ success: true, data: items })
})

router.get('/recent-mementos', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const limit = Math.min(Number(req.query.limit) || 3, 20)
  const items = await Memento.find({ userId: new Types.ObjectId(userId) }).sort({ createdAt: -1 }).limit(limit).lean()

  res.json({ success: true, data: items })
})

export default router
