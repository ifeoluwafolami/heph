import { Schema, model, Types } from 'mongoose'

const BloomPlanSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    date: { type: String, required: true },
    color: { type: String, required: true },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
)

BloomPlanSchema.index({ userId: 1, date: 1 })

export const BloomPlan = model('BloomPlan', BloomPlanSchema)
