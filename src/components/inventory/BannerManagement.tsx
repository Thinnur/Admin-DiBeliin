// =============================================================================
// DiBeliin Admin - Banner Management Component
// =============================================================================
// Upload form with auto-compression preview + inline-editable CRUD table

import { useState, useRef } from 'react';
import { UploadCloud, Trash2, ImageIcon, Link, Hash, Loader2 } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

import { useBanners, compressToWebP } from '@/hooks/useBanners';
import type { Banner } from '@/services/bannerService';

// -----------------------------------------------------------------------------
// Upload Form
// -----------------------------------------------------------------------------

interface UploadFormProps {
    isUploading: boolean;
    onUpload: (file: File, targetUrl: string | null, sequence: number) => Promise<void>;
}

function UploadForm({ isUploading, onUpload }: UploadFormProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [originalSize, setOriginalSize] = useState<number>(0);
    const [compressedSize, setCompressedSize] = useState<number | null>(null);
    const [isCompressing, setIsCompressing] = useState(false);
    const [targetUrl, setTargetUrl] = useState('');
    const [sequence, setSequence] = useState('0');

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Show original preview
        const objectUrl = URL.createObjectURL(file);
        setPreviewUrl(objectUrl);
        setSelectedFile(file);
        setOriginalSize(file.size);
        setCompressedSize(null);

        // Run compression preview
        setIsCompressing(true);
        try {
            const compressed = await compressToWebP(file);
            setCompressedSize(compressed.size);
        } catch {
            // If compression preview fails, still allow upload
        } finally {
            setIsCompressing(false);
        }
    };

    const resetForm = () => {
        setSelectedFile(null);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        setOriginalSize(0);
        setCompressedSize(null);
        setTargetUrl('');
        setSequence('0');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedFile) return;

        await onUpload(
            selectedFile,
            targetUrl.trim() || null,
            Number(sequence) || 0
        );

        resetForm();
    };

    const formatBytes = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        return `${(bytes / 1024).toFixed(1)} KB`;
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            {/* File Drop Zone */}
            <div className="space-y-2">
                <Label>Gambar Banner</Label>
                <div
                    className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center cursor-pointer hover:border-violet-400 hover:bg-violet-50/50 transition-all"
                    onClick={() => fileInputRef.current?.click()}
                >
                    {previewUrl ? (
                        <div className="space-y-3">
                            <img
                                src={previewUrl}
                                alt="Preview"
                                className="max-h-40 mx-auto rounded-lg object-contain shadow-md"
                            />
                            {/* Size Info */}
                            <div className="flex items-center justify-center gap-3 text-sm">
                                <span className="text-slate-500">
                                    Asli: <span className="font-medium text-slate-700">{formatBytes(originalSize)}</span>
                                </span>
                                {isCompressing ? (
                                    <span className="flex items-center gap-1 text-violet-500">
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        Menghitung...
                                    </span>
                                ) : compressedSize !== null && (
                                    <>
                                        <span className="text-slate-300">→</span>
                                        <span className={compressedSize <= 100 * 1024
                                            ? 'text-emerald-600 font-semibold'
                                            : 'text-amber-600 font-semibold'
                                        }>
                                            WebP: {formatBytes(compressedSize)}
                                        </span>
                                    </>
                                )}
                            </div>
                            <p className="text-xs text-slate-400">Klik untuk ganti gambar</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <UploadCloud className="h-10 w-10 mx-auto text-slate-300" />
                            <p className="text-sm font-medium text-slate-600">Klik untuk memilih gambar</p>
                            <p className="text-xs text-slate-400">PNG, JPG, WebP (otomatis dikompresi ke WebP &lt;100KB)</p>
                        </div>
                    )}
                </div>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                />
            </div>

            {/* Other Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="target-url" className="flex items-center gap-1.5">
                        <Link className="h-3.5 w-3.5" />
                        Link Tujuan
                        <span className="text-slate-400 font-normal">(opsional)</span>
                    </Label>
                    <Input
                        id="target-url"
                        type="url"
                        placeholder="https://..."
                        value={targetUrl}
                        onChange={(e) => setTargetUrl(e.target.value)}
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="sequence" className="flex items-center gap-1.5">
                        <Hash className="h-3.5 w-3.5" />
                        Urutan (Sequence)
                    </Label>
                    <Input
                        id="sequence"
                        type="number"
                        placeholder="0"
                        min="0"
                        value={sequence}
                        onChange={(e) => setSequence(e.target.value)}
                    />
                </div>
            </div>

            <div className="flex gap-3">
                <Button
                    type="submit"
                    disabled={!selectedFile || isUploading || isCompressing}
                    className="bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700"
                >
                    {isUploading ? (
                        <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Mengupload...
                        </>
                    ) : (
                        <>
                            <UploadCloud className="h-4 w-4 mr-2" />
                            Upload Banner
                        </>
                    )}
                </Button>
                {selectedFile && (
                    <Button type="button" variant="ghost" onClick={resetForm}>
                        Batal
                    </Button>
                )}
            </div>
        </form>
    );
}

// -----------------------------------------------------------------------------
// Inline Sequence Cell
// -----------------------------------------------------------------------------

interface SequenceCellProps {
    banner: Banner;
    isSaving: boolean;
    onSave: (id: string, sequence: number) => void;
}

function SequenceCell({ banner, isSaving, onSave }: SequenceCellProps) {
    const [value, setValue] = useState(String(banner.sequence));

    const commit = () => {
        const num = Number(value);
        if (!isNaN(num) && num !== banner.sequence) {
            onSave(banner.id, num);
        }
    };

    return (
        <div className="flex items-center gap-1.5 w-24">
            <Input
                type="number"
                min="0"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => e.key === 'Enter' && commit()}
                className="h-8 text-center px-2 text-sm"
                disabled={isSaving}
            />
            {isSaving && <Loader2 className="h-3 w-3 animate-spin text-violet-500 shrink-0" />}
        </div>
    );
}

// -----------------------------------------------------------------------------
// Banner Table
// -----------------------------------------------------------------------------

interface BannerTableProps {
    banners: Banner[];
    savingId: string | null;
    deletingId: string | null;
    onUpdateSequence: (id: string, sequence: number) => void;
    onToggleActive: (id: string, currentValue: boolean) => void;
    onDelete: (id: string, imageUrl: string) => void;
}

function BannerTable({
    banners,
    savingId,
    deletingId,
    onUpdateSequence,
    onToggleActive,
    onDelete,
}: BannerTableProps) {
    if (banners.length === 0) {
        return (
            <div className="text-center py-16 text-slate-400">
                <ImageIcon className="h-14 w-14 mx-auto mb-3 text-slate-200" />
                <p className="font-medium text-slate-500">Belum ada banner</p>
                <p className="text-sm">Upload banner menggunakan form di atas</p>
            </div>
        );
    }

    return (
        <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-100">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead className="w-[100px]">Thumbnail</TableHead>
                            <TableHead className="w-[80px]">Urutan</TableHead>
                            <TableHead>Link Tujuan</TableHead>
                            <TableHead className="w-[100px]">Status</TableHead>
                            <TableHead className="w-[80px]" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {banners.map((banner) => (
                            <TableRow key={banner.id} className="group">
                                {/* Thumbnail */}
                                <TableCell>
                                    <div className="w-20 h-12 rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                                        <img
                                            src={banner.image_url}
                                            alt={`Banner #${banner.id}`}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                </TableCell>

                                {/* Sequence (Inline Edit) */}
                                <TableCell>
                                    <SequenceCell
                                        banner={banner}
                                        isSaving={savingId === banner.id}
                                        onSave={onUpdateSequence}
                                    />
                                </TableCell>

                                {/* Target URL */}
                                <TableCell>
                                    {banner.target_url ? (
                                        <a
                                            href={banner.target_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-sm text-violet-600 hover:underline truncate max-w-xs block"
                                        >
                                            {banner.target_url}
                                        </a>
                                    ) : (
                                        <span className="text-slate-400 text-sm italic">—</span>
                                    )}
                                </TableCell>

                                {/* is_active Toggle */}
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <Switch
                                            checked={banner.is_active}
                                            onCheckedChange={() => onToggleActive(banner.id, banner.is_active)}
                                            disabled={savingId === banner.id}
                                            className="data-[state=checked]:bg-violet-600"
                                        />
                                        <Badge
                                            className={banner.is_active
                                                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
                                                : 'bg-slate-100 text-slate-500 hover:bg-slate-100'
                                            }
                                        >
                                            {banner.is_active ? 'Aktif' : 'Nonaktif'}
                                        </Badge>
                                    </div>
                                </TableCell>

                                {/* Delete */}
                                <TableCell>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                                                disabled={deletingId === banner.id}
                                            >
                                                {deletingId === banner.id
                                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                                    : <Trash2 className="h-4 w-4" />
                                                }
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Hapus Banner?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Tindakan ini akan menghapus banner dari database{' '}
                                                    <strong>dan</strong> file gambar dari Storage secara permanen.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Batal</AlertDialogCancel>
                                                <AlertDialogAction
                                                    onClick={() => onDelete(banner.id, banner.image_url)}
                                                    className="bg-red-600 hover:bg-red-700"
                                                >
                                                    Hapus
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* Mobile Card List */}
            <div className="md:hidden space-y-3">
                {banners.map((banner) => (
                    <div
                        key={banner.id}
                        className="flex gap-3 p-3 rounded-xl border border-slate-100 bg-white"
                    >
                        {/* Thumbnail */}
                        <div className="w-20 h-16 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                            <img
                                src={banner.image_url}
                                alt={`Banner #${banner.id}`}
                                className="w-full h-full object-cover"
                            />
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-2">
                                <Badge
                                    className={banner.is_active
                                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
                                        : 'bg-slate-100 text-slate-500 hover:bg-slate-100'
                                    }
                                >
                                    {banner.is_active ? 'Aktif' : 'Nonaktif'}
                                </Badge>
                                <span className="text-xs text-slate-400">Urutan: {banner.sequence}</span>
                            </div>
                            {banner.target_url && (
                                <p className="text-xs text-violet-600 truncate">{banner.target_url}</p>
                            )}

                            {/* Mobile Controls */}
                            <div className="flex items-center gap-3 pt-1">
                                <Switch
                                    checked={banner.is_active}
                                    onCheckedChange={() => onToggleActive(banner.id, banner.is_active)}
                                    disabled={savingId === banner.id}
                                    className="data-[state=checked]:bg-violet-600 scale-90"
                                />
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 px-2 text-slate-400 hover:text-red-500 hover:bg-red-50 text-xs"
                                            disabled={deletingId === banner.id}
                                        >
                                            {deletingId === banner.id
                                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                                : <Trash2 className="h-3 w-3 mr-1" />
                                            }
                                            Hapus
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Hapus Banner?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Tindakan ini akan menghapus banner dari database{' '}
                                                <strong>dan</strong> file gambar dari Storage secara permanen.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Batal</AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={() => onDelete(banner.id, banner.image_url)}
                                                className="bg-red-600 hover:bg-red-700"
                                            >
                                                Hapus
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}

// -----------------------------------------------------------------------------
// Main Export
// -----------------------------------------------------------------------------

export default function BannerManagement() {
    const {
        banners,
        isLoading,
        isUploading,
        savingId,
        deletingId,
        handleUpload,
        handleUpdateSequence,
        handleToggleActive,
        handleDelete,
    } = useBanners();

    return (
        <div className="space-y-6">
            {/* Upload Card */}
            <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-slate-50">
                <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl shadow-lg shadow-violet-500/20">
                            <UploadCloud className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <CardTitle className="text-lg">Upload Banner Baru</CardTitle>
                            <CardDescription>
                                Gambar akan otomatis dikonversi ke WebP dan dikompres di bawah 100 KB
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <UploadForm isUploading={isUploading} onUpload={handleUpload} />
                </CardContent>
            </Card>

            {/* Banner List Card */}
            <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-slate-50">
                <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-gradient-to-br from-slate-600 to-slate-700 rounded-xl shadow-lg">
                                <ImageIcon className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">Daftar Banner</CardTitle>
                                <CardDescription>
                                    {isLoading
                                        ? 'Memuat...'
                                        : `${banners.length} banner terdaftar · Edit urutan dengan klik angkanya langsung`
                                    }
                                </CardDescription>
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="text-center py-16">
                            <Loader2 className="h-8 w-8 animate-spin mx-auto text-violet-400 mb-3" />
                            <p className="text-slate-500 text-sm">Memuat data banner...</p>
                        </div>
                    ) : (
                        <BannerTable
                            banners={banners}
                            savingId={savingId}
                            deletingId={deletingId}
                            onUpdateSequence={handleUpdateSequence}
                            onToggleActive={handleToggleActive}
                            onDelete={handleDelete}
                        />
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
