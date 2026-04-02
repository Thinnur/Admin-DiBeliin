// =============================================================================
// DiBeliin Admin - Import Bank Jago Dialog (v3)
// =============================================================================

import { useState, useRef, useCallback } from 'react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
    Upload, FileText, X, Lock, Eye, EyeOff, ScanLine, AlertCircle,
    TrendingUp, TrendingDown, Trash2, Save, Landmark,
} from 'lucide-react';
import { toast } from 'sonner';

import { TransactionCategoryInput } from '@/components/finance/TransactionCategoryInput';
import { useTransactionCategories } from '@/hooks/useFinance';
import { getCategorySuggestions, normalizeCategoryValue } from '@/lib/financeCategories';
import { parseBankJagoPdf, formatRupiah, type ParsedRow, type ParsedRowType } from '@/services/pdfParserService';
import { createTransaction } from '@/services/apiTransactions';
import { queryClient, queryKeys } from '@/lib/queryClient';
import { cn } from '@/lib/utils';

// -------------------------------------------------------------------------
// Categories
// -------------------------------------------------------------------------
const INCOME_CATS  = [
    { value: 'penjualan', label: 'Penjualan' },
    { value: 'jasa',      label: 'Jasa' },
    { value: 'lain',      label: 'Lainnya' },
];
const EXPENSE_CATS = [
    { value: 'beli_akun',   label: 'Beli Akun' },
    { value: 'server',      label: 'Server' },
    { value: 'operasional', label: 'Operasional' },
    { value: 'marketing',   label: 'Marketing' },
    { value: 'lain',        label: 'Lainnya' },
];

interface PreviewRow extends ParsedRow { category: string; }

function guessCategory(src: string, type: ParsedRowType): string {
    const d = src.toLowerCase();
    if (type === 'credit') return 'penjualan';
    // Kopi Kenangan & Fore Coffee = Operasional (pembelian voucher)
    if (d.includes('kopi kenangan') || d.includes('fore coffee')) return 'operasional';
    if (d.includes('server') || d.includes('hosting')) return 'server';
    if (d.includes('marketing') || d.includes('ads'))  return 'marketing';
    if (d.includes('operasional'))                       return 'operasional';
    return 'lain';
}

