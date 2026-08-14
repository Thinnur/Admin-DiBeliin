-- Menambahkan toggle "berlaku kelipatan" pada voucher diskon admin.
-- Saat true, potongan voucher dikali jumlah unit biaya admin (mis. potongan 1rb x 2 biaya admin = 2rb).
alter table public.vouchers
    add column if not exists applies_multiplier boolean not null default false;
