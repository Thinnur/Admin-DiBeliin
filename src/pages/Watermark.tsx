// =============================================================================
// DiBeliin Admin - Watermark Foto
// =============================================================================
// Pilih foto testimoni -> diberi watermark DiBeliin -> unduh JPG.
// Semua diproses di browser: foto tidak dikirim ke server dan tidak disimpan di mana pun.

import { useEffect, useId, useRef, useState } from 'react';
import { Download, ImagePlus, Loader2, RotateCcw, Stamp, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
    DEFAULT_WATERMARK,
    canvasToJpeg,
    renderWatermark,
    watermarkFileName,
    type WatermarkOptions,
} from '@/lib/watermark';
import logoUrl from '@/assets/logo-dibeliin.png';

const SETTINGS_KEY = 'dibeliin-admin:watermark';
const WIDTHS: { label: string; value: number | null }[] = [
    { label: 'Asli', value: null },
    { label: '1080 px', value: 1080 },
    { label: '720 px', value: 720 },
];

interface WatermarkResult {
    opts: WatermarkOptions; // pengaturan saat hasil ini dibuat
    blob: Blob;
    url: string;
    w: number;
    h: number;
}

interface Photo {
    id: number;
    name: string;
    bitmap: ImageBitmap;
    result?: WatermarkResult;
}

let nextId = 1;
let logoPromise: Promise<HTMLImageElement> | null = null;

function getLogo() {
    logoPromise ??= (async () => {
        const img = new Image();
        img.src = logoUrl;
        await img.decode();
        return img;
    })();
    return logoPromise;
}

function loadSettings(): WatermarkOptions {
    try {
        const saved: unknown = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null');
        if (saved && typeof saved === 'object') return { ...DEFAULT_WATERMARK, ...saved };
    } catch {
        // localStorage tak tersedia / isi rusak: pakai bawaan
    }
    return DEFAULT_WATERMARK;
}

function saveFile(url: string, name: string) {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
}

// -----------------------------------------------------------------------------
// Slider persen
// -----------------------------------------------------------------------------

interface PercentSliderProps {
    label: string;
    value: number; // 0–1
    min: number; // persen
    max: number; // persen
    onChange: (value: number) => void;
}

function PercentSlider({ label, value, min, max, onChange }: PercentSliderProps) {
    const id = useId();
    const percent = Math.round(value * 100);
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <Label htmlFor={id}>{label}</Label>
                <span className="text-sm tabular-nums text-slate-500">{percent}%</span>
            </div>
            <input
                id={id}
                type="range"
                min={min}
                max={max}
                step={5}
                value={percent}
                onChange={(e) => onChange(Number(e.target.value) / 100)}
                className="w-full accent-amber-500"
            />
        </div>
    );
}

// -----------------------------------------------------------------------------
// Halaman
// -----------------------------------------------------------------------------

