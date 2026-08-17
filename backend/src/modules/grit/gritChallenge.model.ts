import { Schema, model, Types } from 'mongoose'

const GritTaskSchema = new Schema(
  {
    id: { type: String, required: true },
    goalId: { type: String, default: '' },
    title: { type: String, required: true },
    frequency: { type: String, enum: ['daily', 'weekly', 'monthly'], required: true, default: 'daily' },
    target: { type: Number, required: true, default: 1 },
  },
  { _id: false }
)

const GritGoalSchema = new Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    notes: { type: String, default: '' },
  },
  { _id: false }
)

const GritDailyLogSchema = new Schema(
  {
    date: { type: String, required: true },
    completedTaskIds: { type: [String], default: [] },
    checkIns: {
      type: [
        {
          id: { type: String, required: true },
          taskId: { type: String, required: true },
          createdAt: { type: String, required: true },
        },
      ],
      default: [],
    },
    notes: {
      type: [
        {
          id: { type: String, required: true },
          text: { type: String, required: true },
          createdAt: { type: String, required: true },
        },
      ],
      default: [],
    },
  },
  { _id: false }
)

const GritChallengeSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    startDate: { type: String, required: true },
    durationDays: { type: Number, required: true },
    goals: { type: [GritGoalSchema], default: [] },
    tasks: { type: [GritTaskSchema], default: [] },
    dailyLogs: { type: [GritDailyLogSchema], default: [] },
    status: { type: String, enum: ['active', 'completed', 'archived'], default: 'active' },
  },
  { timestamps: true }
)

GritChallengeSchema.index({ userId: 1, status: 1, createdAt: -1 })

export const GritChallenge = model('GritChallenge', GritChallengeSchema)
