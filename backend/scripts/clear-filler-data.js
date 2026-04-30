#!/usr/bin/env node
/* eslint-disable no-console */
const dotenv = require('dotenv')
dotenv.config()
const mongoose = require('mongoose')

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/heph'

async function main() {
  await mongoose.connect(MONGO_URI)
  console.log('Connected to MongoDB')

  const colls = ['expenses', 'budgetcategories', 'mementos', 'recipes', 'weightentries']
  for (const c of colls) {
    try {
      const col = mongoose.connection.collection(c)
      const res = await col.deleteMany({})
      console.log(`Cleared ${c}: deleted ${res.deletedCount}`)
    } catch (err) {
      console.warn(`Collection ${c} not found or error:`, err.message || err)
    }
  }

  await mongoose.disconnect()
  console.log('Done')
}

main().catch((err) => {
  console.error('Clear failed', err)
  process.exit(1)
})
