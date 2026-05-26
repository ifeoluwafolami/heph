#!/usr/bin/env node
/* eslint-disable no-console */
const dotenv = require('dotenv')
dotenv.config()
const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/heph'

async function main() {
  await mongoose.connect(MONGO_URI)
  console.log('Connected to MongoDB')

  const email = process.env.SEED_USER_EMAIL
  const password = process.env.SEED_USER_PASSWORD
  const nickname = process.env.SEED_USER_NICKNAME || 'Heph'

  if (!email || !password) {
    console.error('Missing SEED_USER_EMAIL or SEED_USER_PASSWORD environment variables')
    process.exit(1)
  }

  const passwordHash = await bcrypt.hash(password, 10)

  const users = mongoose.connection.collection('users')
  const existing = await users.findOne({ email })
  if (existing) {
    console.log('User already exists — skipping seed')
  } else {
    const insertRes = await users.insertOne({ email, passwordHash, nickname, createdAt: new Date(), updatedAt: new Date() })
    console.log('User created with id:', insertRes.insertedId)
  }

  await mongoose.disconnect()
  console.log('Done')
}

main().catch((err) => {
  console.error('Seeding failed', err)
  process.exit(1)
})
