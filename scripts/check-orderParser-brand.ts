// Cek cepat deteksi brand teks pesanan: node scripts/check-orderParser-brand.ts
// ponytail: satu file assert, bukan test framework (pola check-smartParser.ts).
import assert from 'node:assert/strict';
import { detectBrand, parseWhatsAppOrder } from '../src/lib/logic/orderParser.ts';

// Teks persis dari web (UniversalCart.buildOrderMessage) per brand.
const pesan = (brand: string, item: string) => `Halo, saya ingin order *${brand}*:\n\n*Nama:* Rina\n*Outlet:* Sabang\n\n*Pesanan:*\n1. ${item} x1\n   Temperature: Iced\n   Rp 30.000\n\n*TOTAL: Rp 30.000*`;
assert.equal(detectBrand(pesan('Tomoro Coffee', 'Breve Latte - Small')), 'tomoro');
assert.equal(detectBrand(pesan('Kopi Janji Jiwa', 'Signature Kopi Susu - Regular')), 'janjijiwa');
assert.equal(detectBrand(pesan('Kopi Kenangan', 'Kopi Kenangan Mantan - Regular')), 'kopken');
assert.equal(detectBrand(pesan('Fore Coffee', 'Butterscotch Sea Salt Latte - Regular')), 'fore');
assert.equal(detectBrand(pesan('Chatime', 'Brown Sugar Pearl Milk Tea - Regular')), 'chatime');
// Baris pembuka menang atas nama item yang kebetulan memuat brand lain.
assert.equal(detectBrand(pesan('Fore Coffee', 'Kenangan Latte - Regular')), 'fore');
// Tanpa baris pembuka: kata kunci di baris lain (mis. label diskon Tomoro).
assert.equal(detectBrand('Nama: Budi\n1. Caffe Latte - Small x1\nDiskon Voucher Tomoro (B1G1 / 50%): -Rp 12.000'), 'tomoro');
assert.equal(detectBrand('1. Aren Latte x2\nTotal: Rp 40.000'), undefined);
assert.equal(detectBrand('saya mau order sebelum jam 5 ya'), undefined); // "before"/"sebelum" bukan Fore
assert.equal(parseWhatsAppOrder(pesan('Tomoro Coffee', 'Breve Latte - Small')).brand, 'tomoro');
console.log('check-orderParser-brand: semua lolos');
