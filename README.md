# Orders and Settlements

A small B2B order/payment tracker: create orders with line items, record full or partial payments against them, and see live status (`pending` / `partially_paid` / `paid` / `overdue`) derived from those payments — never stored as a manually-set field.

Built as a take-home submission with a deliberate focus on the part of this problem that's actually hard: **making sure two payments recorded at the same instant can never push an order over its total.** Everything else (CRUD, auth, dashboard) is intentionally straightforward.

## Live URLs

- Frontend: `<TODO>`
- Backend API: `<TODO>` (`GET /health` for a liveness check)

## Stack

- **Backend**: Node.js + TypeScript + Fastify, PostgreSQL via Drizzle ORM, JWT auth (argon2 password hashing), Zod validation.
- **Frontend**: React + TypeScript + Vite, TanStack Query, react-router.
- **Why two separate deployables** instead of one Next.js app: the REST API boundary and the payment-transaction/locking code are the parts of this assignment actually being evaluated, so they live in a plain, inspectable Fastify service rather than behind framework routing conventions. It also means the backend can be tested (and load-tested, if that mattered here) in complete isolation from the UI.

## Running locally

Every command block below assumes you start from the **repository root** (the folder this README is in) unless it says otherwise — copy-paste each block into its own terminal tab rather than chaining them in one shell.

### Prerequisites

- Node.js 20+ and npm
- Docker Desktop (for local Postgres via `docker-compose`) — **or** skip Docker entirely and use the embedded-Postgres option in step 1b below.

### Step 1a — Database, with Docker (recommended)

```bash
docker compose up -d postgres
```

