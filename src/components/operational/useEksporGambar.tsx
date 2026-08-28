// =============================================================================
// DiBeliin Admin - Ekspor node DOM jadi PNG
// =============================================================================
// Dipakai bersama oleh kartu struk/QR Fore dan layar pickup Kopken, supaya
// logika blob/clipboard/unduh cuma ada di satu tempat.

import { useState } from 'react';
import { toBlob } from 'html-to-image';
import { toast } from 'sonner';
import { Copy, Download } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function useEksporGambar(
    ref: React.RefObject<HTMLDivElement | null>,
    namaFile: string,
    label: string,
    /** Lebar (px) yang dipaksakan sesaat sebelum dipotret. Dipakai struk yang di
     *  layar dibiarkan lentur supaya muat di ponsel, tapi hasil PNG-nya harus
     *  selalu berukuran sama — persis trik kopsu (`style.width='400px'` sebelum
     *  snapdom, lalu dikembalikan). Tanpa ini, ekspor dari ponsel 360px
     *  menghasilkan gambar yang lebih sempit daripada ekspor dari desktop. */
    lebarEkspor?: number,
) {
    const [sibuk, setSibuk] = useState<'salin' | 'unduh' | null>(null);

    // pixelRatio 2 supaya teks tetap tajam saat dizoom / dikirim ke WA.
    //
    // cacheBust SENGAJA TIDAK dinyalakan. Opsi itu menempelkan query acak ke
    // tiap URL gambar, jadi setiap kali tombol ekspor dipencet semua foto
    // ditarik ulang dari jaringan — cache browser dilewati sepenuhnya. Diukur
    // di layar pickup Kopken: cacheBust:true = 2 permintaan ke proxy per
    // ekspor, cacheBust:false = 0, dengan PNG yang isinya sama persis dan
    // malah 300 ms lebih cepat. Foto Kopken juga tidak pernah basi karena
    // URL-nya memuat UUID — gambar berubah artinya URL-nya ikut berubah.
    const buatBlob = async () => {
        const el = ref.current!;
        const lebarAsal = el.style.width;
        if (lebarEkspor) {
            el.style.width = `${lebarEkspor}px`;
            // Beri satu frame supaya layout selesai sebelum node dipotret;
            // tanpa jeda ini html-to-image bisa membaca ukuran yang lama.
            await new Promise(requestAnimationFrame);
        }
        try {
            return await toBlob(el, { pixelRatio: 2, backgroundColor: '#ffffff' });
        } finally {
            el.style.width = lebarAsal;
        }
    };

    const unduh = async () => {
        setSibuk('unduh');
        try {
            const blob = await buatBlob();
            if (!blob) throw new Error('Gagal membuat gambar');
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = namaFile;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : `Gagal mengunduh ${label}`);
        } finally {
            setSibuk(null);
        }
    };

    const salin = async () => {
        setSibuk('salin');
        try {
            const blob = await buatBlob();
            if (!blob) throw new Error('Gagal membuat gambar');
            // Clipboard gambar butuh secure context (https / localhost) dan
            // dukungan ClipboardItem — Firefox lama tidak punya.
            if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
                throw new Error('Browser ini tidak mendukung salin gambar — pakai Download.');
            }
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            toast.success(`${label} disalin sebagai gambar.`);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : `Gagal menyalin ${label}`);
        } finally {
            setSibuk(null);
        }
    };

    return { sibuk, salin, unduh };
}

export function TombolEkspor({
    sibuk,
    salin,
    unduh,
    className,
}: {
    sibuk: 'salin' | 'unduh' | null;
    salin: () => void;
    unduh: () => void;
    className?: string;
}) {
    return (
        <div className={cn('mx-auto flex gap-2', className)}>
            <Button variant="outline" size="sm" className="flex-1" onClick={salin} disabled={!!sibuk}>
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                {sibuk === 'salin' ? 'Menyalin...' : 'Salin Gambar'}
            </Button>
            <Button variant="outline" size="sm" className="flex-1" onClick={unduh} disabled={!!sibuk}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                {sibuk === 'unduh' ? 'Mengunduh...' : 'Download PNG'}
            </Button>
        </div>
    );
}
