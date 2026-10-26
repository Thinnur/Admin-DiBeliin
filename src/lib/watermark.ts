// Watermark foto testimoni. Semua diproses di browser (canvas): foto tidak pernah dikirim ke server.
// Dua lapis: pola tulisan miring samar di seluruh foto + logo DiBeliin semi-transparan di tengah.

export interface WatermarkOptions {
    text: string; // tulisan pola latar
    logoSize: number; // lebar logo, bagian dari sisi terpendek foto (0.1–0.8)
    logoOpacity: number; // 0–1
    patternOpacity: number; // 0–1
    maxWidth: number | null; // null = ukuran asli
}

export const DEFAULT_WATERMARK: WatermarkOptions = {
    text: 'DiBeliin',
    logoSize: 0.4,
    logoOpacity: 0.55,
    patternOpacity: 0.2,
    maxWidth: 1080, // foto testimoni tak perlu resolusi penuh
};

type Drawable = ImageBitmap | HTMLImageElement;

export function renderWatermark(photo: Drawable, logo: Drawable, opts: WatermarkOptions): HTMLCanvasElement {
    const scale = opts.maxWidth && photo.width > opts.maxWidth ? opts.maxWidth / photo.width : 1;
    const w = Math.round(photo.width * scale);
    const h = Math.round(photo.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Browser tidak mendukung canvas');

    ctx.fillStyle = '#fff'; // PNG transparan jadi putih di JPG, bukan hitam
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(photo, 0, 0, w, h);

    drawPattern(ctx, w, h, opts);

    const size = Math.min(w, h) * opts.logoSize;
    const logoH = size * (logo.height / logo.width);
    ctx.globalAlpha = opts.logoOpacity;
    ctx.drawImage(logo, (w - size) / 2, (h - logoH) / 2, size, logoH);
    ctx.globalAlpha = 1;

    return canvas;
}

// Tulisan putih bergaris tepi gelap supaya tetap terbaca di foto terang maupun gelap.
function drawPattern(ctx: CanvasRenderingContext2D, w: number, h: number, opts: WatermarkOptions) {
    const text = opts.text.trim();
    if (!text || opts.patternOpacity <= 0) return;

    const fontSize = Math.max(14, Math.round(Math.min(w, h) * 0.045));
    ctx.save();
    ctx.globalAlpha = opts.patternOpacity;
    ctx.font = `700 ${fontSize}px system-ui, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1, fontSize / 12);
    ctx.strokeStyle = '#000';
    ctx.fillStyle = '#fff';

    // Putar di titik tengah; grid dibuat seluas diagonal supaya sudut foto ikut tertutup.
    ctx.translate(w / 2, h / 2);
    ctx.rotate(-Math.PI / 6);
    const half = Math.hypot(w, h) / 2;
    const stepX = ctx.measureText(text).width + fontSize * 3;
    const stepY = fontSize * 4;
    for (let row = 0, y = -half; y <= half; row++, y += stepY) {
        const shift = row % 2 ? stepX / 2 : 0; // pola bata, bukan kolom lurus
        for (let x = -half - shift; x <= half; x += stepX) {
            ctx.strokeText(text, x, y);
            ctx.fillText(text, x, y);
        }
    }
    ctx.restore();
}

export function canvasToJpeg(canvas: HTMLCanvasElement, quality = 0.92): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Gagal membuat JPG'))), 'image/jpeg', quality);
    });
}

export function watermarkFileName(name: string): string {
    return `${name.replace(/\.[^.]+$/, '') || 'foto'}-wm.jpg`;
}
