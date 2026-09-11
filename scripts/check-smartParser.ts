// Cek cepat parser bulk akun: node scripts/check-smartParser.ts
// ponytail: satu file assert, bukan test framework -- yang penting gagal kalau parser rusak.
import assert from 'node:assert/strict';
import { parseBulkText } from '../src/lib/logic/smartParser.ts';

// Email polos + PIN global (Chatime)
const a = parseBulkText('akun :\nbudi01@gmail.com\nsiti02@gmail.com\n\nPin : 080808\nBerlaku sampai : 20 maret 2026');
assert.deepEqual(a.accounts, [
    { phone: 'budi01@gmail.com', password: '080808' },
    { phone: 'siti02@gmail.com', password: '080808' },
]);
assert.equal(a.globalExpiry, '2026-03-20');

// Email + PIN per akun
const b = parseBulkText('budi01@gmail.com|227224\nsiti02@gmail.com|662387');
assert.deepEqual(b.accounts, [
    { phone: 'budi01@gmail.com', password: '227224' },
    { phone: 'siti02@gmail.com', password: '662387' },
]);

// Email yang bagian lokalnya berupa nomor HP tetap dibaca sebagai email, bukan nomor
const c = parseBulkText('08123456789@gmail.com');
assert.deepEqual(c.accounts, [{ phone: '08123456789@gmail.com', password: '' }]);

// Regresi: nomor HP tetap ternormalisasi seperti sebelumnya
const d = parseBulkText('+6285607637577\n085839073898\n85600756930|227224\nPin : 080808');
assert.deepEqual(d.accounts, [
    { phone: '85607637577', password: '080808' },
    { phone: '85839073898', password: '080808' },
    { phone: '85600756930', password: '227224' },
]);

// Baris non-akun tidak ikut kehitung
assert.equal(parseBulkText('Berlaku sampai : 20 maret 2026\nPin : 1234').detectedCount, 0);

console.log('smartParser OK');
