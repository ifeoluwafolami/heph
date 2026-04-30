# Heph Backend (Node.js + MongoDB + Tailwind)

Quick scaffold for the Heph backend using Node.js, TypeScript, Express, and MongoDB (Mongoose). Tailwind is included to let the backend serve a small static UI or assets.

Prereqs
- Node.js 20+
- MongoDB running locally or a remote URI

Setup

1. Copy `.env.example` to `.env` and set `MONGO_URI`.
2. Install dependencies:

```
npm install
```

Run (development)

```
npm run tailwind:build
npm run dev
```

Build

```
npm run build
npm run tailwind:build
npm start
```

Notes
- This is a starter scaffold. Auth/password verification and production hardening are intentionally minimal.
