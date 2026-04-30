# Heph Frontend → Node.js Backend Compatibility Guide

This document defines a backend contract that is fully compatible with the current frontend routes, cards, and modal actions.

## 1) Recommended backend stack

- Runtime: Node.js 20+
- Framework: Express or Fastify (either works)
- Language: TypeScript
- DB: PostgreSQL + Prisma (recommended)
- Auth: JWT access token + refresh token (httpOnly cookie or secure storage)
- Validation: Zod or Joi
- Security: helmet, cors, rate-limiting

---

## 2) Frontend routes and required backend domains

Frontend pages:
- `/login` → auth
- `/dashboard` → overview + recent expenses + recent mementos
- `/owo` (expense tracker) → expenses + budgets + budget logs + summary cards
- `/mementos` → mementos CRUD
- `/ounje` → recipes CRUD + weight journal CRUD

Backend domains needed:
- Auth
- Users/Profile
- Expenses
- Budget Categories
- Mementos
- Recipes
- Weight Journal
- Dashboard Summary

---

## 3) API base and conventions

- Base URL: `/api/v1`
- Content-Type: `application/json`
- Date format in API: ISO-8601 date-only string (`2026-03-30`) — all date fields originate from `CustomDateInput`, which always produces `yyyy-mm-dd`. Accept this format for all write endpoints; return full ISO-8601 timestamps (`2026-03-30T12:00:00Z`) on read.
- Currency in API: numeric amount (recommend integer minor unit, e.g., kobo)
- Response envelope:

```json
{
  "success": true,
  "data": {},
  "message": "optional"
}
```

Error envelope:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request",
    "details": []
  }
}
```

---

## 4) Core data models

## User
- `id` (uuid)
- `email` (unique)
- `passwordHash`
- `nickname` (nullable)
- `createdAt`, `updatedAt`

## Expense
- `id` (uuid)
- `userId`
- `title`
- `amount` (integer)
- `currency` (default `NGN`)
- `categoryId` (nullable)
- `expenseDate` (timestamp)
- `note` (nullable)
- `createdAt`, `updatedAt`

## BudgetCategory
- `id` (uuid)
- `userId`
- `name`
- `monthlyBudget` (integer)
- `spentAmount` (derived or stored)
- `createdAt`, `updatedAt`

## Memento
- `id` (uuid)
- `userId`
- `title`
- `content`
- `createdAt`
- `editedAt` (nullable)

## Recipe
- `id` (uuid)
- `userId`
- `title`
- `servings` (int)
- `caloriesPerServing` (int)
- `notes` (text)
- `createdAt`, `updatedAt`

## WeightEntry
- `id` (uuid)
- `userId`
- `weightKg` (decimal)
- `changeKg` (nullable decimal)
- `note` (text)
- `entryDate` (date)
- `createdAt`, `updatedAt`

---

## 5) Endpoints required by current UI actions

## Auth
- `POST /auth/login`
  - body: `{ "email": "", "password": "" }`
  - returns: `{ accessToken, refreshToken, user }`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`

## Dashboard
- `GET /dashboard/overview`
  - returns:
  - `totalSpent`
  - `totalBudgeted`
  - `mementosAdded`
  - `weightProgressKg`
  - `newRecipes`
- `GET /dashboard/recent-expenses?limit=4`
- `GET /dashboard/recent-mementos?limit=3`

## Expenses (used in ExpenseTracker + RecentExpenses modals)- `GET /expenses/summary` (ExpenseTracker summary cards — returns `totalSpent`, `totalBudgeted`, `remaining` for the current month)- `GET /expenses?limit=&page=&from=&to=&categoryId=` (for “View all” list modal)
- `POST /expenses` (New Expense modal)
- `GET /expenses/:id`
- `PATCH /expenses/:id` (Recent expense edit modal)
- `DELETE /expenses/:id` (Delete confirmation modal)

