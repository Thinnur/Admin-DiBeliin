// =============================================================================
// DiBeliin Admin - Popup Template Management
// =============================================================================
// CRUD for "brand closed" popup templates (shared pool, picked per brand elsewhere)

import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, MessageSquareWarning, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
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

import {
    getPopupTemplates,
    createPopupTemplate,
    updatePopupTemplate,
    deletePopupTemplate,
    type PopupTemplate,
    type PopupTemplateInsert,
} from '@/services/popupTemplateService';

// -----------------------------------------------------------------------------
// Form (shared by create + edit)
// -----------------------------------------------------------------------------

interface TemplateFormValues {
    name: string;
    emoji: string;
    title: string;
    message: string;
    button_text: string;
}

const EMPTY_FORM: TemplateFormValues = {
    name: '',
    emoji: '🚧',
    title: '{brand} Sedang Tutup',
    message: 'Mohon maaf, saat ini menu {brand} sedang tutup dan belum dapat diakses. Untuk keterangan lebih lanjut, silakan hubungi pengelola.',
    button_text: 'Chat Admin',
};

function TemplateFields({
    values,
    onChange,
    disabled,
}: {
    values: TemplateFormValues;
    onChange: (values: TemplateFormValues) => void;
    disabled: boolean;
}) {
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_100px] gap-4">
                <div className="space-y-2">
                    <Label>Nama Templat</Label>
                    <Input
                        placeholder="mis. Libur Lebaran"
                        value={values.name}
                        onChange={(e) => onChange({ ...values, name: e.target.value })}
                        disabled={disabled}
                    />
                </div>
                <div className="space-y-2">
                    <Label>Emoji</Label>
                    <Input
                        value={values.emoji}
                        onChange={(e) => onChange({ ...values, emoji: e.target.value })}
                        disabled={disabled}
                        maxLength={4}
                        className="text-center text-lg"
                    />
                </div>
            </div>
            <div className="space-y-2">
                <Label>Judul</Label>
                <Input
                    value={values.title}
                    onChange={(e) => onChange({ ...values, title: e.target.value })}
                    disabled={disabled}
                />
            </div>
            <div className="space-y-2">
                <Label>Pesan</Label>
                <Textarea
                    rows={3}
                    value={values.message}
                    onChange={(e) => onChange({ ...values, message: e.target.value })}
                    disabled={disabled}
                />
                <p className="text-[11px] text-slate-500">
                    Pakai <code className="bg-slate-100 px-1 rounded">{'{brand}'}</code> di judul/pesan untuk otomatis diganti nama brand (mis. "Kopi Kenangan").
                </p>
            </div>
            <div className="space-y-2">
                <Label>Teks Tombol</Label>
                <Input
                    value={values.button_text}
                    onChange={(e) => onChange({ ...values, button_text: e.target.value })}
                    disabled={disabled}
                />
            </div>
        </div>
    );
}

// -----------------------------------------------------------------------------
// Edit Dialog
// -----------------------------------------------------------------------------

