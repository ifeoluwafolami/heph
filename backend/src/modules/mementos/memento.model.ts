import { Schema, model, Types } from 'mongoose'

const MementoSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    editedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

export const Memento = model('Memento', MementoSchema)
