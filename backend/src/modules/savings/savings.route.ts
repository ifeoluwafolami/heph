import { Router } from 'express'
import { Types } from 'mongoose'
import { requireAuth } from '../../middleware/auth.middleware'
import { SavingsTarget } from './savingsTarget.model'

const router = Router()
const dateKeyPattern = /^\d{4}-\d{2}-\d{2}$/

router.use(requireAuth)

function normalizeTransactions(input: unknown) {
  if (!Array.isArray(input)) return []
  return input
    .map((transaction) => ({
      id: String(transaction?.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`),
      type: transaction?.type === 'withdraw' ? 'withdraw' : 'deposit',
      amount: Math.max(0, Number(transaction?.amount) || 0),
      date: dateKeyPattern.test(String(transaction?.date || '')) ? String(transaction.date) : new Date().toISOString().slice(0, 10),
    }))
    .filter((transaction) => transaction.amount > 0)
}

function getSavedAmount(target: { transactions?: Array<{ type: string; amount: number }> }) {
  return (target.transactions || []).reduce((sum, transaction) => sum + (transaction.type === 'deposit' ? transaction.amount : -transaction.amount), 0)
}

function currentMonthKey() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date())
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  return `${year}-${month}`
}

router.get('/', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const items = await SavingsTarget.find({ userId: new Types.ObjectId(userId) }).sort({ createdAt: -1 }).lean()
  res.json({ success: true, data: items })
})

router.get('/summary', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const month = typeof req.query.month === 'string' && /^\d{4}-\d{2}$/.test(req.query.month) ? req.query.month : currentMonthKey()
  const items = await SavingsTarget.find({ userId: new Types.ObjectId(userId) }).lean()
  const totalSaved = items.reduce((sum, target) => sum + getSavedAmount(target), 0)
  const totalSavedThisMonth = items.reduce((sum, target) => {
    return sum + (target.transactions || [])
      .filter((transaction) => transaction.date.slice(0, 7) === month)
      .reduce((monthSum, transaction) => monthSum + (transaction.type === 'deposit' ? transaction.amount : -transaction.amount), 0)
  }, 0)

  res.json({ success: true, data: { totalSaved, totalSavedThisMonth } })
})

router.post('/', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const title = String(req.body?.title || '').trim()
  const targetAmount = Number(req.body?.targetAmount)
  if (!title || !Number.isFinite(targetAmount) || targetAmount <= 0) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'title and targetAmount are required' } })
  }

  const item = new SavingsTarget({
    userId: new Types.ObjectId(userId),
    title,
    targetAmount,
    transactions: normalizeTransactions(req.body?.transactions),
  })
  await item.save()
  res.status(201).json({ success: true, data: item })
})

router.patch('/:id', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const id = req.params.id
  if (!Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, error: { code: 'INVALID_ID' } })

  const update: Partial<{ title: string; targetAmount: number }> = {}
  if ('title' in req.body) {
    const title = String(req.body.title || '').trim()
    if (!title) return res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'title is required' } })
    update.title = title
  }
  if ('targetAmount' in req.body) {
    const targetAmount = Number(req.body.targetAmount)
    if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'targetAmount must be positive' } })
    }
    update.targetAmount = targetAmount
  }

  const item = await SavingsTarget.findOneAndUpdate({ _id: id, userId: new Types.ObjectId(userId) }, update, { new: true }).lean()
  if (!item) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } })
  res.json({ success: true, data: item })
})

router.post('/:id/transactions', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const id = req.params.id
  if (!Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, error: { code: 'INVALID_ID' } })

  const amount = Number(req.body?.amount)
  const type = req.body?.type === 'withdraw' ? 'withdraw' : 'deposit'
  const date = dateKeyPattern.test(String(req.body?.date || '')) ? String(req.body.date) : new Date().toISOString().slice(0, 10)
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'amount must be positive' } })
  }

  const item = await SavingsTarget.findOne({ _id: id, userId: new Types.ObjectId(userId) })
  if (!item) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } })

  const savedAmount = getSavedAmount(item)
  const safeAmount = type === 'withdraw' ? Math.min(amount, savedAmount) : amount
  if (safeAmount <= 0) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'nothing available to withdraw' } })
  }

  item.transactions.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type,
    amount: safeAmount,
    date,
  })
  await item.save()
  res.json({ success: true, data: item })
})

router.delete('/:id', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const id = req.params.id
  if (!Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, error: { code: 'INVALID_ID' } })

  await SavingsTarget.findOneAndDelete({ _id: id, userId: new Types.ObjectId(userId) })
  res.json({ success: true, data: { id } })
})

export default router
