import { Schema, model, Types } from 'mongoose'

const TheOneItemSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    note: { type: String, default: '' },
  },
  { timestamps: true }
)

TheOneItemSchema.index({ userId: 1, createdAt: 1 })

export const TheOneItem = model('ManListItem', TheOneItemSchema)
