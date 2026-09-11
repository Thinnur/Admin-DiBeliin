import { Link } from 'react-router-dom';

// ponytail: <a> transparan menutupi satu baris tabel, supaya klik-kanan "buka di tab baru",
// ctrl+klik, dan klik tengah jalan seperti link biasa (onClick saja tidak punya href).
// Syarat pakai: <TableRow className="relative"> dan elemen interaktif lain di baris itu
// diberi "relative z-10" biar tidak ketutup overlay.
export default function RowLink({ to, label }: { to: string; label: string }) {
    return (
        <Link
            to={to}
            aria-label={label}
            className="absolute inset-0"
            onClick={(e) => e.stopPropagation()}
        />
    );
}
