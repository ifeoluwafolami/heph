import { Schema, model, Types } from 'mongoose'

const SidequestMilestoneSchema = new Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    done: { type: Boolean, default: false },
  },
  { _id: false }
)

const SidequestSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    cost: { type: Number, required: true },
    completed: { type: Boolean, default: false },
    milestones: { type: [SidequestMilestoneSchema], default: [] },
  },
  { timestamps: true }
)

export const Sidequest = model('Sidequest', SidequestSchema)