// -------------------------------------------------------------------------
// Component
// -------------------------------------------------------------------------
export function ImportBankJagoDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
    type Step = 'upload' | 'preview';
    const [step, setStep]           = useState<Step>('upload');
    const [file, setFile]           = useState<File | null>(null);
    const [password, setPassword]   = useState('');
    const [showPwd, setShowPwd]     = useState(false);
    const [isDrag, setIsDrag]       = useState(false);
    const [isParsing, setIsParsing] = useState(false);
    const [isSaving, setIsSaving]   = useState(false);
    const [error, setError]         = useState<string | null>(null);
    const [rows, setRows]           = useState<PreviewRow[]>([]);
    const fileRef = useRef<HTMLInputElement>(null);
    const { data: categoryGroups } = useTransactionCategories();

    const reset = useCallback(() => {
        setStep('upload'); setFile(null); setPassword('');
        setError(null); setRows([]);
    }, []);

    const handleClose = (v: boolean) => { if (!v) reset(); onOpenChange(v); };
    const setFileV = (f: File) => {
        if (f.type !== 'application/pdf') { toast.error('Hanya file PDF.'); return; }
        setFile(f); setError(null);
    };

    const handleParse = async () => {
        if (!file) return;
        setIsParsing(true); setError(null);
        try {
            const parsed = await parseBankJagoPdf(file, password || undefined);
            setRows(parsed.map(r => ({ ...r, category: guessCategory(r.source_dest, r.type) })));
            setStep('preview');
            toast.success(`${parsed.length} transaksi diekstrak.`);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Gagal memproses PDF');
        } finally { setIsParsing(false); }
    };

    const upd = (id: string, p: Partial<PreviewRow>) =>
        setRows(prev => prev.map(r => r.client_id === id ? { ...r, ...p } : r));
    const del = (id: string) => setRows(prev => prev.filter(r => r.client_id !== id));

    const handleSave = async () => {
        if (!rows.length) return;
        if (rows.some((row) => !normalizeCategoryValue(row.category))) {
            toast.error('Masih ada kategori yang kosong. Isi dulu sebelum simpan.');
            return;
        }

        setIsSaving(true);
        let ok = 0; const errs: string[] = [];
        for (const row of rows) {
            try {
                await createTransaction({
                    transaction_type: row.type === 'credit' ? 'income' : 'expense',
                    amount: row.amount,
                    category: normalizeCategoryValue(row.category),
                    description: row.source_dest || row.description || 'Import Bank Jago',
                    related_account_id: null,
                    date: row.mutation_date,
                    time: row.transaction_time,
                });
                ok++;
            } catch (e) { errs.push(e instanceof Error ? e.message : '?'); }
        }
        await queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
        if (ok)        toast.success(`${ok} transaksi diimport ke Finance.`);
        if (errs.length) toast.error(`${errs.length} gagal: ${errs[0]}`);
        setIsSaving(false);
        if (!errs.length) handleClose(false);
    };

    const totalIn  = rows.filter(r => r.type === 'credit').reduce((s, r) => s + r.amount, 0);
    const totalOut = rows.filter(r => r.type === 'debit').reduce((s, r) => s + r.amount, 0);

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------
    return (
        <Dialog open={open} onOpenChange={handleClose}>
            {/* DialogContent with INLINE STYLE to force full width — overrides sm:max-w-lg */}
            <DialogContent
                className="flex flex-col gap-0 p-0 overflow-hidden !max-w-none"
                style={{
                    width: step === 'preview' ? 'min(1100px, 96vw)' : '460px',
                    maxWidth: 'none',
                    maxHeight: '93vh',
                }}
            >
                {/* Header */}
                <DialogHeader className="px-6 pt-5 pb-4 border-b border-slate-100 shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-xl shrink-0">
                                <Landmark className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <DialogTitle className="text-base font-semibold">Import Mutasi Bank Jago</DialogTitle>
                                <DialogDescription className="text-sm text-slate-500 mt-0.5">
                                    {step === 'upload'
                                        ? 'Upload e-statement PDF → transaksi masuk ke Finance'
                                        : `${rows.length} transaksi siap diimport · Atur tipe & kategori lalu simpan`}
                                </DialogDescription>
                            </div>
                        </div>
                        {step === 'preview' && (
                            <Button variant="outline" size="sm" onClick={() => setStep('upload')} className="gap-1.5 shrink-0">
                                <Upload className="h-3.5 w-3.5" /> Ganti File
                            </Button>
                        )}
                    </div>
                </DialogHeader>

                {/* Body */}
                <div className="flex-1 overflow-auto">
                    {step === 'upload' ? (
                        /* ── UPLOAD ── */
                        <div className="p-6 flex flex-col gap-5">
                            <div
                                onDragOver={e => { e.preventDefault(); setIsDrag(true); }}
                                onDragLeave={() => setIsDrag(false)}
                                onDrop={e => { e.preventDefault(); setIsDrag(false); const f = e.dataTransfer.files[0]; if (f) setFileV(f); }}
                                onClick={() => fileRef.current?.click()}
                                className={cn(
                                    'border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all select-none',
                                    isDrag  ? 'border-blue-400 bg-blue-50'
                                    : file  ? 'border-emerald-400 bg-emerald-50'
                                    :         'border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/40'
                                )}
                            >
                                <input ref={fileRef} type="file" accept="application/pdf" className="hidden"
                                    onChange={e => { const f = e.target.files?.[0]; if (f) setFileV(f); }} />
                                {file ? (
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="p-3 bg-emerald-100 rounded-2xl"><FileText className="h-8 w-8 text-emerald-600" /></div>
                                        <p className="font-semibold text-emerald-700">{file.name}</p>
                                        <p className="text-sm text-slate-400">{(file.size/1024).toFixed(1)} KB</p>
                                        <button onClick={e => { e.stopPropagation(); setFile(null); }}
                                            className="text-sm text-red-500 hover:text-red-700 flex items-center gap-1">
                                            <X className="h-3.5 w-3.5" />Hapus
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="p-3 bg-slate-200 rounded-2xl"><Upload className="h-8 w-8 text-slate-500" /></div>
                                        <div>
                                            <p className="font-semibold text-slate-700">{isDrag ? 'Lepaskan di sini' : 'Drag & drop PDF Bank Jago'}</p>
                                            <p className="text-sm text-slate-400 mt-1">atau klik untuk pilih file</p>
                                        </div>
                                        <span className="text-xs text-slate-400 bg-slate-200 px-3 py-1 rounded-full">Hanya 1 file PDF</span>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="flex items-center gap-1.5 text-sm font-medium text-slate-600 mb-2">
                                    <Lock className="h-3.5 w-3.5" />Password PDF
                                    <span className="text-slate-400 font-normal text-xs">(opsional)</span>
                                </label>
                                <div className="relative">
                                    <input type={showPwd ? 'text' : 'password'} value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        placeholder="Masukkan password jika e-statement dienkripsi..."
                                        className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 pr-10 outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent" />
                                    <button type="button" onClick={() => setShowPwd(p => !p)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                        {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            {error && (
                                <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /><p>{error}</p>
                                </div>
                            )}

                            <Button onClick={handleParse} disabled={!file || isParsing}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2 h-11">
                                {isParsing
                                    ? <><div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Memproses PDF...</>
                                    : <><ScanLine className="h-4 w-4" />Parse &amp; Preview Transaksi</>}
                            </Button>
                        </div>
                    ) : (
                        /* ── PREVIEW ── */
                        <div className="p-5 flex flex-col gap-4">
                            {/* Summary */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                                    <p className="text-xs text-slate-500">Transaksi</p>
                                    <p className="text-2xl font-bold text-slate-800">{rows.length}</p>
                                </div>
                                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                                    <div className="flex items-center justify-center gap-1 mb-0.5">
                                        <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                                        <p className="text-xs text-emerald-600 font-medium">Total Income</p>
                                    </div>
                                    <p className="text-base font-bold text-emerald-700">{formatRupiah(totalIn)}</p>
                                </div>
                                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                                    <div className="flex items-center justify-center gap-1 mb-0.5">
                                        <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                                        <p className="text-xs text-red-600 font-medium">Total Expense</p>
                                    </div>
                                    <p className="text-base font-bold text-red-700">{formatRupiah(totalOut)}</p>
                                </div>
                            </div>

                            {/* Table — proper <table> avoids grid-column crush issue */}
                            <div className="border border-slate-200 rounded-xl overflow-hidden">
                                <div style={{ maxHeight: '55vh', overflowY: 'auto' }}>
                                    <table className="w-full text-sm border-collapse">
                                        <thead className="sticky top-0 bg-slate-50 z-10">
                                            <tr className="border-b border-slate-200">
                                                <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wide px-4 py-2.5 w-20">Tgl</th>
                                                <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wide px-3 py-2.5">Keterangan (Sumber/Tujuan)</th>
                                                <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wide px-3 py-2.5 w-32">Tipe</th>
                                                <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wide px-3 py-2.5 w-36">Kategori</th>
                                                <th className="text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wide px-4 py-2.5 w-36">Nominal</th>
                                                <th className="w-10" />
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {rows.map(row => {
                                                const cats = row.type === 'credit' ? INCOME_CATS : EXPENSE_CATS;
                                                const categorySuggestions = getCategorySuggestions(
                                                    row.type === 'credit' ? 'income' : 'expense',
                                                    categoryGroups
                                                );
                                                return (
                                                    <tr key={row.client_id} className="hover:bg-slate-50 transition-colors">
                                                        {/* Tgl */}
                                                        <td className="px-4 py-3 whitespace-nowrap">
                                                            <p className="text-xs font-mono text-slate-700 font-medium">{row.mutation_date.slice(5).replace('-', '/')}</p>
                                                            {row.transaction_time && (
                                                                <p className="text-[10px] text-slate-400">{row.transaction_time}</p>
                                                            )}
                                                        </td>
                                                        {/* Keterangan — editable */}
                                                        <td className="px-3 py-3 max-w-0">
                                                            <input
                                                                type="text"
                                                                value={row.source_dest}
                                                                onChange={e => upd(row.client_id, { source_dest: e.target.value })}
                                                                className="w-full text-sm text-slate-800 font-medium bg-transparent border-0 outline-none hover:bg-slate-100 focus:bg-white focus:ring-1 focus:ring-blue-400 rounded px-1 py-0.5 -mx-1 transition-colors"
                                                                title={row.source_dest}
                                                            />
                                                            {row.description && row.description !== row.source_dest && (
                                                                <p className="text-xs text-slate-400 truncate px-1 mt-0.5">{row.description}</p>
                                                            )}
                                                        </td>
                                                        {/* Tipe */}
                                                        <td className="px-3 py-3">
                                                            <select
                                                                value={row.type}
                                                                onChange={e => {
                                                                    const t = e.target.value as ParsedRowType;
                                                                    upd(row.client_id, { type: t, category: t === 'credit' ? 'penjualan' : 'lain' });
                                                                }}
                                                                className={cn(
                                                                    'text-xs font-semibold px-2.5 py-1.5 rounded-lg border-0 outline-none cursor-pointer w-full',
                                                                    row.type === 'credit'
                                                                        ? 'bg-emerald-100 text-emerald-700'
                                                                        : 'bg-red-100 text-red-700'
                                                                )}
                                                            >
                                                                <option value="credit">Income</option>
                                                                <option value="debit">Expense</option>
                                                            </select>
                                                        </td>
                                                        {/* Kategori */}
                                                        <td className="px-3 py-3">
                                                            <TransactionCategoryInput
                                                                id={`import-category-${row.client_id}`}
                                                                value={row.category}
                                                                onChange={(value) => upd(row.client_id, { category: value })}
                                                                suggestions={categorySuggestions}
                                                                placeholder={cats[0]?.label ?? 'Kategori'}
                                                                className="h-8 text-xs"
                                                            />
                                                        </td>
                                                        {/* Nominal */}
                                                        <td className="px-4 py-3 text-right whitespace-nowrap">
                                                            <span className={cn(
                                                                'text-sm font-bold tabular-nums',
                                                                row.type === 'credit' ? 'text-emerald-600' : 'text-red-600'
                                                            )}>
                                                                {row.type === 'credit' ? '+' : '-'}
                                                                {formatRupiah(row.amount).replace('Rp\u00a0', 'Rp ')}
                                                            </span>
                                                        </td>
                                                        {/* Hapus */}
                                                        <td className="px-2 py-3 text-center">
                                                            <button onClick={() => del(row.client_id)}
                                                                className="text-slate-300 hover:text-red-500 transition-colors p-1">
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <p className="text-xs text-slate-400">
                                Baris yang dihapus tidak akan diimport · Ubah tipe untuk reset kategori otomatis
                            </p>

                            <Button onClick={handleSave} disabled={isSaving || !rows.length}
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2 h-11 text-sm">
                                {isSaving
                                    ? <><div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Menyimpan...</>
                                    : <><Save className="h-4 w-4" />Simpan {rows.length} Transaksi ke Finance</>}
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