function EditTemplateDialog({
    template,
    onSaved,
}: {
    template: PopupTemplate;
    onSaved: (updated: PopupTemplate) => void;
}) {
    const [open, setOpen] = useState(false);
    const [values, setValues] = useState<TemplateFormValues>(template);
    const [isSaving, setIsSaving] = useState(false);

    const handleOpenChange = (next: boolean) => {
        setOpen(next);
        if (next) setValues(template);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const updated = await updatePopupTemplate(template.id, values);
            onSaved(updated);
            toast.success('Templat berhasil diperbarui');
            setOpen(false);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Gagal memperbarui templat');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-violet-600 hover:bg-violet-50" onClick={() => handleOpenChange(true)}>
                <Pencil className="h-4 w-4" />
            </Button>
            <DialogContent>
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Edit Templat</DialogTitle>
                        <DialogDescription>Perubahan berlaku untuk semua brand yang sedang memakai templat ini.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <TemplateFields values={values} onChange={setValues} disabled={isSaving} />
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={isSaving}>
                            {isSaving ? 'Menyimpan...' : 'Simpan'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// -----------------------------------------------------------------------------
// Create Form
// -----------------------------------------------------------------------------

function CreateTemplateForm({ onCreated }: { onCreated: (created: PopupTemplate) => void }) {
    const [values, setValues] = useState<TemplateFormValues>(EMPTY_FORM);
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!values.name.trim()) {
            toast.error('Nama templat wajib diisi');
            return;
        }
        setIsSaving(true);
        try {
            const payload: PopupTemplateInsert = { ...values, name: values.name.trim() };
            const created = await createPopupTemplate(payload);
            onCreated(created);
            toast.success(`Templat "${created.name}" berhasil dibuat`);
            setValues(EMPTY_FORM);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Gagal membuat templat');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <TemplateFields values={values} onChange={setValues} disabled={isSaving} />
            <Button type="submit" disabled={isSaving}>
                <Plus className="h-4 w-4 mr-2" />
                {isSaving ? 'Menyimpan...' : 'Tambah Templat'}
            </Button>
        </form>
    );
}

// -----------------------------------------------------------------------------
// Main Export
// -----------------------------------------------------------------------------

export default function PopupTemplateManagement() {
    const [templates, setTemplates] = useState<PopupTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    useEffect(() => {
        getPopupTemplates()
            .then(setTemplates)
            .catch((error) => toast.error(error instanceof Error ? error.message : 'Gagal memuat templat'))
            .finally(() => setIsLoading(false));
    }, []);

    const handleDelete = async (id: string) => {
        setDeletingId(id);
        try {
            await deletePopupTemplate(id);
            setTemplates((prev) => prev.filter((t) => t.id !== id));
            toast.success('Templat dihapus');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Gagal menghapus templat');
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="space-y-6">
            <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-slate-50">
                <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-br from-rose-500 to-rose-600 rounded-xl shadow-lg shadow-rose-500/20">
                            <MessageSquareWarning className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <CardTitle className="text-lg">Templat Baru</CardTitle>
                            <CardDescription>Buat teks popup baru untuk dipilih nanti per brand</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <CreateTemplateForm onCreated={(created) => setTemplates((prev) => [...prev, created])} />
                </CardContent>
            </Card>

            <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-slate-50">
                <CardHeader className="pb-4">
                    <CardTitle className="text-lg">Daftar Templat</CardTitle>
                    <CardDescription>
                        {isLoading ? 'Memuat...' : `${templates.length} templat tersedia · pilih templat aktif per brand di tab Operasional`}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="text-center py-16">
                            <Loader2 className="h-8 w-8 animate-spin mx-auto text-violet-400 mb-3" />
                        </div>
                    ) : templates.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            <MessageSquareWarning className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                            <p className="font-medium">Belum ada templat</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[50px]"></TableHead>
                                        <TableHead>Nama</TableHead>
                                        <TableHead>Judul</TableHead>
                                        <TableHead>Tombol</TableHead>
                                        <TableHead className="w-[90px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {templates.map((template) => (
                                        <TableRow key={template.id}>
                                            <TableCell className="text-xl">{template.emoji}</TableCell>
                                            <TableCell className="font-medium text-slate-900">{template.name}</TableCell>
                                            <TableCell className="text-sm text-slate-500 max-w-xs truncate">{template.title}</TableCell>
                                            <TableCell className="text-sm text-slate-500">{template.button_text}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center justify-end gap-1">
                                                    <EditTemplateDialog
                                                        template={template}
                                                        onSaved={(updated) =>
                                                            setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
                                                        }
                                                    />
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50"
                                                                disabled={deletingId === template.id}
                                                            >
                                                                {deletingId === template.id
                                                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                                                    : <Trash2 className="h-4 w-4" />
                                                                }
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Hapus Templat "{template.name}"?</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    Kalau templat ini sedang dipakai brand manapun, popup brand tersebut otomatis kembali ke teks default.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Batal</AlertDialogCancel>
                                                                <AlertDialogAction
                                                                    onClick={() => handleDelete(template.id)}
                                                                    className="bg-red-600 hover:bg-red-700"
                                                                >
                                                                    Hapus
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
