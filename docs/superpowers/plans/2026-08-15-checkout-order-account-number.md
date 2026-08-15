# Checkout Job: Order Number & Group/Account Number Display — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show "Order #<order_number> · Akun <n>/<total>" on the Checkout (`CheckoutProcess.tsx`) and Riwayat Checkout (`CheckoutHistory.tsx`) pages, for Kopken checkout-automation jobs.

**Architecture:** Piggyback three new optional fields (`orderNumber`, `groupIndex`, `groupTotal`) onto the existing `checkout_jobs.order_payload` jsonb column — no DB migration, no worker-script change (extra JSON keys are already ignored by the worker). `Calculator.tsx` already has both values in scope (`qrisOrder.order_number` and the `index`/`result.groups.length` from the strategy-card loop) but currently drops them before creating the job; this plan threads them through and renders them on both display pages.

**Tech Stack:** React 19 + TypeScript (strict), Vite. No test framework in this project — verification is `npx tsc --noEmit` for type safety plus manual checks in the Browser preview tool (per project convention, see `ADMIN DiBeliin/CLAUDE.md`).

## Global Constraints

- No DB migration — new fields live only inside the existing `order_payload` jsonb column.
- Fields are optional/additive — jobs created before this change (or non-Kopken/non-QRIS-origin jobs) simply omit them; both display pages must render fine with them absent.
- Kopken-only — checkout automation doesn't exist for other brands, don't touch other brands' code paths.
- No change to `qris_orders` schema, `attach_checkout_job` RPC, or `runCheckout.js`/`checkout_worker.js`.

---

### Task 1: Extend `CheckoutJobOrderPayload` with order/group fields

**Files:**
- Modify: `ADMIN DiBeliin/src/services/checkoutJobService.ts:19-31`

**Interfaces:**
- Produces: `CheckoutJobOrderPayload` gains `orderNumber?: string`, `groupIndex?: number` (1-based), `groupTotal?: number`. All later tasks read/write these exact names and types.

- [ ] **Step 1: Add the three optional fields to the interface**

In `ADMIN DiBeliin/src/services/checkoutJobService.ts`, change:

```typescript
export interface CheckoutJobOrderPayload {
    outlet: string;
    name: string;
    voucher?: string;
    accountId?: string;
    subtotal: number;
    items: CheckoutJobOrderItem[];
    /** Jadwal pengambilan: "HH:MM" (24 jam, hari ini) buat "Jadwalkan", atau
     * kosongkan buat "Pickup Sekarang". Diteruskan apa adanya ke runCheckout.js. */
    pickupTime?: string;
    /** Sertakan kantong plastik? Default false. Diteruskan ke needPackaging di runCheckout.js. */
    needPackaging?: boolean;
}
```

to:

```typescript
export interface CheckoutJobOrderPayload {
    outlet: string;
    name: string;
    voucher?: string;
    accountId?: string;
    subtotal: number;
    items: CheckoutJobOrderItem[];
    /** Jadwal pengambilan: "HH:MM" (24 jam, hari ini) buat "Jadwalkan", atau
     * kosongkan buat "Pickup Sekarang". Diteruskan apa adanya ke runCheckout.js. */
    pickupTime?: string;
    /** Sertakan kantong plastik? Default false. Diteruskan ke needPackaging di runCheckout.js. */
    needPackaging?: boolean;
    /** Nomor pesanan (qris_orders.order_number) yang menjadi asal job ini —
     * cuma metadata tampilan, tidak dipakai runCheckout.js. */
    orderNumber?: string;
    /** Akun/grup ke berapa dari total split pesanan ini (1-based) — metadata tampilan. */
    groupIndex?: number;
    /** Total akun/grup dari pesanan ini — metadata tampilan. */
    groupTotal?: number;
}
```

- [ ] **Step 2: Type-check**

Run: `cd "ADMIN DiBeliin" && npx tsc --noEmit`
Expected: no new errors (this is a purely additive optional-field change, nothing else references the interface yet).

- [ ] **Step 3: Commit**

```bash
cd "ADMIN DiBeliin"
git add src/services/checkoutJobService.ts
git commit -m "feat: add orderNumber/groupIndex/groupTotal to CheckoutJobOrderPayload"
```