## Budget Categories
- `GET /budgets` (budget cards)
- `POST /budgets` (New Budget modal)
- `PATCH /budgets/:id` (single budget pencil modal)
- `PATCH /budgets/bulk` (Edit Budgets modal)
- `DELETE /budgets/:id` (budget delete confirmation)

## Budget Expense Logging
- `POST /budgets/:id/log-expense` (Log Expense modal)
  - backend may internally create an Expense + recompute category spend

## Mementos
- `GET /mementos?limit=&page=`
- `POST /mementos`
- `PATCH /mementos/:id`
- `DELETE /mementos/:id`

## Recipes (Ounje)
- `GET /recipes`
- `POST /recipes`
- `PATCH /recipes/:id`
- `DELETE /recipes/:id`

## Weight entries (Ounje)
- `GET /weights?limit=&page=`
- `POST /weights`
- `PATCH /weights/:id`
- `DELETE /weights/:id`

---

## 6) Request/response examples (minimal)

## Create expense
`POST /api/v1/expenses`

> **Note:** the current `NewExpenseModal` sends category as a free-text name, not a UUID. The backend should either (a) accept `categoryName` and resolve/create the `BudgetCategory` internally, or (b) the frontend will need a category dropdown wired to `GET /budgets` before switching to `categoryId`.

```json
{
  "title": "Groceries",
  "amount": 4550,
  "currency": "NGN",
  "categoryId": "uuid",
  "expenseDate": "2026-03-22",
  "note": "Weekly shopping"
}
```

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Groceries",
    "amount": 4550,
    "currency": "NGN",
    "expenseDate": "2026-03-22T00:00:00.000Z"
  }
}
```

## Bulk update budgets
`PATCH /api/v1/budgets/bulk`

```json
{
  "items": [
    { "id": "uuid-1", "monthlyBudget": 50000 },
    { "id": "uuid-2", "monthlyBudget": 20000 }
  ]
}
```

---

## 7) Compatibility mapping to existing modals

Expense Tracker and components currently require these backend behaviors:
- New Expense button/modal → `POST /expenses`
- Edit Budgets button/modal → `PATCH /budgets/bulk`
- New Budget modal → `POST /budgets`
- Budget pencil modal → `PATCH /budgets/:id`
- Budget delete confirmation → `DELETE /budgets/:id`
- Log Expense modal (inside budget card) → `POST /budgets/:id/log-expense`
- Recent expense pencil modal → `PATCH /expenses/:id`
- Recent expense delete confirmation → `DELETE /expenses/:id`
- View all recent expenses modal → `GET /expenses`
- ExpenseTracker summary cards → `GET /expenses/summary`

---

## 8) Validation rules to mirror frontend assumptions

- `title`, `name`: 1–120 chars
- `amount`, `monthlyBudget`: positive numbers
- `servings`, `caloriesPerServing`: positive integers
- `weightKg`: positive decimal
- `entryDate`, `expenseDate`: valid date
- `editedAt` may be null/absent

---

## 9) Suggested folder structure (Node + TS)

```text
src/
  app.ts
  server.ts
  config/
  middleware/
  modules/
    auth/
    users/
    dashboard/
    expenses/
    budgets/
    mementos/
    recipes/
    weights/
  db/
    prisma/
```

---

## 10) Implementation checklist

- [ ] Create auth endpoints and JWT flow
- [ ] Implement all CRUD endpoints listed above
- [ ] Add input validation for every write endpoint
- [ ] Add pagination/sorting on list endpoints
- [ ] Return ISO date strings consistently
- [ ] Return numeric money in one standard unit consistently
- [ ] Add CORS for frontend origin
- [ ] Add integration tests for modal-triggered actions

---

## 11) Notes for smooth frontend integration

- Keep field names stable (`title`, `amount`, `createdAt`, `editedAt`, `notes`, etc.).
- Prefer additive changes; avoid breaking response shape.
- If backend stores money in minor units, either:
  - return minor units and format in frontend, or
  - expose a formatted field as well (e.g., `displayAmount`).

If you want, I can also generate a full OpenAPI 3.1 spec (`openapi.yaml`) from this contract next.
