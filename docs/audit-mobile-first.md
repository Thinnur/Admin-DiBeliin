# Persiapan Mobile-First — ADMIN DiBeliin

Diukur 2026-08-28 terhadap `src/` (84 berkas .ts/.tsx). Semua angka di bawah
hasil pemindaian, bukan perkiraan. Skrip pemindainya ada di bagian terakhir.

## Keadaan sekarang

| ukuran | nilai | arti |
|---|---|---|
| prefix `md:` / `lg:` / `xl:` | 434 | aplikasi ini **desktop-first**: mobile adalah kasus sisa |
| prefix `sm:` | 94 | 4,6x lebih sedikit daripada `md:` ke atas |
| `grid-cols-N` tanpa varian responsif | 22 | kolom banyak tetap dipaksakan di layar sempit |
| lebar mati `w-[>=100px]` | 53 | sebagian sah (lihat pengecualian), sebagian penyebab luberan |
| `min-w-[>=100px]` | 6 | ini yang paling ganas: tidak bisa menyusut sama sekali |
| `whitespace-nowrap` | 31 | tiap satu berpotensi meluber saat wadahnya menyempit |
| berkas bertabel | 18 | 4 di antaranya tanpa `overflow-x-auto` |

Rasio `md:` 434 vs `sm:` 94 itu inti masalahnya. Membalik ke mobile-first berarti
gaya dasar (tanpa prefix) yang jadi tampilan ponsel, lalu `md:` dipakai untuk
**menambah** kemewahan di layar lebar — bukan sebaliknya seperti sekarang.

## Urutan pengerjaan yang disarankan

Diurutkan dari yang paling banyak menghasilkan perbaikan per satuan usaha.

### 1. Empat tabel yang belum bisa digeser (paling murah, paling terasa)

```
src/components/ui/data-table.tsx          <- primitif, dipakai banyak halaman
src/components/operational/AntrianPesananTable.tsx
src/pages/OrderList.tsx
src/components/finance/ImportBankJagoDialog.tsx
```

`data-table.tsx` duluan: itu primitif bersama, satu perbaikan menutup banyak
halaman sekaligus. Tabel tanpa pembungkus scroll membuat SELURUH halaman bisa
digeser ke samping — bukan cuma tabelnya.

### 2. `grid-cols-N` tanpa varian responsif (22 tempat)

Penyumbang terbesar:

| berkas | pola |
|---|---|
| `src/pages/MenuManagement.tsx` | 7x `grid-cols-3`, 4x `grid-cols-2`, 1x `grid-cols-7` |
| `src/components/inventory/AddAccountDialog.tsx` | 5x `grid-cols-2` |
| `src/pages/DigitalTracking.tsx` | 3x |
| `src/pages/Finance.tsx` | 3x `grid-cols-2` + 1x `grid-cols-3` |

`grid-cols-7` di MenuManagement adalah kasus terburuk — tujuh kolom di layar
375px berarti ~50px per kolom. Pola penggantinya: `grid-cols-1 sm:grid-cols-2
lg:grid-cols-3`.

### 3. Lebar mati di dialog & filter

`AddAccountDialog` (`w-[540px]`) dan `Finance` (`w-[420px]`) lebih lebar
daripada layar ponsel mana pun. Dialog sebaiknya `w-full max-w-[540px]`.
`DayFilter.tsx` punya 2 `min-w-` yang menahan penyusutan.

### 4. `whitespace-nowrap` (31 tempat)

Tidak semuanya salah — pada label pendek justru benar. Yang perlu dicek: yang
menempel pada teks panjang atau sel tabel. Kejadian nyata hari ini: satu
`whitespace-nowrap` di layar pickup Fore meluber 30px dan menyeret seluruh
halaman, padahal teksnya cuma satu kalimat.

## Pengecualian — JANGAN diseragamkan

Pemindai menandai dua berkas ini berskor tinggi, tapi lebar matinya **disengaja**:

- `src/components/operational/KopkenPickupScreen.tsx` — 400px
- `src/components/operational/CheckoutResultDisplay.tsx` — 411px (layar Fore)

Keduanya replika layar aplikasi yang diekspor jadi PNG untuk dikirim ke
pelanggan; ukurannya diturunkan dari Compose di APK Fore dan dari bundel kopsu.
Per 2026-08-28 keduanya **sudah** mobile-safe dengan pola berikut, dan pola itu
yang harus dipertahankan:

```
di layar : w-full max-w-[400px]   (menyusut mengikuti ponsel)
saat ekspor : lebar dipaksa 400px sesaat lewat `lebarEkspor` di useEksporGambar,
              lalu dikembalikan  -> PNG selalu 800px, dari ponsel maupun desktop
```

Jangan menggantinya dengan `zoom`: html-to-image mengukur pakai `offsetWidth`,
dan `zoom` mengubah nilai itu sehingga ukuran PNG ikut berubah. `transform:
scale()` tidak mengubah `offsetWidth` tapi menyisakan ruang kosong di layout.

