import { Router } from 'express'
import { Types } from 'mongoose'
import { requireAuth } from '../../middleware/auth.middleware'
import { Expense } from '../expenses/expense.model'
import { BudgetCategory } from '../budgets/budget.model'
import { Memento } from '../mementos/memento.model'
import { WeightEntry } from '../weights/weight.model'
import { Recipe } from '../recipes/recipe.model'

const router = Router()

router.use(requireAuth)

router.get('/overview', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  const userObjectId = new Types.ObjectId(userId)

  const [expenseAgg, budgetAgg, mementosAdded, recipesAdded, latestWeights] = await Promise.all([
    Expense.aggregate([
      { $match: { userId: userObjectId, expenseDate: { $gte: first, $lte: last } } },
      { $group: { _id: null, totalSpent: { $sum: '$amount' } } },
    ]),
    BudgetCategory.aggregate([
      { $match: { userId: userObjectId } },
      { $group: { _id: null, totalBudgeted: { $sum: '$monthlyBudget' } } },
    ]),
    Memento.countDocuments({ userId: userObjectId, createdAt: { $gte: first, $lte: last } }),
    Recipe.countDocuments({ userId: userObjectId, createdAt: { $gte: first, $lte: last } }),
    WeightEntry.find({ userId: userObjectId }).sort({ entryDate: -1 }).limit(2).lean(),
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
      mementosAdded,
      weightProgressKg,
      newRecipes: recipesAdded,
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
