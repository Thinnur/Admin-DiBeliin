# Plastic Bag ("Pakai Plastik") Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin toggle whether a Kopken checkout includes a plastic bag, by wiring a new `needPackaging` boolean from the Calculator UI through the job payload into the two Kopken API calls that already accept it (currently hardcoded `false`).

**Architecture:** Pure plumbing — a `Switch` in `KopkenCheckoutPanel` sets local state, which is included in the payload built by `buildKopkenOrderPayload()`. That payload is stored verbatim in `checkout_jobs.order_payload` (jsonb, no schema change). `runCheckout.js` reads `order.needPackaging` and passes it to Kopken's `c9fu` (Hitung Total) and `createOrder` (Bayar) calls.

**Tech Stack:** React 19 + TypeScript + shadcn/ui (admin frontend, its own git repo at `ADMIN DiBeliin/`), plain Node.js CommonJS scripts (backend, `Otomasi_web_panel/dibeliin_auto/scripts/`, no git repo — deployed via SSH to `ssh-f3.akzara.id`, no automated test suite — `node -c` + live verification is the project's established check).

## Global Constraints
- Default value: `needPackaging` defaults to **off/false** everywhere (confirmed with user 2026-08-03).
- No Supabase migration — `order_payload` is already free-form jsonb.
- `runCheckout.js` has an unmerged local/server divergence (per project memory) — must deploy via the safe-diff SSH procedure, never a direct `scp` from local.
- `kopken_api.js` has no such divergence — direct `scp` is fine.
- Reuse the existing `src/components/ui/switch.tsx` shadcn component — do not add a new dependency or hand-roll a toggle.

---

### Task 1: Backend — `kopken_api.js` accepts `needPackaging`

**Files:**
- Modify: `Otomasi_web_panel/dibeliin_auto/scripts/kopken_api.js:239-250` (`createOrder` function)

**Interfaces:**
- Consumes: nothing new
- Produces: `createOrder({ phone, outletId, items, amount, promotionCodes, accountId, targetName, pickupTime, needPackaging })` — new optional `needPackaging` param (boolean, default falsy), used by Task 2.

- [ ] **Step 1: Edit the function signature and body**

Current (lines 239, 250):
```javascript
async function createOrder({ phone, outletId, items, amount, promotionCodes, accountId, targetName, pickupTime }, cookie) {
```
```javascript
        needPackaging: false,
```

Change to:
```javascript
async function createOrder({ phone, outletId, items, amount, promotionCodes, accountId, targetName, pickupTime, needPackaging }, cookie) {
```
```javascript
        needPackaging: needPackaging === true,
```

- [ ] **Step 2: Syntax check**

Run: `node -c "D:\_web-DiBeliin\Otomasi_web_panel\dibeliin_auto\scripts\kopken_api.js"`
Expected: no output (exit 0)

- [ ] **Step 3: Commit**

No git repo in `Otomasi_web_panel/` — skip commit, this file is deployed directly (see Task 5).

---

### Task 2: Backend — `runCheckout.js` reads `order.needPackaging` and passes it through

**Files:**
- Modify: `Otomasi_web_panel/dibeliin_auto/scripts/runCheckout.js:420-426` (near where `storeQuery`/`order.outlet` is read — add `wantPackaging` here)
- Modify: `Otomasi_web_panel/dibeliin_auto/scripts/runCheckout.js:591-602` (`calcBody`)
- Modify: `Otomasi_web_panel/dibeliin_auto/scripts/runCheckout.js:617-624` (`createOrder({...})` call)

**Interfaces:**
- Consumes: `createOrder(...)` from Task 1 now accepts `needPackaging`.
- Produces: `wantPackaging` (boolean, module-local `const` inside `runCheckout()`), used by both the `c9fu` calc call and the `createOrder` call in this same task.

- [ ] **Step 1: Declare `wantPackaging` near the existing `storeQuery` line**

Current (line 424):
```javascript
    const storeQuery = order.outlet.replace(/^\s*kopi\s*kenangan\s*[-–:]\s*/i, '').trim();
```

Add immediately after it:
```javascript
    const storeQuery = order.outlet.replace(/^\s*kopi\s*kenangan\s*[-–:]\s*/i, '').trim();
    const wantPackaging = order.needPackaging === true;
```

- [ ] **Step 2: Wire into `calcBody`**

Current (line 597):
```javascript
        needPackaging: false,
```
(inside the `calcBody` object, `Otomasi_web_panel/dibeliin_auto/scripts/runCheckout.js:591-602`)

Change to:
```javascript
        needPackaging: wantPackaging,
```

- [ ] **Step 3: Wire into the `createOrder(...)` call**

Current (`Otomasi_web_panel/dibeliin_auto/scripts/runCheckout.js:617-624`):
```javascript
    const orderRes = await retry(() => createOrder({
        phone,
        outletId,
        items: rawItems, // FULL {children, data} shape — same as calculate-checkout
        amount: finalTotal,
        promotionCodes: [voucher.ref],
        accountId: parseInt(accountId),
        targetName: order.name || 'customer',
```

Change to:
```javascript
    const orderRes = await retry(() => createOrder({
        phone,
        outletId,
        items: rawItems, // FULL {children, data} shape — same as calculate-checkout
        amount: finalTotal,
        promotionCodes: [voucher.ref],
        needPackaging: wantPackaging,
        accountId: parseInt(accountId),
        targetName: order.name || 'customer',
```

- [ ] **Step 4: Syntax check**

Run: `node -c "D:\_web-DiBeliin\Otomasi_web_panel\dibeliin_auto\scripts\runCheckout.js"`
Expected: no output (exit 0)

- [ ] **Step 5: Log line sanity check (manual read, no live call yet)**

Confirm `console.log('[9] finalTotal: ...` (existing line, currently ~606) already logs `packagingTotal` from `calcRes` — it does (`const { finalTotal, packagingTotal } = calcRes;`), so no new logging needed; the existing log line will show the real effect of the toggle once deployed.

---

### Task 3: Frontend — `CheckoutJobOrderPayload` gains `needPackaging`

**Files:**
- Modify: `ADMIN DiBeliin/src/services/checkoutJobService.ts` (interface `CheckoutJobOrderPayload`)

**Interfaces:**
- Consumes: nothing
- Produces: `CheckoutJobOrderPayload.needPackaging?: boolean`, consumed by Task 4.

- [ ] **Step 1: Add the field to the interface**

Find:
```typescript
interface CheckoutJobOrderPayload {
  outlet: string; name: string; voucher?: string; accountId?: string;
  subtotal: number; items: CheckoutJobOrderItem[]; pickupTime?: string;
}
```

Change to:
```typescript
interface CheckoutJobOrderPayload {
  outlet: string; name: string; voucher?: string; accountId?: string;
  subtotal: number; items: CheckoutJobOrderItem[]; pickupTime?: string;
  needPackaging?: boolean;
}
```

- [ ] **Step 2: Type-check**

Run (from `ADMIN DiBeliin/`): `npx tsc --noEmit`
Expected: no new errors referencing `checkoutJobService.ts`

- [ ] **Step 3: Commit**

```bash
git add "src/services/checkoutJobService.ts"
git commit -m "feat: add needPackaging to CheckoutJobOrderPayload"
```

---

### Task 4: Frontend — Switch toggle in `KopkenCheckoutPanel`

**Files:**
- Modify: `ADMIN DiBeliin/src/pages/Calculator.tsx` (`KopkenCheckoutPanel` component, and its call to `buildKopkenOrderPayload`)

**Interfaces:**
- Consumes: `Switch` from `src/components/ui/switch.tsx` (existing component, props: `checked: boolean`, `onCheckedChange: (v: boolean) => void`); `CheckoutJobOrderPayload.needPackaging` from Task 3.
- Produces: nothing consumed by later tasks (UI leaf).

- [ ] **Step 1: Import `Switch` and `Label` if not already imported**

At the top of `Calculator.tsx`, ensure these imports exist (add if missing):
```typescript
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
```

- [ ] **Step 2: Add local state in `KopkenCheckoutPanel`**

Near the existing pickup-mode state (e.g. `const [pickupMode, setPickupMode] = useState<'now' | 'schedule'>('now');`), add:
```typescript
  const [needPackaging, setNeedPackaging] = useState(false);
```

- [ ] **Step 3: Render the toggle**

Near the pickup-mode toggle buttons in the JSX, add:
```tsx
          <div className="flex items-center gap-2">
            <Switch
              id="need-packaging"
              checked={needPackaging}
              onCheckedChange={setNeedPackaging}
            />
            <Label htmlFor="need-packaging">Pakai Plastik</Label>
          </div>
```

- [ ] **Step 4: Thread the value into the built payload**

Find the call to `buildKopkenOrderPayload(...)` inside `KopkenCheckoutPanel` and confirm/adjust `buildKopkenOrderPayload`'s signature to accept and include `needPackaging`. The function currently returns a `CheckoutJobOrderPayload` object built from `group`, `outlet`, `customerName`, `pickupTime` — add `needPackaging` as an additional parameter and include it as a key in the returned object:

```typescript
function buildKopkenOrderPayload(
  group: ParsedOrderGroup,
  outlet: string,
  customerName: string,
  pickupTime?: string,
  needPackaging?: boolean,
): CheckoutJobOrderPayload {
  // ...existing body building `outlet`, `name`, `items`, `subtotal`, etc...
  return {
    // ...existing fields...
    needPackaging: needPackaging === true,
  };
}
```

Update the call site inside `KopkenCheckoutPanel` to pass the new `needPackaging` state value as the last argument.

- [ ] **Step 5: Manual browser verification**

Run: `npm run dev` (from `ADMIN DiBeliin/`), open the Calculator page, build a Kopken order, toggle "Pakai Plastik" on, click through to the review dialog.
Expected: the JSON textarea in the review dialog shows `"needPackaging": true`. Toggling it off before opening the dialog shows `"needPackaging": false`.

- [ ] **Step 6: Commit**

```bash
git add "src/pages/Calculator.tsx"
git commit -m "feat: add Pakai Plastik toggle to Kopken checkout panel"
```

---

### Task 5: Deploy backend changes

**Files:** none (deployment only — no new file content beyond Tasks 1–2)

**Interfaces:**
- Consumes: the edited local copies of `kopken_api.js` (Task 1) and `runCheckout.js` (Task 2).
- Produces: live `checkout-worker` process running the new code.

- [ ] **Step 1: Deploy `kopken_api.js` directly (no divergence)**

```bash
scp "D:\_web-DiBeliin\Otomasi_web_panel\dibeliin_auto\scripts\kopken_api.js" ssh-f3.akzara.id:/root/dibeliin/scripts/kopken_api.js
```

- [ ] **Step 2: Deploy `runCheckout.js` via the safe-diff procedure**

```bash
ssh ssh-f3.akzara.id "cat /root/dibeliin/scripts/runCheckout.js" > /tmp/server_runCheckout_pre.js
```

Apply the same two edits from Task 2, Steps 1–3 to `/tmp/server_runCheckout_pre.js` (by hand or with the same `Edit`-style replacements), producing `/tmp/server_runCheckout_patched.js`.

```bash
ssh ssh-f3.akzara.id "cat /root/dibeliin/scripts/runCheckout.js" > /tmp/server_runCheckout_fresh.js
diff /tmp/server_runCheckout_fresh.js /tmp/server_runCheckout_patched.js
```

Expected: diff shows ONLY the `wantPackaging` line addition and the two `needPackaging: false` → `needPackaging: wantPackaging` changes — nothing else.

```bash
scp /tmp/server_runCheckout_patched.js ssh-f3.akzara.id:/root/dibeliin/scripts/runCheckout.js
```

- [ ] **Step 3: Syntax check on server, restart, save**

```bash
ssh ssh-f3.akzara.id "NODE_PATH=/usr/lib/node_modules node -c /root/dibeliin/scripts/runCheckout.js && echo SYNTAX_OK"
ssh ssh-f3.akzara.id "node -c /root/dibeliin/scripts/kopken_api.js && echo SYNTAX_OK"
ssh ssh-f3.akzara.id "pm2 restart checkout-worker && pm2 save"
```

Expected: both `SYNTAX_OK`, pm2 shows `checkout-worker` instances restarted and `online`.

- [ ] **Step 4: Live smoke test**

Submit one real (or low-stakes test) checkout job from the admin UI with "Pakai Plastik" on. Tail the job log and confirm the `[9] finalTotal: ... | packaging: Rp ...` line shows a non-zero `packagingTotal`.
