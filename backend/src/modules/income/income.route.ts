import { Router } from 'express'
import { Types } from 'mongoose'
import { requireAuth } from '../../middleware/auth.middleware'
import { MonthlyIncome } from './income.model'

const router = Router()
const monthKeyPattern = /^\d{4}-\d{2}$/
const dateKeyPattern = /^\d{4}-\d{2}-\d{2}$/

router.use(requireAuth)

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

function getMonth(reqMonth: unknown) {
  const month = String(reqMonth || '')
  return monthKeyPattern.test(month) ? month : currentMonthKey()
}

async function findOrCreateIncome(userId: string, month: string) {
  return MonthlyIncome.findOneAndUpdate(
    { userId: new Types.ObjectId(userId), month },
    { $setOnInsert: { salary: 0, extraIncomes: [] } },
    { upsert: true, new: true }
  )
}

router.get('/', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const month = getMonth(req.query.month)
  const income = await findOrCreateIncome(userId, month)
  res.json({ success: true, data: income })
})

router.patch('/salary', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const month = getMonth(req.body?.month)
  const salary = Number(req.body?.salary)
  if (!Number.isFinite(salary) || salary < 0) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'salary must be zero or more' } })
  }

  const income = await MonthlyIncome.findOneAndUpdate(
    { userId: new Types.ObjectId(userId), month },
    { $set: { salary }, $setOnInsert: { extraIncomes: [] } },
    { upsert: true, new: true }
  )
  res.json({ success: true, data: income })
})

router.post('/extra', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const month = getMonth(req.body?.month)
  const title = String(req.body?.title || '').trim()
  const amount = Number(req.body?.amount)
  const date = dateKeyPattern.test(String(req.body?.date || '')) ? String(req.body.date) : `${month}-01`
  const note = String(req.body?.note || '').trim()
  if (!title || !Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'title and amount are required' } })
  }

  const income = await findOrCreateIncome(userId, month)
  income.extraIncomes.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title,
    amount,
    date,
    note,
  })
  await income.save()
  res.status(201).json({ success: true, data: income })
})

router.delete('/extra/:extraId', async (req, res) => {
  const userId = req.auth?.userId
  if (!userId) return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR' } })

  const month = getMonth(req.query.month)
  const income = await MonthlyIncome.findOne({ userId: new Types.ObjectId(userId), month })
  if (!income) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } })

  income.set('extraIncomes', income.extraIncomes.filter((item) => item.id !== req.params.extraId))
  await income.save()
  res.json({ success: true, data: income })
})

export default router
