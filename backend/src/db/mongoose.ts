import mongoose from 'mongoose'

export async function connectDB() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/heph'
  // Use new URL parser and unified topology by default
  await mongoose.connect(uri)
  // eslint-disable-next-line no-console
  console.log('Connected to MongoDB')
}
