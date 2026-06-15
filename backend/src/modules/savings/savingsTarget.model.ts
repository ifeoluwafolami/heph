import { Schema, model, Types } from 'mongoose'

const SavingsTransactionSchema = new Schema(
  {
    id: { type: String, required: true },
    type: { type: String, enum: ['deposit', 'withdraw'], required: true },
    amount: { type: Number, required: true },
    date: { type: String, required: true },
  },
  { _id: false }
)

const SavingsTargetSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    targetAmount: { type: Number, required: true },
    transactions: { type: [SavingsTransactionSchema], default: [] },
  },
  { timestamps: true }
)

SavingsTargetSchema.index({ userId: 1, createdAt: -1 })

export const SavingsTarget = model('SavingsTarget', SavingsTargetSchema)