---

### Task 2: Thread order number + group index/total through Calculator.tsx

**Files:**
- Modify: `ADMIN DiBeliin/src/pages/Calculator.tsx:392-414` (`buildKopkenOrderPayload`)
- Modify: `ADMIN DiBeliin/src/pages/Calculator.tsx:416-460` (`KopkenCheckoutPanel` props + `openDialog`)
- Modify: `ADMIN DiBeliin/src/pages/Calculator.tsx:1198-1211` (call site)

**Interfaces:**
- Consumes: `CheckoutJobOrderPayload` from Task 1 (`orderNumber?`, `groupIndex?`, `groupTotal?`).
- Produces: `KopkenCheckoutPanel` now requires two new props, `index: number` and `groupTotal: number` (`orderNumber` stays optional). No other file renders `KopkenCheckoutPanel`, so this is safe to change directly.

- [ ] **Step 1: Extend `buildKopkenOrderPayload` to accept and forward the new fields**

Change the function signature and body from:

```typescript
function buildKopkenOrderPayload(
    group: OptimizationResult['groups'][0],
    outlet: string,
    customerName: string,
    pickupTime?: string,
    needPackaging?: boolean
): CheckoutJobOrderPayload {
    return {
        outlet: outlet || '',
        name: customerName || 'DiBeliin',
        voucher: mapVoucherToTier(group.recommendedVoucher),
        subtotal: group.totalPrice,
        items: group.items.map((item) => {
            const { cleanName, size } = extractSize(item.name);
            const { cleanAddons, note } = extractNote(item.addons ?? []);
            const options = cleanAddons.map(addonToOptionValue);
            if (size) options.push(size);
            return { name: cleanName, options, ...(note ? { notes: note } : {}) };
        }),
        ...(pickupTime ? { pickupTime } : {}),
        needPackaging: needPackaging === true,
    };
}
```

to:

```typescript
function buildKopkenOrderPayload(
    group: OptimizationResult['groups'][0],
    outlet: string,
    customerName: string,
    pickupTime?: string,
    needPackaging?: boolean,
    orderNumber?: string,
    groupIndex?: number,
    groupTotal?: number
): CheckoutJobOrderPayload {
    return {
        outlet: outlet || '',
        name: customerName || 'DiBeliin',
        voucher: mapVoucherToTier(group.recommendedVoucher),
        subtotal: group.totalPrice,
        items: group.items.map((item) => {
            const { cleanName, size } = extractSize(item.name);
            const { cleanAddons, note } = extractNote(item.addons ?? []);
            const options = cleanAddons.map(addonToOptionValue);
            if (size) options.push(size);
            return { name: cleanName, options, ...(note ? { notes: note } : {}) };
        }),
        ...(pickupTime ? { pickupTime } : {}),
        needPackaging: needPackaging === true,
        ...(orderNumber ? { orderNumber } : {}),
        ...(groupIndex != null ? { groupIndex } : {}),
        ...(groupTotal != null ? { groupTotal } : {}),
    };
}
```

- [ ] **Step 2: Add `index`, `groupTotal`, `orderNumber` props to `KopkenCheckoutPanel` and pass them into `buildKopkenOrderPayload`**

Change the props type and `openDialog` from:

```typescript
function KopkenCheckoutPanel({
    group,
    outlet,
    customerName,
    parsedPickupTime,
    qrisOrderId,
}: {
    group: OptimizationResult['groups'][0];
    outlet: string;
    customerName: string;
    /** Jadwal hasil parse baris "Jam Pengambilan:" di teks order (lihat orderParser.ts) — undefined = Pickup Sekarang. */
    parsedPickupTime?: string;
    qrisOrderId?: string;
}) {
```

to:

