# Changes & Setup Summary

This document summarizes the scaffold and changes added to the Heph backend workspace.

Overview
- Stack: Node.js 20+, TypeScript, Express, MongoDB (Mongoose), Tailwind for static assets
- Validation: Zod
- Auth: JWT via `jsonwebtoken`, password hashing via `bcryptjs`

Files added (high level)
- `package.json`, `tsconfig.json`, `.env.example`, `README.md`
- `src/server.ts`, `src/app.ts` — app entry and Express app wiring
- `src/db/mongoose.ts` — Mongoose connection helper
- `src/utils/hash.ts` — `hashPassword`, `comparePassword`
- `src/utils/jwt.ts` — `signToken`, `verifyToken`
- `src/middleware/auth.middleware.ts` — `requireAuth` middleware
- `src/validation/users.schema.ts` — Zod schemas for register/login
- Models: `src/modules/users/user.model.ts`, `src/modules/expenses/expense.model.ts`, `src/modules/budgets/budget.model.ts`
- Routes: `src/modules/auth/auth.route.ts`, `src/modules/users/users.route.ts`, `src/modules/expenses/expenses.route.ts`, `src/modules/budgets/budgets.route.ts`, `src/modules/health/health.route.ts`
- Tailwind: `tailwind.config.cjs`, `postcss.config.cjs`, `src/public/styles.css`, `src/public/index.html`

What auth does now
- `POST /api/v1/auth/register` — validate input, hash password, create user, return JWT + user
- `POST /api/v1/auth/login` — validate input, check password, return JWT + user
- `GET /api/v1/auth/me` — protected; reads token and returns current user
- `src/middleware/auth.middleware.ts` extracts `userId` from token and attaches it to `req.auth`.

Validation
- User registration and login use Zod for input validation. Routes return a `VALIDATION` error with `details` on failure.

Expenses & Budgets
- CRUD routes added for expenses and budgets, including `POST /api/v1/budgets/:id/log-expense` which creates an Expense and updates the category's `spentAmount`.
- `GET /api/v1/expenses/summary` returns aggregated `totalSpent` for current month.

Tailwind
- Small static page at `/public/index.html` and entry CSS at `src/public/styles.css`.
- Build scripts available: `npm run tailwind:build` / `npm run tailwind:watch`.

How to run
1. Copy `.env.example` to `.env` and set `MONGO_URI` and optionally `JWT_SECRET` and `PORT`.
2. Install dependencies:

```bash
npm install
```

3. Build Tailwind (or run watch) and start dev server:

```bash
npm run tailwind:build
npm run dev
```

Notes & next steps
- Password reset, refresh tokens, rate limiting, and production hardening are not implemented.
- Input validation for expenses and budgets should be added to mirror frontend rules (I can add these next).
- Add integration tests and CI.

If you'd like, I can now:
- Add Zod validation for expenses/budgets
- Add refresh tokens and cookie-based auth
- Add automated tests for key endpoints
