import { Schema, model, Types } from 'mongoose'

const GoalSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    status: { type: String, enum: ['active', 'completed', 'paused'], default: 'active' },
    targetDate: { type: String, default: '' },
  },
  { timestamps: true }
)

GoalSchema.index({ userId: 1, createdAt: -1 })

export const Goal = model('Goal', GoalSchema)
