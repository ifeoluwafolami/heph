import { Schema, model, Types } from 'mongoose'

const RecipeSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    servings: { type: Number, required: true },
    caloriesPerServing: { type: Number, required: true },
    steps: { type: [String], default: [] },
    notes: { type: String, default: '' },
    link: { type: String, default: '' },
  },
  { timestamps: true }
)

export const Recipe = model('Recipe', RecipeSchema)
