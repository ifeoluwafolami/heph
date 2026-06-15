import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import dotenv from 'dotenv'
import healthRouter from './modules/health/health.route'
import authRouter from './modules/auth/auth.route'
import expensesRouter from './modules/expenses/expenses.route'
import budgetsRouter from './modules/budgets/budgets.route'
import mementosRouter from './modules/mementos/mementos.route'
import recipesRouter from './modules/recipes/recipes.route'
import weightsRouter from './modules/weights/weights.route'
import sidequestsRouter from './modules/sidequests/sidequests.route'
import dashboardRouter from './modules/dashboard/dashboard.route'
import habitsRouter from './modules/habits/habits.route'
import savingsRouter from './modules/savings/savings.route'
import theOneRouter from './modules/the-one/theOne.route'

dotenv.config()

const app = express()
const allowedOrigins = new Set(
  [
    ...(process.env.FRONTEND_ORIGINS || process.env.FRONTEND_ORIGIN || '').split(','),
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ]
    .map((origin) => origin.trim())
    .filter(Boolean)
)

app.use(helmet())
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) return callback(null, true)
      return callback(new Error(`Origin ${origin} is not allowed by CORS`))
    },
    credentials: true,
  })
)
app.use(express.json())

app.use('/api/v1/health', healthRouter)
app.use('/api/v1/auth', authRouter)
app.use('/api/v1/expenses', expensesRouter)
app.use('/api/v1/budgets', budgetsRouter)
app.use('/api/v1/mementos', mementosRouter)
app.use('/api/v1/recipes', recipesRouter)
app.use('/api/v1/weights', weightsRouter)
app.use('/api/v1/sidequests', sidequestsRouter)
app.use('/api/v1/dashboard', dashboardRouter)
app.use('/api/v1/habits', habitsRouter)
app.use('/api/v1/savings', savingsRouter)
app.use('/api/v1/the-one', theOneRouter)

app.get('/', (_req, res) => {
  res.send({ success: true, data: { message: 'Heph backend running' } })
})

export default app
