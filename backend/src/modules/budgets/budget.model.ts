import { Schema, model, Types } from 'mongoose'

const BudgetSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    monthlyBudget: { type: Number, required: true },
    spentAmount: { type: Number, default: 0 },
  },
  { timestamps: true }
)

// unique per user: prevent duplicate category names for same user
BudgetSchema.index({ userId: 1, name: 1 }, { unique: true })

export const BudgetCategory = model('BudgetCategory', BudgetSchema)
