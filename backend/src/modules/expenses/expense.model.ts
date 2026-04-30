import { Schema, model, Types } from 'mongoose'

const ExpenseSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'NGN' },
    categoryId: { type: Types.ObjectId, ref: 'BudgetCategory', default: null },
    note: { type: String, default: null },
    expenseDate: { type: Date, required: true },
  },
  { timestamps: true }
)

export const Expense = model('Expense', ExpenseSchema)