Starts Postgres on `localhost:5432`, database `orders_and_settlements`. (A second `postgres_test` service on port `5433` exists for the integration tests, but you don't need to start it manually — the test suite starts its own database automatically, see "Running the tests" below.) Leave this running; move on to Step 2.

### Step 1b — Database, without Docker

If Docker isn't available, this starts a real local Postgres binary instead (no container runtime needed):

```bash
cd backend
npm install
npm run dev:db
```

Leave this running in its own terminal (`Ctrl+C` to stop it later) — it prints "database 'orders_and_settlements' ready" when it's up. Then open a **new terminal**, `cd` back to the repo root, and continue with Step 2.

### Step 2 — Backend

In a new terminal, from the repo root:

```bash
cd backend
cp .env.example .env
npm install
npm run migrate
npm run dev
```

`npm run migrate` applies the schema and the trigger migration (see "Data model" below) — run it once after the database is up, and again any time you pull new migration files. `npm run dev` starts the API on `http://localhost:4000`; leave it running.

### Step 3 — Frontend

In a **third** terminal, from the repo root:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Opens on `http://localhost:5173` (`VITE_API_BASE_URL` in `.env` already points at `http://localhost:4000`). Sign up with any email and an 8+ character password, then create an order and try recording payments against it.

At this point you should have three terminals running: the database (1a or 1b), the backend (`npm run dev` in `backend/`), and the frontend (`npm run dev` in `frontend/`).

### Running the tests

Backend unit and integration tests are fully self-contained — they start their **own** temporary Postgres automatically (via `embedded-postgres`) and need nothing from Steps 1–3 running:

```bash
cd backend
npm run test:unit         # pure domain logic (status derivation, totals, money) — no DB
npm run test:integration  # API + DB, including the concurrency race test
# or both:
npm test
```

The Playwright e2e test drives the real running app, so it **does** need Steps 1–3 already up in their own terminals first:

```bash
cd frontend
npx playwright install chromium   # first time only
npm run e2e
```

## API overview

All endpoints except `/auth/*` and `/health` require `Authorization: Bearer <token>`. Every response scopes to the authenticated user — no cross-tenant access is possible (a request for another user's order returns `404`, not `403`, so existence isn't leaked).

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/signup` | Create an account, returns `{ token, user }` |
| POST | `/auth/login` | Authenticate, returns `{ token, user }` |
| GET | `/orders?status=paid` | List the current user's orders, optional status filter |
| POST | `/orders` | Create an order with line items (total computed server-side) |
| GET | `/orders/:id` | Order detail: line items, payments, derived status |
| PATCH | `/orders/:id` | Edit an order (see "Editability policy") |
| DELETE | `/orders/:id` | Delete an order |
| POST | `/orders/:id/payments` | Record a payment. **Requires an `Idempotency-Key` header.** |
| GET | `/orders/:id/payments` | Payment history for an order |
| GET | `/orders/:id/status-events` | Audit log of status transitions (stretch goal) |
| GET | `/health` | Liveness check (also verifies DB connectivity) |

### Error format

Every error response has the same shape, so the frontend has exactly one place that parses errors:

```json
{ "error": { "code": "OVERPAYMENT", "message": "Payment of 150.00 exceeds the remaining balance of 100.00", "details": { "maxAllowedCents": 10000 } } }
```

| HTTP | code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Bad input (Zod), missing `Idempotency-Key`, no fields to update |
| 401 | `UNAUTHENTICATED` | Missing/invalid/expired token, wrong login credentials |
| 404 | `NOT_FOUND` | Resource doesn't exist, or belongs to a different user |
| 409 | `OVERPAYMENT` | Payment would exceed the order's remaining balance (`details.maxAllowedCents` tells the client exactly how much room is left) |
| 409 | `ORDER_LOCKED` | Attempted to edit line items/due date on an order that already has a payment |
| 409 | `EMAIL_TAKEN` | Signup with an email already in use |
| 500 | `INTERNAL_ERROR` | Unexpected error (logged server-side with a request ID, generic message to the client) |

## Data model

`users` → `orders` → `line_items` / `payments` → `order_status_events` (audit log). Full DDL in `backend/src/db/schema.ts` and `backend/src/db/migrations/`.

Two columns on `orders` — `order_total_cents` and `amount_paid_cents` — are **denormalized caches**, kept in sync by Postgres triggers (`0001_triggers_maintain_order_caches.sql`) that recompute them from `line_items`/`payments` inside the same transaction as the write that changed them. This exists specifically so the payment-recording transaction (below) only needs a single indexed row read to know "how much is left to pay," not an aggregate scan while holding a row lock.

**Defense in depth** — the invariant that actually matters (`amount_paid_cents` never exceeds `order_total_cents`) is enforced in two independent places:

1. **Primary**: the payment service checks it inside a locked transaction *before* writing, so it can return a precise, actionable error (`"exceeds the remaining balance of $X"`) instead of a raw DB error.
2. **Backstop**: a Postgres `CHECK` constraint on `orders.amount_paid_cents <= orders.order_total_cents`. If the primary check is ever bypassed by a future code path (a bulk-import script, a bug), the transaction fails loudly at commit instead of silently corrupting data. This is the concrete difference between *preventing* a failure and merely *hoping* it doesn't happen.

## Status derivation

`pending` / `partially_paid` / `paid` / `overdue` are **never stored** — they're computed on every read by one pure function, [`domain/orderStatus.ts`](backend/src/domain/orderStatus.ts), so the dashboard, the order detail page, and any future reporting code can never disagree with each other:

```
if amountPaid >= orderTotal:        paid       (checked first — see edge case below)
else if now > end-of-day(dueDate):  overdue
else if amountPaid > 0:             partially_paid
else:                                pending
```

**Named edge case from the brief** — an order that *was* overdue is `paid`, not stuck `overdue`, once it's fully paid, because the `paid` check runs before the `overdue` check. There is no "was overdue" flag to get out of sync; status is recomputed fresh every time.

Other documented edge cases (all covered by unit tests in `test/unit/orderStatus.test.ts`):
- **Zero line items** → total is $0, so the order reads as `paid` immediately (nothing owed is trivially satisfied). Not specified by the brief; this is the interpretation chosen.
- **Due date is inclusive** — a payment made any time on the due date itself counts as on-time; `overdue` begins the instant after that calendar day ends (UTC).
- **A partial payment past the due date is `overdue`**, not `partially_paid` — "past due and not fully paid" is the definition of overdue regardless of partial payment.

## Concurrency & consistency approach

This is the part of the assignment the brief explicitly flags ("consider what happens if two payments are submitted at the same time"), and the part this submission spends the most design effort on.

**The problem**: two `POST /orders/:id/payments` requests for the same order (double-click, a retried request, two open tabs) can both read the same `amount_paid_cents`, both pass a naive "is there room?" check, and both write — jointly overpaying.

**Three approaches considered:**

| Approach | Guarantee | Cost | Verdict |
|---|---|---|---|
| **Pessimistic row lock** (`SELECT ... FOR UPDATE` inside a transaction) | Strong — the lock makes check-then-write atomic w.r.t. other writers on that row | A second concurrent write to the *same* order blocks briefly until the first commits | **Chosen** |
| Optimistic concurrency (version column + retry on conflict) | Strong, but needs an explicit retry loop | Extra code/complexity; only pays off when many concurrent *readers* compete with long-held locks — not the case here | Rejected |
| Rely on the DB `CHECK` constraint alone | Strong (Postgres enforces it transactionally) | Same lock cost as option 1 anyway (an `UPDATE` on the row already takes a lock) but the error is a raw constraint-violation, not a clean "$X remaining" message | Rejected as the *primary* mechanism, kept as the backstop |

Payments on any single order are rare relative to reads (per the brief's own framing), so the pessimistic lock's only real cost — brief serialization of writes to that one order — is paid almost never, while its benefit (trivially provable correctness, a clean pre-write error message, no retry-loop bugs to write) is realized on every request. This is the "prevent failure first" half of the story; the CHECK constraint is the "recover safely if prevention is ever bypassed" half.

**End-to-end flow for `POST /orders/:id/payments`:**

1. Require an `Idempotency-Key` header (400 if missing).
2. Look up an existing payment with that `(order_id, idempotency_key)` — if found, return the **original** result (idempotent no-op retry) instead of writing again.
3. `SELECT ... FOR UPDATE` — locks the order row for the rest of this transaction and enforces tenant ownership in the same query.
4. Check `amount <= remaining` in application code — reject with `409 OVERPAYMENT` (includes the exact max allowed) before writing anything.
5. Insert the payment; the DB trigger updates `orders.amount_paid_cents` in the same transaction.
6. Recompute status; if it changed, insert an `order_status_events` row (the audit log).
7. Commit.

Verified in `test/integration/payments.concurrency.test.ts`, which fires two overlapping `$700` payments at a `$1000` order (their sum would overpay by `$400`) and asserts exactly one is accepted and the DB invariant holds afterward — not just that the code *looks* correct, but that it survives an actual race.

**Idempotency** — the `Idempotency-Key` header is what makes it safe for a client to retry after a timeout/dropped connection: worst case, retrying returns the same result instead of creating a second payment. This is deliberately scoped to just this one endpoint (not a generic idempotency framework for the whole API) because payments are the one write in this system where a duplicate is a real money bug, not a UX annoyance — over-engineering a general-purpose mechanism for endpoints that don't need it wasn't worth the complexity.

### SLA/SLO notes

- **Target**: payment recording p95 latency < 300ms (a single locked row read + one insert + one update, all indexed), success rate ≥ 99.9% excluding client validation errors.
- **On ambiguous failure** (timeout, dropped connection, 5xx where the client can't tell if the write landed): the client can safely retry the identical request. This isn't just a promise — it's enforced by the `UNIQUE(order_id, idempotency_key)` partial index, so even a retry racing the original request can't create a duplicate.
- **Degradation posture**: if the database is unreachable, `/health` returns `503` and the payment endpoint fails closed rather than accepting a write it can't validate — for a money-handling endpoint, refusing to accept a payment is the correct failure mode, not silently accepting one that might turn out to be wrong.

## Editability policy

**An order becomes read-only for its line items and due date once it has at least one payment recorded.** `customerName` stays editable always (cosmetic, doesn't affect any financial calculation).

Why: allowing the total to change after money has already been recorded against an order opens a set of reconciliation questions (is the earlier payment still valid? does it need to be re-validated against the new total?) that are out of scope for this assignment, and quietly allowing it risks exactly the kind of financial inconsistency this whole exercise is testing for. This mirrors how real invoicing systems behave, and the brief explicitly allows either choice as long as it's explained. Enforced server-side (`409 ORDER_LOCKED` on `PATCH`) — not just hidden buttons in the UI, so the API is correct even if called directly.

## Money handling

Every monetary value is an **integer number of cents** — in Postgres (`BIGINT` columns), across the API (`orderTotalCents`, `amountCents`, etc. — the `Cents` suffix is deliberate so no field is ever ambiguous about units), and in all backend arithmetic. Floats are never used for money anywhere in the stack. The frontend only converts cents ↔ a dollar display string at the render/input boundary (`frontend/src/lib/money.ts`) and never does arithmetic on formatted strings. Assumes a single currency (USD), documented as a "before production" gap below.

## Assumptions & tradeoffs

- USD only, no multi-currency support.
- No order-level tax/discount, per the brief.
- A zero-line-item order is treated as `paid` (see "Status derivation" above).
- Due dates are treated as UTC calendar dates — no per-user timezone handling.
- JWT is stored in `localStorage` on the frontend (simpler for a take-home; a production app would prefer an httpOnly refresh-token cookie to reduce XSS exposure — see below).
- `/orders` is unpaginated. Fine at take-home data volumes; a real scaling gap (see below).
- Row ownership is enforced by an explicit `WHERE user_id = ...` on every query rather than Postgres Row-Level Security — simpler to reason about for this scope, but RLS would be the safer default in production (a forgotten `WHERE` clause becomes a real security bug, not just a bad test).

## What I'd improve before production

- **Row-Level Security** in Postgres as a second, DB-enforced layer of tenant isolation (defense in depth, same philosophy as the overpayment CHECK constraint).
- **httpOnly refresh-token cookies** instead of a `localStorage` JWT, to reduce the blast radius of an XSS bug.
- **Rate limiting** on `/auth/login` and `/auth/signup`.
- **Pagination** on `GET /orders` (`?cursor=`/`?limit=`) — the current unindexed-by-count list is fine at hundreds of orders per user, not at tens of thousands. The existing `idx_orders_user_id_due_date` index is a step toward keyset pagination on due date.
- **Structured logging / tracing** — Fastify's request ID is already threaded through error logs as a starting point; a real deployment would want this shipped to a log aggregator with the request ID as the correlation key.
- **Multi-currency** — `orderTotalCents` would need a currency code alongside it, and cross-currency arithmetic guarded against.
- **A read replica or connection-pooling layer** (e.g. PgBouncer) if payment write volume ever grew enough for the row-lock serialization on hot orders to become visible — not a concern at any realistic scale for this product, but worth naming as the point at which the concurrency design in this README would need revisiting.
