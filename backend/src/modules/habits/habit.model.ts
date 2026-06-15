import { Schema, model, Types } from 'mongoose'

const HabitSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    frequency: { type: String, enum: ['daily', 'weekly', 'monthly'], required: true, default: 'daily' },
    target: { type: Number, required: true, default: 1 },
    logs: { type: [String], default: [] },
  },
  { timestamps: true }
)

HabitSchema.index({ userId: 1, createdAt: -1 })

export const Habit = model('Habit', HabitSchema)
