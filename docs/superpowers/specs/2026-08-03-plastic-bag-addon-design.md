# Plastic bag ("Pakai Plastik") toggle per checkout

## Problem
Admin currently has no way to request a plastic bag for a Kopken checkout — packaging is always excluded. Kopken's own API already supports this as a checkout-level flag (`needPackaging`) with its own price component (`packagingTotal`), but both call sites in `runCheckout.js`/`kopken_api.js` hardcode it to `false`. Need an admin-facing toggle on the Calculator page that flows through to those existing API calls.

## Scope
- New `Switch` toggle in `KopkenCheckoutPanel` (Calculator.tsx), default **off**.
- Toggle value threads through the existing job payload (`checkout_jobs.order_payload`, free-form jsonb — no migration needed) to `runCheckout.js`, replacing the two hardcoded `needPackaging: false` occurrences.
- No changes to per-item flow (`h8cz` add-to-cart) — packaging is checkout-level only, confirmed via Kopken's `c9fu` (Hitung Total) and `createOrder` (Bayar) request/response shapes.

## Out of scope
- Per-item packaging (Kopken's API doesn't support it — checkout-level only).
- Any Supabase schema change (`order_payload` is already free-form jsonb).
- Changing the default (confirmed: off, matches current hardcoded behavior).

## Design

### 1. Admin UI — `ADMIN DiBeliin/src/services/checkoutJobService.ts`
Add `needPackaging?: boolean;` to the `CheckoutJobOrderPayload` interface.

### 2. Admin UI — `ADMIN DiBeliin/src/pages/Calculator.tsx`
- `KopkenCheckoutPanel` gets local state `const [needPackaging, setNeedPackaging] = useState(false);`.
- Render the existing shadcn `Switch` component (`src/components/ui/switch.tsx`, already in the project) with label "Pakai Plastik", near the pickup-mode toggle.
- `buildKopkenOrderPayload()` includes `needPackaging` in the returned payload object so it appears in the review-dialog JSON (admin can still see/edit it there, consistent with how every other field works today).

### 3. Backend — `Otomasi_web_panel/dibeliin_auto/scripts/kopken_api.js`
`createOrder({ phone, outletId, items, amount, promotionCodes, accountId, targetName, pickupTime })` gains `needPackaging` in its destructured params (default `false`), and the body's hardcoded `needPackaging: false` becomes `needPackaging: needPackaging === true`.

### 4. Backend — `Otomasi_web_panel/dibeliin_auto/scripts/runCheckout.js`
- Read `const wantPackaging = order.needPackaging === true;` once, near where `order.outlet`/`order.items` are already read.
- `calcBody.needPackaging` (Hitung Total / `c9fu`, currently line 597) → `wantPackaging`.
- The `createOrder({...})` call (currently ~line 617) gains `needPackaging: wantPackaging,`.

## Data flow
```
Switch (Calculator.tsx) → needPackaging: boolean
  → buildKopkenOrderPayload() → CheckoutJobOrderPayload.needPackaging
  → checkout_jobs.order_payload (jsonb, unchanged column)
  → checkout_worker.js reads job.order_payload → runCheckout(order, jobId)
  → order.needPackaging === true → wantPackaging
  → calcBody.needPackaging (c9fu "Hitung Total")  → calcRes.packagingTotal reflects it
  → createOrder({..., needPackaging: wantPackaging}) ("Bayar") → order actually created with/without packaging
```

## Error handling
None needed beyond what already exists — `needPackaging` is a plain boolean with a safe default (`=== true` / `?? false` patterns already used elsewhere in these files for optional order fields), no new failure mode introduced.

## Testing
- Frontend: run dev server, toggle the switch on/off, confirm the review-dialog JSON textarea shows the matching `needPackaging` value before submit.
- Backend: `node -c` on both edited files.
- Manual live check (per project convention — no automated test suite for the checkout scripts): submit one real checkout job with the toggle on, confirm `packagingTotal` shows a non-zero value in the `[9] finalTotal / packaging` log line and the resulting order/receipt reflects packaging was included.

## Deploy
- `kopken_api.js` — no local/server divergence, direct `scp`.
- `runCheckout.js` — has an unmerged auth-block divergence between local and server (per project memory); use the existing safe-diff procedure: fetch server copy, apply this same isolated diff to it, re-diff against a fresh server fetch to confirm no other changes leaked in, then `scp` and `pm2 restart checkout-worker`.
