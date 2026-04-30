import { Schema, model, Types } from 'mongoose'

const WeightEntrySchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true },
    weightKg: { type: Number, required: true },
    changeKg: { type: Number, default: null },
    note: { type: String, default: '' },
    entryDate: { type: Date, required: true },
  },
  { timestamps: true }
)

export const WeightEntry = model('WeightEntry', WeightEntrySchema)
