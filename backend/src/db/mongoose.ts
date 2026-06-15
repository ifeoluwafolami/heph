import mongoose from 'mongoose'

export async function connectDB() {
  const uri = process.env.MONGO_URI
  if (!uri) {
    throw new Error('MONGO_URI is required. Set it to the shared production database URI if local and prod should show the same data.')
  }
  // Use new URL parser and unified topology by default
  await mongoose.connect(uri)
  // eslint-disable-next-line no-console
  console.log('Connected to MongoDB')
}
