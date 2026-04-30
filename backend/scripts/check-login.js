#!/usr/bin/env node
/* eslint-disable no-console */
const dotenv = require('dotenv')
dotenv.config()

const fetch = globalThis.fetch || require('node-fetch')

const API_BASE = process.env.API_BASE || `http://localhost:${process.env.PORT || 4000}/api/v1`

async function main() {
  const email = 'folamihephzibah@gmail.com'
  const password = 'Hfo231100!'

  const url = `${API_BASE}/auth/login`
  console.log('Checking login at', url)

  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
  } catch (err) {
    console.error('Failed to reach server:', err.message || err)
    process.exit(2)
  }

  let json
  try {
    json = await res.json()
  } catch (err) {
    console.error('Invalid JSON response', err)
    process.exit(2)
  }

  if (!res.ok || !json.success) {
    console.error('Login failed:', json.error || json)
    process.exit(1)
  }

  const { accessToken, refreshToken, user } = json.data || {}
  if (!accessToken) {
    console.error('Login response missing accessToken')
    process.exit(1)
  }

  console.log('Login OK — accessToken received')
  console.log('User:', user?.email || user)
  if (refreshToken) console.log('Refresh token received')

  process.exit(0)
}

main().catch((err) => {
  console.error('Check failed', err)
  process.exit(2)
})
