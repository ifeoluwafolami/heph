import { Schema, model, Types } from 'mongoose'

const TimeLogSchema = new Schema(
  {
    id: { type: String, required: true },
    date: { type: String, required: true },
    minutes: { type: Number, required: true, min: 1 },
  },
  { _id: false }
)

const BloomCourseSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    durationMinutes: { type: Number, required: true, min: 1 },
    logs: { type: [TimeLogSchema], default: [] },
  },
  { timestamps: true }
)

const DeepDiveReferenceSchema = new Schema(
  {
    id: { type: String, required: true },
    label: { type: String, default: '' },
    url: { type: String, required: true },
  },
  { _id: false }
)

const BloomDeepDiveSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true },
    topic: { type: String, required: true },
    tidbits: { type: String, default: '' },
    references: { type: [DeepDiveReferenceSchema], default: [] },
    logs: { type: [TimeLogSchema], default: [] },
  },
  { timestamps: true }
)

BloomCourseSchema.index({ userId: 1, createdAt: -1 })
BloomDeepDiveSchema.index({ userId: 1, createdAt: -1 })

export const BloomCourse = model('BloomCourse', BloomCourseSchema)
export const BloomDeepDive = model('BloomDeepDive', BloomDeepDiveSchema)
