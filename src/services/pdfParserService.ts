// =============================================================================
// DiBeliin Admin - PDF Parser Service (Bank Jago E-Statement)
// =============================================================================
// Menggunakan pdfjs-dist untuk parsing PDF di browser (client-side).
// Output: array ParsedRow yang siap dipetakan ke transactions table.

export type ParsedRowType = 'credit' | 'debit';

export interface ParsedRow {
    client_id: string;         // temp key untuk React
    mutation_date: string;     // YYYY-MM-DD
    transaction_time: string;  // HH.mm
    source_dest: string;
    description: string;
    amount: number;
    type: ParsedRowType;
}

// -------------------------------------------------------------------------
// Internals
// -------------------------------------------------------------------------

const BULAN_MAP: Record<string, number> = {
    jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, jun: 6,
    jul: 7, agu: 8, sep: 9, okt: 10, nov: 11, des: 12,
    may: 5, aug: 8, oct: 10, dec: 12,
    maret: 3, april: 4, agustus: 8, oktober: 10, desember: 12,
    januari: 1, februari: 2, juni: 6, juli: 7, september: 9, november: 11,
};

const DATE_REGEX = /^(\d{1,2})\s+([A-Za-z]{2,9})\s+(\d{4})$/;
const TIME_REGEX = /^\d{1,2}\.\d{2}$/;
const SIGNED_AMOUNT_REGEX = /^[+-][\d.]+(?:,\d{2})?$/;

const HEADER_KEYWORDS = {
    date:    ['tanggal', 'waktu'],
    source:  ['sumber', 'tujuan'],
    desc:    ['rincian', 'transaksi', 'keterangan'],
    note:    ['catatan'],
    amount:  ['jumlah', 'nominal'],
    balance: ['saldo'],
};

interface TextItem { str: string; x: number; y: number; }

interface ColBound {
    name: 'date' | 'source' | 'desc' | 'note' | 'amount' | 'balance';
    xStart: number;
    xEnd: number;
}

interface TxnGroup {
    date: string; rawDate: string; time: string;
    source: string; desc: string; amountRaw: string;
}

function parseIndoDate(str: string): string | null {
    const m = str.trim().match(DATE_REGEX);
    if (!m) return null;
    const day = m[1].padStart(2, '0');
    const mon = BULAN_MAP[m[2].toLowerCase()];
    if (!mon) return null;
    return `${m[3]}-${String(mon).padStart(2, '0')}-${day}`;
}

function parseAmount(raw: string): number {
    return parseFloat(raw.replace(/^[+-]/, '').replace(/\./g, '').replace(',', '.')) || 0;
}

function headerKeyOf(text: string): keyof typeof HEADER_KEYWORDS | null {
    const t = text.toLowerCase();
    for (const [key, kws] of Object.entries(HEADER_KEYWORDS)) {
        if (kws.some((kw) => t.includes(kw))) return key as keyof typeof HEADER_KEYWORDS;
    }
    return null;
}

function getColumn(x: number, bounds: ColBound[]): ColBound['name'] | null {
    for (const b of bounds) if (x >= b.xStart && x < b.xEnd) return b.name;
    return null;
}

// -------------------------------------------------------------------------
// Main parser
// -------------------------------------------------------------------------

/**
 * Parse e-statement PDF Bank Jago dan kembalikan array ParsedRow.
 * Tidak ada pembatasan targetDate — semua transaksi diekstrak.
 */
