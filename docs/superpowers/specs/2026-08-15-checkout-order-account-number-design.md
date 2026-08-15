# Checkout Job: Order Number & Group/Account Number Display

**Date:** 2026-08-15
**Status:** Approved, ready for implementation plan
**Projects touched:** `ADMIN DiBeliin` only

## Background

Kopken checkout automation (`checkout_jobs` table, brand-scoped to Kopken) has no
way to tell, from the Checkout (`CheckoutProcess.tsx`) or Riwayat Checkout
(`CheckoutHistory.tsx`) pages, which order number a job belongs to or which
account/group of a multi-account split it represents. That data exists
elsewhere but never reaches the job:

- Order number: `qris_orders.order_number`, already fetched as `qrisOrder` in
  `Calculator.tsx` and passed down as `qrisOrderId` only (the string itself is
  dropped).
- Account/group number: the local `index` in `result.groups.map((group, index) =>
  ...)` in `Calculator.tsx:1198`, already used to label strategy cards "Akun
  {index + 1}" — but never threaded into the checkout job.

## Goal

Show "Order #<order_number> · Akun <n>/<total>" on both the Checkout and
Riwayat Checkout pages, for jobs where this info is available.

## Design

No DB migration. `checkout_jobs.order_payload` is an existing free-form jsonb
column already read/rendered as-is by both pages (and the worker script
ignores keys it doesn't recognize), so the three new fields ride along on it.

1. **`checkoutJobService.ts`** — add optional fields to
   `CheckoutJobOrderPayload`: `orderNumber?: string`, `groupIndex?: number`
   (1-based), `groupTotal?: number`.
2. **`Calculator.tsx`**
   - `buildKopkenOrderPayload` gains `orderNumber`, `groupIndex`, `groupTotal`
     params, included in the payload only when present.
   - `KopkenCheckoutPanel` gains `index: number` and `groupTotal: number`
     props; the existing `result.groups.map((group, index) => ...)` call site
     passes `index` and `result.groups.length`. `orderNumber` is
     `qrisOrder?.order_number`, already in scope.
3. **`CheckoutHistory.tsx`** — in the "Pesanan" table cell, add a small gray
   line under the existing "Nama — Outlet" line: `Order #{orderNumber} ·
   Akun {groupIndex}/{groupTotal}`. Rendered only when `orderNumber` is
   present; omitted entirely for jobs without it (old jobs, non-QRIS-origin
   jobs, non-Kopken brands).
4. **`CheckoutProcess.tsx`** — same line, placed under the existing `<h1>`
   name/outlet heading.

Fields are optional and additive — existing jobs without them render exactly
as today, no backfill needed.

## Non-goals

- No change to `qris_orders` schema or `attach_checkout_job` RPC.
- No change to the checkout worker script (`runCheckout.js` / `checkout_worker.js`) — extra JSON keys are already ignored.
- Not applied to non-Kopken brands (checkout automation doesn't exist for them).

## Testing / verification plan

Manual via preview browser (no test framework in this project, per its
`CLAUDE.md`): run Calculator on a Kopken order that splits into 2+ accounts,
process checkout for each group, confirm both Checkout and Riwayat Checkout
show the correct order number and "Akun n/total" for each job, and that an
older/pre-existing job in Riwayat Checkout still renders fine without the new
line.
