import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Download file cross-origin (mis. Supabase Storage) sebagai file lokal, bukan cuma buka tab baru. */
export async function downloadFile(url: string, filename: string) {
  const res = await fetch(url);
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(blobUrl);
}

/** Apakah paymentStatus checkout_jobs sudah final (gak perlu polling ulang). */
export function isPaymentStatusFinal(paymentStatus?: string | null): boolean {
  return !!paymentStatus && paymentStatus !== 'PAYMENT_PENDING';
}