export async function parseBankJagoPdf(file: File, password?: string): Promise<ParsedRow[]> {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc =
        `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

    const arrayBuffer = await file.arrayBuffer();

    let pdfDoc: Awaited<ReturnType<typeof pdfjsLib.getDocument>['promise']>;
    try {
        pdfDoc = await pdfjsLib.getDocument({
            data: new Uint8Array(arrayBuffer),
            password: password || undefined,
        }).promise;
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.toLowerCase().includes('password')) {
            throw new Error('PDF dilindungi password. Masukkan password yang benar.');
        }
        throw new Error(`Gagal membaca PDF: ${msg}`);
    }

    // Kumpulkan semua text items
    const allItems: TextItem[] = [];
    let pageHeightRef = 0;

    for (let p = 1; p <= pdfDoc.numPages; p++) {
        const page = await pdfDoc.getPage(p);
        const vp = page.getViewport({ scale: 1 });
        if (p === 1) pageHeightRef = vp.height;
        const tc = await page.getTextContent();
        for (const item of tc.items) {
            if (!('str' in item)) continue;
            const s = item.str.trim();
            if (!s) continue;
            const tx = item.transform;
            allItems.push({ str: s, x: tx[4], y: vp.height - tx[5] + (p - 1) * pageHeightRef });
        }
    }

    if (allItems.length === 0) throw new Error('PDF tidak mengandung teks yang dapat dibaca.');

    // Group by Y (toleransi 5px)
    allItems.sort((a, b) => a.y - b.y || a.x - b.x);
    const rowsArr: TextItem[][] = [];
    let curY = -9999, curRow: TextItem[] = [];
    for (const item of allItems) {
        if (Math.abs(item.y - curY) > 5) {
            if (curRow.length) rowsArr.push(curRow);
            curRow = [item]; curY = item.y;
        } else { curRow.push(item); }
    }
    if (curRow.length) rowsArr.push(curRow);
    rowsArr.forEach((r) => r.sort((a, b) => a.x - b.x));

    // Cari header row → ukur batas kolom
    let colBounds: ColBound[] = [];
    let headerIdx = -1;
    for (let i = 0; i < rowsArr.length; i++) {
        const row = rowsArr[i];
        const matches = row.filter((it) => headerKeyOf(it.str) !== null);
        if (matches.length >= 3) {
            headerIdx = i;
            const ident = row
                .map((it) => ({ key: headerKeyOf(it.str), x: it.x }))
                .filter((e) => e.key !== null) as { key: keyof typeof HEADER_KEYWORDS; x: number }[];
            ident.sort((a, b) => a.x - b.x);

            // Use MIDPOINT boundaries so right-aligned values (like Jumlah)
            // that appear LEFT of their header text are captured correctly.
            for (let j = 0; j < ident.length; j++) {
                const prevX = j === 0 ? 0 : ident[j - 1].x;
                const thisX = ident[j].x;
                const nextX = j + 1 < ident.length ? ident[j + 1].x : 9999;
                colBounds.push({
                    name: ident[j].key,
                    xStart: j === 0 ? 0 : Math.floor((prevX + thisX) / 2),
                    xEnd: j + 1 < ident.length ? Math.floor((thisX + nextX) / 2) : 9999,
                });
            }
            break;
        }
    }

    // Fallback: segmentasi proporsional
    if (colBounds.length === 0) {
        const allX = allItems.map((i) => i.x).sort((a, b) => a - b);
        const [minX, maxX] = [allX[0], allX[allX.length - 1]];
        const range = maxX - minX;
        const names: ColBound['name'][] = ['date','source','desc','note','amount','balance'];
        for (let j = 0; j < 6; j++) {
            colBounds.push({ name: names[j], xStart: minX + (range*j)/6 - 5, xEnd: minX + (range*(j+1))/6 + 5 });
        }
    }

    // -----------------------------------------------------------------------
    // POST-PROCESS COLUMN BOUNDS:
    // Ensure 'amount' (Jumlah) and 'balance' (Saldo) don't overlap.
    // Bank Jago PDF: Jumlah x≈1436-1461, Saldo x≈1676-1734
    // Hard separator: anything left of balance.xStart-10 belongs to amount.
    // -----------------------------------------------------------------------
    const amountBound = colBounds.find((b) => b.name === 'amount');
    const balanceBound = colBounds.find((b) => b.name === 'balance');
    if (amountBound && balanceBound) {
        // Tighten amount's right boundary to just before balance starts
        amountBound.xEnd = balanceBound.xStart - 5;
    } else if (amountBound) {
        // No balance column detected — cap amount at reasonable right bound
        amountBound.xEnd = Math.min(amountBound.xEnd, amountBound.xStart + 300);
    }


    // Parse transaksi
    const startIdx = headerIdx >= 0 ? headerIdx + 1 : 0;
    const txns: TxnGroup[] = [];
    let current: TxnGroup | null = null;

    for (let i = startIdx; i < rowsArr.length; i++) {
        const row = rowsArr[i];
        const firstItem = row[0];
        const parsedDate = firstItem ? parseIndoDate(firstItem.str) : null;

        if (parsedDate) {
            if (current) txns.push(current);
            current = { date: parsedDate, rawDate: firstItem!.str, time: '', source: '', desc: '', amountRaw: '' };
            for (let k = 1; k < row.length; k++) {
                const it = row[k];
                const col = getColumn(it.x, colBounds);
                if (col === 'source') current.source += ' ' + it.str;
                else if (col === 'desc') current.desc += ' ' + it.str;
                // ✅ Only take amount from 'amount' (Jumlah) col — never from 'balance' (Saldo)
                else if (col === 'amount' && !current.amountRaw) current.amountRaw = it.str;
                // col === 'balance' → deliberately skipped
            }
            continue;
        }

        if (!current) continue;
        const joined = row.map((i) => i.str).join(' ');

        // Skip page noise: footers, headers, column header repeats
        const isNoiseLine =
            /halaman\s+\d+/i.test(joined) ||
            /menampilkan/i.test(joined) ||
            /pt bank jago/i.test(joined) ||
            /berizin dan diawasi/i.test(joined) ||
            /otoritas jasa keuangan/i.test(joined) ||
            /penjamin simpanan/i.test(joined) ||
            /www\.jago\.com/i.test(joined) ||
            /pockets transactions/i.test(joined) ||
            /rincian transaksi/i.test(joined) ||
            /sumber\/tujuan/i.test(joined) ||
            /tanggal\s*&\s*waktu/i.test(joined) ||
            /saldo terbaru/i.test(joined) ||
            (/history/i.test(joined) && row.length <= 3);
        if (isNoiseLine) continue;


        for (const item of row) {
            const col = getColumn(item.x, colBounds);
            if ((col === 'date' || col === null) && TIME_REGEX.test(item.str) && !current.time) {
                current.time = item.str; continue;
            }
            if (col === 'source') current.source += ' ' + item.str;
            else if (col === 'desc') current.desc += ' ' + item.str;
            // ✅ Strictly use 'amount' (Jumlah) column only, skip 'balance' (Saldo)
            else if (col === 'amount' && !current.amountRaw) current.amountRaw = item.str;
            // Fallback: uncolumned signed amount — only if NOT from the balance column area
            else if (!current.amountRaw && col !== 'balance' && col === null && SIGNED_AMOUNT_REGEX.test(item.str)) {
                current.amountRaw = item.str;
            }
        }
    }
    if (current) txns.push(current);

    // Fallback linear scan jika semua amountRaw kosong
    const valid = txns.filter((t) => t.date && t.amountRaw);
    if (valid.length === 0) {
        // Try simple linear: setiap baris punya tanggal → kumpulkan sampai tanggal berikutnya
        let act: TxnGroup | null = null;
        const found: TxnGroup[] = [];
        for (const row of rowsArr.slice(startIdx)) {
            for (const item of row) {
                const pd = parseIndoDate(item.str);
                if (pd) {
                    if (act) found.push(act);
                    act = { date: pd, rawDate: item.str, time: '', source: '', desc: '', amountRaw: '' };
                    continue;
                }
                if (!act) continue;
                if (TIME_REGEX.test(item.str) && !act.time) { act.time = item.str; }
                else if (!act.amountRaw && SIGNED_AMOUNT_REGEX.test(item.str)) { act.amountRaw = item.str; }
                else if (!act.desc && item.str.length > 3) { act.desc = item.str; }
            }
        }
        if (act) found.push(act);
        if (!found.some((t) => t.amountRaw)) {
            throw new Error('Tidak ada data transaksi yang berhasil diekstrak. Pastikan file adalah e-statement Bank Jago yang valid.');
        }
        valid.splice(0, valid.length, ...found.filter((t) => t.date && t.amountRaw));
    }

    return valid.map((t, idx): ParsedRow => {
        const raw = t.amountRaw;
        let type: ParsedRowType;
        if (raw.startsWith('-')) {
            type = 'debit';
        } else if (raw.startsWith('+')) {
            type = 'credit';
        } else {
            // No sign prefix — use Rincian Transaksi (desc) to determine type
            const d = (t.desc + ' ' + t.source).toLowerCase();
            // Debit indicators
            if (
                d.includes('pembayaran') ||
                d.includes('transfer keluar') ||
                d.includes('tarik') ||
                d.includes('debit')
            ) {
                type = 'debit';
            }
            // Credit indicators
            else if (
                d.includes('transfer masuk') ||
                d.includes('terima') ||
                d.includes('top up') ||
                d.includes('credit') ||
                d.includes('masuk')
            ) {
                type = 'credit';
            } else {
                // Last resort: treat unsigned as debit (most common in e-statement)
                type = 'debit';
            }
        }
        return {
            client_id: `parsed-${Date.now()}-${idx}`,
            mutation_date: t.date,
            transaction_time: t.time.trim(),
            source_dest: t.source.trim().replace(/\s+/g, ' '),
            description: t.desc.trim().replace(/\s+/g, ' '),
            amount: parseAmount(raw),
            type,
        };
    });
}


// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

export function formatRupiah(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency', currency: 'IDR',
        minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(amount);
}