```typescript
function KopkenCheckoutPanel({
    group,
    outlet,
    customerName,
    parsedPickupTime,
    qrisOrderId,
    orderNumber,
    index,
    groupTotal,
}: {
    group: OptimizationResult['groups'][0];
    outlet: string;
    customerName: string;
    /** Jadwal hasil parse baris "Jam Pengambilan:" di teks order (lihat orderParser.ts) — undefined = Pickup Sekarang. */
    parsedPickupTime?: string;
    qrisOrderId?: string;
    /** Nomor pesanan (qris_orders.order_number) — undefined kalau order ini bukan dari QRIS. */
    orderNumber?: string;
    /** Posisi grup ini (0-based, sesuai index dari result.groups.map di call site). */
    index: number;
    /** Total grup dari hasil optimasi (result.groups.length). */
    groupTotal: number;
}) {
```

Then change `openDialog` from:

```typescript
    const openDialog = () => {
        const pickupTime = pickupMode === 'schedule' ? pickupTimeValue : undefined;
        setJsonDraft(JSON.stringify(buildKopkenOrderPayload(group, outlet, customerName, pickupTime, needPackaging), null, 2));
        setDialogOpen(true);
    };
```

to:

```typescript
    const openDialog = () => {
        const pickupTime = pickupMode === 'schedule' ? pickupTimeValue : undefined;
        setJsonDraft(JSON.stringify(
            buildKopkenOrderPayload(group, outlet, customerName, pickupTime, needPackaging, orderNumber, index + 1, groupTotal),
            null,
            2
        ));
        setDialogOpen(true);
    };
```

- [ ] **Step 3: Pass the new props at the call site**

Change:

```typescript
                                {result.groups.map((group, index) => (
                                    <div key={group.id}>
                                        <StrategyCard group={group} index={index} />
                                        {brand === 'kopken' && (
                                            <KopkenCheckoutPanel
                                                group={group}
                                                outlet={outletName}
                                                customerName={customerName}
                                                parsedPickupTime={parsedPickupTime}
                                                qrisOrderId={qrisOrder?.id}
                                            />
                                        )}
                                    </div>
                                ))}
```

to:

```typescript
                                {result.groups.map((group, index) => (
                                    <div key={group.id}>
                                        <StrategyCard group={group} index={index} />
                                        {brand === 'kopken' && (
                                            <KopkenCheckoutPanel
                                                group={group}
                                                outlet={outletName}
                                                customerName={customerName}
                                                parsedPickupTime={parsedPickupTime}
                                                qrisOrderId={qrisOrder?.id}
                                                orderNumber={qrisOrder?.order_number}
                                                index={index}
                                                groupTotal={result.groups.length}
                                            />
                                        )}
                                    </div>
                                ))}
```

- [ ] **Step 4: Type-check**

Run: `cd "ADMIN DiBeliin" && npx tsc --noEmit`
Expected: no errors. `index` and `groupTotal` are required props, `KopkenCheckoutPanel` is used at exactly this one call site and both are now supplied there.

- [ ] **Step 5: Commit**

```bash
cd "ADMIN DiBeliin"
git add src/pages/Calculator.tsx
git commit -m "feat: pass order number and group index/total into Kopken checkout jobs"
```

---

### Task 3: Display order/group line in Riwayat Checkout (`CheckoutHistory.tsx`)

**Files:**
- Modify: `ADMIN DiBeliin/src/pages/CheckoutHistory.tsx:337-344`