Jebakan terkait di berkas yang sama: **html-to-image menyalin computed style ke
elemen `<svg>` induk, tapi tidak ke anak-anaknya.** Warna di dalam `<path>`
harus atribut presentasi (`stroke="#c98751"`), bukan kelas CSS + `currentColor` —
kalau tidak, hasil ekspornya jatuh ke warna teks yang diwarisi.

## Cara memverifikasi (pakai ini tiap selesai satu halaman)

Jalankan di konsol browser pada lebar 375px. Angka `meluber` harus **0**:

```js
(() => {
  const de = document.documentElement;
  const nakal = [...document.querySelectorAll('*')]
    .filter(el => el.getBoundingClientRect().right > de.clientWidth + 1)
    .slice(0, 8)
    .map(el => ({ tag: el.tagName, kelas: (el.getAttribute('class') || '').slice(0, 70) }));
  return { meluber: de.scrollWidth - de.clientWidth, penyebab: nakal };
})()
```

`penyebab` mengurutkan dari elemen terluar, jadi entri pertama biasanya biang
keroknya — sisanya cuma anak yang ikut terseret.

## Skrip pemindai

Ada di riwayat sesi; intinya menghitung pola regex per berkas lalu memberi skor
`grid*3 + minW*3 + wMati*2 + tabelTanpaScroll*4 + nowrap`. Jalankan ulang setelah
pengerjaan untuk melihat angkanya turun.

## Sudah dikerjakan 2026-08-28

- Struk Kopken: `w-[400px]` -> lentur + lebar ekspor dipaksa. Luberan 49px -> 0.
- Layar pickup Fore: `w-[411px]` -> lentur + lebar ekspor dipaksa, `whitespace-nowrap`
  dilepas. Luberan 22px -> 0. PNG tetap 822x1648.
- `CheckoutProcess.tsx`: baris "Order berhasil dibuat" + badge diberi `flex-wrap`.
- 4 tabel tanpa scroll dibungkus/diganti `overflow-x-auto`: `data-table.tsx`
  (primitif bersama), `OrderList.tsx`, `AntrianPesananTable.tsx`,
  `ImportBankJagoDialog.tsx`.
- 8 dari 22 `grid-cols-N` mati diberi varian responsif (`grid-cols-1
  sm:grid-cols-2` / `sm:grid-cols-3`) — semuanya pasangan Label+Input di
  dialog yang kalau dipaksa berdampingan bikin kotak input terlalu sempit
  untuk placeholder-nya:
  `AddAccountDialog.tsx` (5x), `AddTransactionDialog.tsx`,
  `DigitalProducts.tsx` (form harga/durasi), `DigitalTracking.tsx` (3x).
  `MenuManagement.tsx` juga (8x): grid harga/diskon jadi `sm:grid-cols-3`,
  grid nama/brand jadi `sm:grid-cols-2`, grid switch ukuran (Small/Regular/
  Large) tetap 3 kolom tapi `gap-4`->`gap-2` karena isinya cuma
  switch+label pendek, muat di 320px tanpa perlu stack.

### Akar masalah yang ketemu belakangan: `CardHeader` itu grid

`overflow-x-auto` di pembungkus tabel **tidak cukup** untuk halaman yang taruh
konten lebar di `CardHeader` (mis. `TabsList` berisi 5 brand). Sebabnya:

`components/ui/card.tsx` -> `CardHeader` pakai `grid`. Item grid defaultnya
`min-width: auto`, artinya track menolak menyusut di bawah lebar min-content
anaknya. `TabsList` (isinya `whitespace-nowrap shrink-0`) melebarkan track ->
`CardHeader` meluber keluar Card -> `<main>` jadi bisa digeser ke samping.
`max-w-full` di TabsList tidak menolong karena `100%`-nya dihitung dari area
grid yang **sudah** terlanjur melebar.

Diukur di 375px pakai CSS asli aplikasi, struktur Card+CardHeader+TabsList:

```
tanpa [&>*]:min-w-0  -> luber 123px
dengan [&>*]:min-w-0 -> luber 0px      (lebar Card sendiri sama: 351px)
```

Perbaikannya satu kelas di primitifnya (`[&>*]:min-w-0` di `CardHeader`), bukan
di tiap halaman — semua halaman yang pakai `CardHeader` ikut kena benefitnya.
`CheckoutHistory.tsx` selama ini lolos karena kebetulan membungkus tab-nya
sendiri dengan `overflow-x-auto` di dalam `CardContent`, bukan di `CardHeader`.

**Pelajaran umum:** kalau halaman masih meluber padahal tabelnya sudah
`overflow-x-auto`, curigai leluhur yang `display:grid` atau `display:flex` —
`min-width:auto` di sana yang jadi biang keroknya, bukan tabelnya.

### Tabel lebar di ponsel: ganti jadi kartu, bukan digeser

Geser-kanan-kiri di tabel 8-9 kolom itu tidak terpakai di ponsel. Pola yang
dipakai di repo ini (asalnya dari `AntrianPesananTable.tsx`):

