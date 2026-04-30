import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import dotenv from 'dotenv'
import { connectDB } from './db/mongoose'
import healthRouter from './modules/health/health.route'
import usersRouter from './modules/users/users.route'
import authRouter from './modules/auth/auth.route'
import expensesRouter from './modules/expenses/expenses.route'
import budgetsRouter from './modules/budgets/budgets.route'
import mementosRouter from './modules/mementos/mementos.route'
import recipesRouter from './modules/recipes/recipes.route'
import weightsRouter from './modules/weights/weights.route'
import dashboardRouter from './modules/dashboard/dashboard.route'

dotenv.config()

const app = express()

app.use(helmet())
app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })
)
app.use(express.json())

connectDB().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to connect to DB', err)
})

app.use('/api/v1/health', healthRouter)
app.use('/api/v1/users', usersRouter)
app.use('/api/v1/auth', authRouter)
app.use('/api/v1/expenses', expensesRouter)
app.use('/api/v1/budgets', budgetsRouter)
app.use('/api/v1/mementos', mementosRouter)
app.use('/api/v1/recipes', recipesRouter)
app.use('/api/v1/weights', weightsRouter)
app.use('/api/v1/dashboard', dashboardRouter)

app.get('/', (_req, res) => {
  res.send({ success: true, data: { message: 'Heph backend running' } })
})

export default app