**Interfaces:**
- Consumes: `job.order_payload.orderNumber?`, `job.order_payload.groupIndex?`, `job.order_payload.groupTotal?` (from Task 1's interface).

- [ ] **Step 1: Add the conditional line under the name/outlet row**

Change:

```tsx
                                                <TableCell className="text-sm">
                                                    <div className="font-medium text-slate-800">
                                                        {job.order_payload.name} — {job.order_payload.outlet}
                                                    </div>
                                                    <div className="text-xs text-slate-500">
                                                        {job.order_payload.items.map((i) => i.name).join(', ')}
                                                    </div>
                                                </TableCell>
```

to:

```tsx
                                                <TableCell className="text-sm">
                                                    <div className="font-medium text-slate-800">
                                                        {job.order_payload.name} — {job.order_payload.outlet}
                                                    </div>
                                                    {job.order_payload.orderNumber && (
                                                        <div className="text-xs text-slate-400">
                                                            Order #{job.order_payload.orderNumber}
                                                            {job.order_payload.groupTotal
                                                                ? ` · Akun ${job.order_payload.groupIndex}/${job.order_payload.groupTotal}`
                                                                : ''}
                                                        </div>
                                                    )}
                                                    <div className="text-xs text-slate-500">
                                                        {job.order_payload.items.map((i) => i.name).join(', ')}
                                                    </div>
                                                </TableCell>
```

- [ ] **Step 2: Type-check**

Run: `cd "ADMIN DiBeliin" && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual check — existing rows still render**

Start the dev server preview (`npm run dev`, or via the project's preview tooling), open `/checkout-history`. Confirm the page loads without errors and existing (pre-this-change) job rows render exactly as before — no "Order #" line shown for them, since their `order_payload` has no `orderNumber`.

- [ ] **Step 4: Commit**

```bash
cd "ADMIN DiBeliin"
git add src/pages/CheckoutHistory.tsx
git commit -m "feat: show order number and account/group number in Riwayat Checkout"
```

---

### Task 4: Display order/group line in Checkout (`CheckoutProcess.tsx`)

**Files:**
- Modify: `ADMIN DiBeliin/src/pages/CheckoutProcess.tsx:120-127`

**Interfaces:**
- Consumes: same three optional `order_payload` fields as Task 3.

- [ ] **Step 1: Add the conditional line under the `<h1>` heading**

Change:

```tsx
            <div>
                <h1 className="text-xl font-semibold text-slate-900">
                    {job.order_payload.name} — {job.order_payload.outlet}
                </h1>
                <p className="text-sm text-slate-500">
                    {job.order_payload.items.map((i) => i.name).join(', ')}
                </p>
            </div>
```

to:

```tsx
            <div>
                <h1 className="text-xl font-semibold text-slate-900">
                    {job.order_payload.name} — {job.order_payload.outlet}
                </h1>
                {job.order_payload.orderNumber && (
                    <p className="text-sm text-slate-400">
                        Order #{job.order_payload.orderNumber}
                        {job.order_payload.groupTotal
                            ? ` · Akun ${job.order_payload.groupIndex}/${job.order_payload.groupTotal}`
                            : ''}
                    </p>
                )}
                <p className="text-sm text-slate-500">
                    {job.order_payload.items.map((i) => i.name).join(', ')}
                </p>
            </div>
```

- [ ] **Step 2: Type-check**

Run: `cd "ADMIN DiBeliin" && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual check — existing job detail still renders**

Open `/checkout-process/<id>` for an existing (pre-this-change) job. Confirm no "Order #" line appears and the page renders as before.

- [ ] **Step 4: Commit**

```bash
cd "ADMIN DiBeliin"
git add src/pages/CheckoutProcess.tsx
git commit -m "feat: show order number and account/group number in Checkout page"
```

---

### Task 5: End-to-end manual verification

**Files:** none (verification only)

- [ ] **Step 1: Run a real multi-account Kopken order through Calculator**

In the Browser preview, open `/calculator`, load or paste a Kopken order text large enough to split into 2+ accounts (matches the existing "Strategy (`N` groups)" behavior already in the app), click "Optimize Order".

- [ ] **Step 2: Process checkout for each group and verify the Checkout page**

For each strategy card, click through `KopkenCheckoutPanel`'s "Proses Checkout" flow. In the new tab that opens (`/checkout-process/<id>`), confirm the line under the heading reads `Order #<order_number> · Akun <n>/<total>` with the correct 1-based `n` matching that card's "Akun N" label and `<total>` matching the group count shown in "Strategy (N groups)".

- [ ] **Step 3: Verify Riwayat Checkout**

Open `/checkout-history`, find the jobs just created, confirm each row's "Pesanan" cell shows the same `Order #<order_number> · Akun <n>/<total>` line, with distinct `n` values per job and a consistent `order_number`/`total`.

- [ ] **Step 4: Verify a non-QRIS Kopken order still works**

Run Calculator without a linked QRIS order (paste order text directly, no `qrisOrder` in scope) and process a checkout. Confirm the resulting job shows no "Order #" line on either page (no crash, no `undefined` text) — `orderNumber` is absent so the whole line is skipped.