```
<div className="md:hidden space-y-2">      -> daftar kartu, 2-3 baris per entri
<div className="hidden md:block overflow-x-auto"> -> tabel penuh, desktop saja
```

Sudah diterapkan 2026-08-28 di `CheckoutHistory.tsx` dan `OrderList.tsx`.
Semua kolom tetap tampil, cuma disusun vertikal: baris 1 identitas + nominal,
baris 2 metadata (order#, waktu, jumlah item, status), baris 3 badge/aksi.

### Filter brand: chip membungkus, bukan strip yang digeser

`TabsList` bawaan punya `overflow-x-auto`, jadi tab yang kebanyakan "aman" —
tapi di ponsel hasilnya kotak kecil yang harus digeser ke samping, dan chip
yang kepotong tidak kelihatan sama sekali. Diukur di lebar konten 303px
dengan 5 brand + badge:

```
strip digeser (lama) : tinggi 40px, perlu digeser 238px, 3 chip kepotong
chip membungkus (baru): tinggi 80px, perlu digeser 0px,  0 chip kepotong
```

Aturannya: **≤3 tab -> satu baris penuh** (`flex-1`, seperti
`CheckoutHistory.tsx`); **≥4 tab -> biarkan membungkus** (`flex h-auto
flex-wrap gap-1`, seperti `OrderList.tsx`), balik ke satu baris di `sm:`.
Tukar 40px tinggi demi menghilangkan geseran samping — di halaman yang
dipakai buat memantau pesanan masuk, badge tiap brand harus kelihatan
sekaligus, bukan disembunyikan di balik scroll.

Catatan `cn()`: menimpa `inline-flex`/`h-10` bawaan `TabsList` memang jalan
(tailwind-merge membuang yang lama), sudah dicek langsung lewat `twMerge`.

### Panel setelan per grup di Calculator: dilipat

Tiap grup Kopken dulu menumpuk 5 baris kontrol (jadwal, plastik, metode bayar,
nomor blu, checkout) padahal nilainya hampir selalu sudah benar dari hasil
parse + `app_settings`. Sekarang jadi satu baris ringkasan + tombol checkout,
kontrolnya muncul kalau ditekan "Ubah". Diukur di lebar panel 275px:
207px -> 76px per grup (order 2 grup: hemat 262px).

Jebakan yang harus dipertahankan: kalau nomor blu kosong, panel **dipaksa
terbuka**. Tanpa itu admin kena toast "Masukkan nomor blu dulu" sementara
kolomnya tersembunyi — jalan buntu.

### Ditinjau tapi SENGAJA tidak diubah (bukan bug, false positive dari regex)

- **Lebar dialog `sm:max-w-[Npx]`** (`AddAccountDialog`, `AddTransactionDialog`,
  `DigitalProducts`, `DigitalTracking`, `DigitalProviders`, `OutletManagement`,
  `EditTransactionDialog`): base `DialogContent` (`components/ui/dialog.tsx`)
  sudah punya `w-full max-w-[calc(100%-2rem)] ... sm:max-w-lg` dari shadcn.
  `cn()` pakai `tailwind-merge`, jadi className tambahan cuma menang di
  breakpoint yang sama (`sm:`) — lebar dasar mobile tidak pernah tertimpa.
  Semua dialog di atas sudah mobile-safe sejak awal.
- **`min-w-[110px] md:min-w-[140px]`** di `DayFilter.tsx` (dipakai juga di
  `Finance.tsx`, `AntrianPesananTable.tsx`): pembungkusnya `flex flex-wrap`,
  jadi pill tanggal ikut turun baris kalau sempit, bukan memaksa luber.
  min-w di sini justru disengaja — mencegah lebar berubah-ubah (jitter) saat
  ganti bulan.
- **`SelectTrigger` lebar tetap** (`w-[130px]`/`w-[150px]` di `Inventory.tsx`,
  `AccountLogViewer.tsx`, dll): semua ada di dalam `flex flex-wrap` toolbar —
  sama seperti di atas, turun baris, tidak luber.
- **31 `whitespace-nowrap`**: sebagian besar base class komponen `ui/`
  (button, badge, tabs, table — memang harus nowrap untuk label pendek),
  sebagian isi sel tabel yang tabelnya sudah `overflow-x-auto`, sebagian
  angka/mata uang pendek yang wajar tidak boleh patah di tengah. Tidak ada
  lagi kasus seperti Fore pickup (teks panjang nempel di halaman, bukan di
  tabel/pill) yang belum tertangani.
- **Grid stat-tile 2/3 kolom pendek** (`ImportBankJagoDialog.tsx` ringkasan
  3 kolom, `DigitalProducts.tsx`/`Calculator.tsx`/`Finance.tsx` kartu 2
  kolom): isinya cuma angka + label pendek, grid track menyusut sendiri
  tanpa memaksa halaman luber — beda kasus dengan grid form Label+Input di
  atas yang justru butuh baris sendiri di ponsel.
