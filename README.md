# DiBeliin Admin

Panel admin untuk manajemen bisnis jastip kopi — inventory akun, keuangan, kalkulator order, dan operasional toko.

Built with React + TypeScript + Vite, di-deploy sebagai PWA.

---

## Tech Stack

| Layer | Library |
|---|---|
| Framework | React 19 + TypeScript |
| Build Tool | Vite 7 |
| Styling | Tailwind CSS v4 |
| UI Components | shadcn/ui (Radix UI) |
| State & Data | TanStack Query v5 |
| Backend | Supabase (Auth + Postgres + Storage) |
| AI | Google Gemini 2.5 Flash |
| Routing | React Router v7 |
| Form | React Hook Form + Zod |

---

## Fitur

**Inventory**
- Manajemen akun Kopi Kenangan & Fore Coffee
- Tracking voucher per akun (NoMin, 50k, BOGO, 35%)
- Filter by perangkat, status, dan brand
- Bulk import akun dari teks seller
- Auto-detect expiry date & PIN

**Finance**
- Dashboard income/expense/profit dengan grafik tren
- Filter harian, bulanan, rentang waktu, atau semua waktu
- Scan bukti transaksi via AI (Gemini)
- Import mutasi Bank Jago dari e-statement PDF
- Bulk import transaksi dari teks

**Calculator**
- Parser order dari format WhatsApp
- Optimisasi pembagian order untuk maksimalkan diskon voucher
- Mendukung strategi BOGO dan diskon 35% Fore Coffee
- Bin-packing otomatis untuk voucher Kopi Kenangan

**Operational**
- Toggle buka/tutup toko dan per-brand
- Manajemen voucher diskon
- Upload dan kelola banner homepage
- Riwayat antrian pesanan

**Menu & Produk**
- Daftar menu kopi dengan harga regular/large
- Menu makanan cepat saji dengan add-on groups
- Katalog produk digital (Netflix, Spotify, dll.)
- Tracking langganan digital per pelanggan

**RBAC**
- Role `super_admin` — akses penuh
- Role `staff` — hanya Inventory, Calculator, dan Operational

---

## Struktur Proyek

```
src/
├── components/
│   ├── auth/          # ProtectedRoute, guard component
│   ├── finance/       # Dialog transaksi, import Bank Jago
│   ├── inventory/     # Tabel akun, form add/edit, banner
│   ├── layout/        # AdminLayout, sidebar, bottom nav
│   ├── operational/   # Tabel antrian pesanan
│   └── ui/            # shadcn/ui components
├── contexts/          # AuthContext (RBAC)
├── hooks/             # React Query hooks (useInventory, useFinance, dll.)
├── lib/
│   ├── logic/         # Optimizer, parser, auto-assign logic
│   └── ...            # queryClient, supabase, utils
├── pages/             # Halaman utama (Inventory, Finance, Calculator, dll.)
├── services/          # API wrappers ke Supabase
└── types/             # TypeScript types untuk database schema
```

---

## Memulai

### Prerequisites

- Node.js 18+
- Akun Supabase
- (Opsional) Google Gemini API key — untuk fitur scan bukti transaksi

### Setup

```bash
# Clone & install
git clone <repo-url>
cd dibeliin-admin
npm install

# Konfigurasi environment
cp .env.example .env
```

Isi file `.env`:

```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_GEMINI_API_KEY=your_gemini_key   # opsional
```

```bash
# Jalankan dev server
npm run dev
```

### Database Setup

Jalankan migration berikut di Supabase SQL Editor:

```bash
supabase/migrations/get_financial_summary.sql   # RPC untuk summary keuangan
supabase/migrations/rls_policies.sql            # Row Level Security
```

---

## Scripts

```bash
npm run dev       # Dev server dengan HMR
npm run build     # Production build
npm run preview   # Preview hasil build
npm run lint      # ESLint
```

---

## Deploy

Proyek ini dikonfigurasi untuk Vercel. `vercel.json` sudah menyertakan rewrite rule untuk SPA routing.

```bash
vercel deploy
```

Pastikan environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GEMINI_API_KEY`) sudah diset di dashboard Vercel.

---

## PWA

Aplikasi ini bisa diinstall sebagai PWA di iOS dan Android. Meta tag dan `manifest.json` sudah dikonfigurasi untuk standalone mode dengan safe area support.
