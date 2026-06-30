import { Schema, model, Types } from 'mongoose'

const ExtraIncomeSchema = new Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    amount: { type: Number, required: true },
    date: { type: String, required: true },
    note: { type: String, default: '' },
  },
  { _id: false }
)

const MonthlyIncomeSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true },
    month: { type: String, required: true },
    salary: { type: Number, default: 0 },
    extraIncomes: { type: [ExtraIncomeSchema], default: [] },
  },
  { timestamps: true }
)

MonthlyIncomeSchema.index({ userId: 1, month: 1 }, { unique: true })

export const MonthlyIncome = model('MonthlyIncome', MonthlyIncomeSchema)
