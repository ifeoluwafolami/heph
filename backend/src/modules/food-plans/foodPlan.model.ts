import { Schema, model, Types } from 'mongoose'

const mealTypes = ['breakfast', 'brunch', 'lunch', 'preworkout', 'snack', 'dinner'] as const

const FoodPlanEntrySchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true },
    meal: { type: String, enum: mealTypes, required: true },
    food: { type: String, required: true },
    calories: { type: Number, required: true },
    recipeId: { type: Types.ObjectId, ref: 'Recipe', default: undefined },
  },
  { timestamps: true }
)

const FoodPlanSettingsSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true, unique: true },
    dailyCalorieTarget: { type: Number, default: 2000 },
  },
  { timestamps: true }
)

FoodPlanEntrySchema.index({ userId: 1, date: 1 })

export const FoodPlanEntry = model('FoodPlanEntry', FoodPlanEntrySchema)
export const FoodPlanSettings = model('FoodPlanSettings', FoodPlanSettingsSchema)
