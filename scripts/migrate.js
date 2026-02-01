// scripts/migrate.js
import fs from 'fs';
import csv from 'csv-parser';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Setup environment
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// KONEKSI SUPABASE
// Pastikan .env kamu punya VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY (atau SERVICE_ROLE_KEY lebih baik jika ada RLS ketat)
const supabaseUrl = process.env.VITE_SUPABASE_URL;
// Gunakan Service Role Key jika ada, agar bisa bypass RLS
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Environment variables VITE_SUPABASE_URL / ANON_KEY tidak ditemukan.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// HELPER: Format Tanggal (8-Jan-2026 -> 2026-01-08)
const formatExpiryDate = (dateString) => {
  if (!dateString) return new Date().toISOString(); // Default hari ini kalo kosong
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return new Date().toISOString(); // Fallback
    return date.toISOString().split('T')[0]; // Ambil YYYY-MM-DD
  } catch (e) {
    return new Date().toISOString();
  }
};

// HELPER: Format Nomor HP (8123... -> 08123...)
const formatPhone = (phone) => {
  if (!phone) return '';
  let p = phone.toString().replace(/[^0-9]/g, ''); // Hapus karakter aneh
  if (p.startsWith('62')) p = '0' + p.substring(2);
  if (p.startsWith('8')) p = '0' + p;
  return p;
};

// HELPER: Cek Status Voucher
const isReady = (statusText) => {
  if (!statusText) return true; // Asumsi ready kalo kosong
  const lower = statusText.toLowerCase();
  return lower.includes('belum') || lower.includes('ready');
  // 'sudah kepake' akan return false
};

// FUNGSI UTAMA KOPKEN
const migrateKopken = () => {
  const results = [];
  console.log('🔄 Membaca data KopKen...');

  fs.createReadStream(path.resolve(__dirname, '../data_kopken.csv'))
    .pipe(csv())
    .on('data', (data) => {
      // Mapping kolom CSV ke Database
      // Sesuaikan nama key ('Nomor', 'PIN') dengan header CSV kamu persis
      if (data['Nomor']) {
        const phone = formatPhone(data['Nomor']);
        const nominReady = isReady(data['Tanpa minimal']);
        const min50Ready = isReady(data['Min 50.000']);
        
        // Tentukan status global
        let status = 'ready';
        if (!nominReady && !min50Ready) status = 'sold';

        results.push({
          phone_number: phone,
          password: data['PIN'] || '123456', // Default PIN kalo kosong
          brand: 'kopken',
          voucher_type: 'multi', // Label aja
          expiry_date: formatExpiryDate(data['Maksimal aktif']),
          is_nomin_ready: nominReady,
          is_min50k_ready: min50Ready,
          status: status,
          purchase_price: 0, // Default harga beli 0 dulu
          notes: 'Migrasi dari Excel'
        });
      }
    })
    .on('end', async () => {
      console.log(`📦 Siap mengupload ${results.length} akun KopKen...`);
      const { error } = await supabase.from('accounts').insert(results);
      
      if (error) console.error('❌ Gagal upload KopKen:', error);
      else console.log('✅ Sukses upload KopKen!');
      
      // Lanjut ke Fore setelah KopKen selesai
      migrateFore();
    });
};

// FUNGSI UTAMA FORE
const migrateFore = () => {
  const results = [];
  console.log('🔄 Membaca data Fore...');

  fs.createReadStream(path.resolve(__dirname, '../data_fore.csv'))
    .pipe(csv())
    .on('data', (data) => {
      if (data['Nomor']) {
        const phone = formatPhone(data['Nomor']);
        const nominReady = isReady(data['Tanpa minimal']);
        
        let status = nominReady ? 'ready' : 'sold';

        results.push({
          phone_number: phone,
          password: data['PIN'] || '123456',
          brand: 'fore',
          voucher_type: 'nomin',
          expiry_date: formatExpiryDate(data['Maksimal aktif']),
          is_nomin_ready: nominReady,
          is_min50k_ready: false, // Fore gapunya min50k
          status: status,
          purchase_price: 0,
          notes: 'Migrasi dari Excel'
        });
      }
    })
    .on('end', async () => {
      console.log(`📦 Siap mengupload ${results.length} akun Fore...`);
      const { error } = await supabase.from('accounts').insert(results);
      
      if (error) console.error('❌ Gagal upload Fore:', error);
      else console.log('✅ Sukses upload Fore! Migrasi Selesai.');
    });
};

// Jalankan
migrateKopken();