export default function WatermarkPage() {
    const [photos, setPhotos] = useState<Photo[]>([]);
    const [opts, setOpts] = useState<WatermarkOptions>(loadSettings);
    const [dragging, setDragging] = useState(false);
    const photosRef = useRef(photos);

    const update = (patch: Partial<WatermarkOptions>) => setOpts((prev) => ({ ...prev, ...patch }));

    useEffect(() => {
        try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(opts));
        } catch {
            // mode privat: pengaturan tidak diingat, tidak masalah
        }
    }, [opts]);

    // Bersihkan memori foto saat halaman ditinggal.
    useEffect(() => {
        photosRef.current = photos;
    }, [photos]);
    useEffect(
        () => () => {
            for (const p of photosRef.current) {
                p.bitmap.close();
                if (p.result) URL.revokeObjectURL(p.result.url);
            }
        },
        []
    );

    // Buat ulang hasil untuk foto yang belum diproses dengan pengaturan terbaru.
    // Ditunda 150 ms supaya geser slider tidak memproses ulang di tiap langkah.
    useEffect(() => {
        const todo = photos.filter((p) => p.result?.opts !== opts);
        if (!todo.length) return;
        let cancelled = false;
        const timer = setTimeout(async () => {
            try {
                const logo = await getLogo();
                const done = new Map<number, WatermarkResult>();
                for (const p of todo) {
                    const canvas = renderWatermark(p.bitmap, logo, opts);
                    const blob = await canvasToJpeg(canvas);
                    if (cancelled) return;
                    done.set(p.id, { opts, blob, url: '', w: canvas.width, h: canvas.height });
                }
                for (const r of done.values()) r.url = URL.createObjectURL(r.blob);
                setPhotos((prev) => prev.map((p) => (done.has(p.id) ? { ...p, result: done.get(p.id) } : p)));
                for (const p of todo) if (p.result) URL.revokeObjectURL(p.result.url);
            } catch (err) {
                if (!cancelled) toast.error(`Gagal memberi watermark: ${(err as Error).message}`);
            }
        }, 150);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [photos, opts]);

    async function addFiles(files: FileList | null) {
        const list = Array.from(files ?? []);
        const added: Photo[] = [];
        for (const file of list) {
            try {
                added.push({ id: nextId++, name: file.name, bitmap: await createImageBitmap(file) });
            } catch {
                toast.error(`${file.name} tidak bisa dibuka. Pakai JPG, PNG, atau WebP (HEIC iPhone belum didukung).`);
            }
        }
        if (added.length) setPhotos((prev) => [...prev, ...added]);
    }

    function removePhoto(photo: Photo) {
        photo.bitmap.close();
        if (photo.result) URL.revokeObjectURL(photo.result.url);
        setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    }

    function removeAll() {
        for (const p of photos) {
            p.bitmap.close();
            if (p.result) URL.revokeObjectURL(p.result.url);
        }
        setPhotos([]);
    }

    async function downloadAll() {
        for (const p of photos) {
            if (!p.result) continue;
            saveFile(p.result.url, watermarkFileName(p.name));
            await new Promise((r) => setTimeout(r, 400)); // browser menolak unduhan beruntun tanpa jeda
        }
    }

    const ready = photos.filter((p) => p.result?.opts === opts).length;

    return (
        <div className="space-y-6">
            {/* Pilih foto */}
            <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-slate-50">
                <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl shadow-lg shadow-amber-500/20">
                            <Stamp className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <CardTitle className="text-lg">Watermark Foto Testimoni</CardTitle>
                            <CardDescription>
                                Logo DiBeliin di tengah + pola tulisan samar. Foto diproses di browser ini saja, tidak
                                dikirim ke server.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <label
                        onDragOver={(e) => {
                            e.preventDefault();
                            setDragging(true);
                        }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={(e) => {
                            e.preventDefault();
                            setDragging(false);
                            void addFiles(e.dataTransfer.files);
                        }}
                        className={cn(
                            'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors',
                            dragging
                                ? 'border-amber-500 bg-amber-50'
                                : 'border-slate-300 bg-white hover:border-amber-400 hover:bg-amber-50/40'
                        )}
                    >
                        <ImagePlus className="h-8 w-8 text-amber-500" />
                        <span className="font-medium text-slate-700">Pilih atau seret foto ke sini</span>
                        <span className="text-xs text-slate-500">JPG, PNG, WebP · bisa banyak sekaligus</span>
                        <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="sr-only"
                            onChange={(e) => {
                                void addFiles(e.target.files);
                                e.target.value = ''; // supaya foto yang sama bisa dipilih lagi
                            }}
                        />
                    </label>
                </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-[320px_1fr] lg:items-start">
                {/* Pengaturan */}
                <Card className="border-0 shadow-lg">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base">Pengaturan</CardTitle>
                            <Button variant="ghost" size="sm" onClick={() => setOpts(DEFAULT_WATERMARK)}>
                                <RotateCcw />
                                Bawaan
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <div className="space-y-1.5">
                            <Label htmlFor="wm-text">Tulisan pola</Label>
                            <Input
                                id="wm-text"
                                value={opts.text}
                                maxLength={40}
                                onChange={(e) => update({ text: e.target.value })}
                            />
                        </div>
                        <PercentSlider
                            label="Kepekatan pola"
                            value={opts.patternOpacity}
                            min={0}
                            max={60}
                            onChange={(v) => update({ patternOpacity: v })}
                        />
                        <PercentSlider
                            label="Ukuran logo"
                            value={opts.logoSize}
                            min={10}
                            max={80}
                            onChange={(v) => update({ logoSize: v })}
                        />
                        <PercentSlider
                            label="Kepekatan logo"
                            value={opts.logoOpacity}
                            min={0}
                            max={100}
                            onChange={(v) => update({ logoOpacity: v })}
                        />
                        <div className="space-y-1.5">
                            <Label>Lebar maksimal hasil</Label>
                            <div className="grid grid-cols-3 gap-2">
                                {WIDTHS.map((w) => (
                                    <Button
                                        key={w.label}
                                        size="sm"
                                        variant={opts.maxWidth === w.value ? 'default' : 'outline'}
                                        aria-pressed={opts.maxWidth === w.value}
                                        onClick={() => update({ maxWidth: w.value })}
                                    >
                                        {w.label}
                                    </Button>
                                ))}
                            </div>
                            <p className="text-xs text-slate-500">Foto lebih kecil dari ini tidak diperbesar.</p>
                        </div>
                    </CardContent>
                </Card>

                {/* Hasil */}
                <div className="space-y-4">
                    {photos.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-300 px-4 py-12 text-center text-sm text-slate-500">
                            Hasil watermark muncul di sini.
                        </div>
                    ) : (
                        <>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm text-slate-600">
                                    {photos.length} foto{ready < photos.length && ' · memproses…'}
                                </p>
                                <div className="flex gap-2">
                                    <Button variant="ghost" size="sm" onClick={removeAll}>
                                        <Trash2 />
                                        Hapus semua
                                    </Button>
                                    <Button size="sm" disabled={ready < photos.length} onClick={() => void downloadAll()}>
                                        <Download />
                                        Unduh semua
                                    </Button>
                                </div>
                            </div>
                            <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
                                {photos.map((p) => (
                                    <div key={p.id} className="overflow-hidden rounded-xl border bg-white shadow-sm">
                                        <div className="flex aspect-[4/3] items-center justify-center bg-slate-100">
                                            {p.result ? (
                                                <img
                                                    src={p.result.url}
                                                    alt={p.name}
                                                    className="h-full w-full object-contain"
                                                />
                                            ) : (
                                                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                                            )}
                                        </div>
                                        <div className="space-y-2 p-3">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-medium text-slate-800" title={p.name}>
                                                    {p.name}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    {p.result
                                                        ? `${p.result.w}×${p.result.h} px · ${Math.ceil(p.result.blob.size / 1024)} KB`
                                                        : 'Memproses…'}
                                                </p>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    className="flex-1"
                                                    aria-label={`Unduh ${p.name}`}
                                                    disabled={p.result?.opts !== opts}
                                                    onClick={() => p.result && saveFile(p.result.url, watermarkFileName(p.name))}
                                                >
                                                    <Download />
                                                    Unduh
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="icon-sm"
                                                    aria-label={`Hapus ${p.name}`}
                                                    onClick={() => removePhoto(p)}
                                                >
                                                    <X />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
