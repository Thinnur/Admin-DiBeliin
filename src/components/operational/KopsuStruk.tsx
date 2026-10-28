// =============================================================================
// DiBeliin Admin - Struk Tomoro & Janji Jiwa
// =============================================================================
// Replika halaman struk kopsu.app (/tomoro/receipt/<kode> dan /janjiw/receipt/<id>), yang meniru layar
// detail pesanan aplikasi aslinya — pola yang sama dengan KopkenPickupScreen. Markup & CSS disalin dari
// bundel SvelteKit kopsu (nodes/53 Tomoro, nodes/39 JJ, 2026-10-28) ke kopsu-struk.css; ikon & font di
// public/tomoro-assets dan public/janjiw-assets. Data: `result.struk` dari kopsu_status_worker.js, yaitu
// objek `order` panel apa adanya, ditambah foto dari menu_items (gambar panel tak bisa dipakai di sini).
// Tombol (Kembali, Salin, Lihat Kode QR) sengaja <div>: hanya untuk ikut tergambar di PNG.
// Bedanya dengan kopsu: semua item ditampilkan (kopsu Tomoro melipat jadi 2 + "Show All") dan tanpa
// hitung mundur bayar.

import { useRef } from 'react';

import { useEksporGambar, TombolEkspor } from './useEksporGambar';
import { proxyGambar } from './KopkenPickupScreen';
import './kopsu-struk.css';

export interface TomoroStrukData {
    v?: number;
    code: string;
    /** 1 Waiting for Payment, 2 Ordered, 3 In Progress, 4 Pickup, 5 Completed, 6 Canceled, 8 Arrived (kode panel). */
    status: number;
    takeFoodNo?: string | null;
    statusRateCard?: string | null;
    cancelReasonMsg?: string | null;
    pointNum?: number | null;
    storeName?: string | null;
    storeAddress?: string | null;
    paymentMoney: number;
    currencyUnit?: string | null;
    /** Epoch milidetik. */
    createTime?: number | null;
    bizChannel?: string | null;
    payChannelName?: string | null;
    note?: string | null;
    items?: { name: string; desc?: string | null; amount: number; price: number; linePrice: number; image?: string | null }[];
    summary?: { name: string; money: number; discount: boolean }[];
}

export interface JiwaStrukData {
    v?: number;
    status: string;
    title?: string | null;
    subtitle?: string | null;
    receipt?: string | null;
    datetime?: string | null;
    pickupCode?: string | null;
    pickupTime?: string | null;
    /** QR ambil persis seperti panel: path SVG. */
    qr?: { size: number; d: string } | null;
    outletName?: string | null;
    outletAddress?: string | null;
    items?: { qty: number; name: string; info?: string | null; notes?: string | null; image?: string | null }[];
}

const LEBAR_EKSPOR = 400; // kopsu memotret struk Tomoro selebar 400px (.tr.cap), skala 2

/** Storage kita lewat proxyGambar (?cors=1); host lain (static.tomoro-coffee.id) sudah mengirim ACAO *. */
function gambar(url?: string | null) {
    if (!url) return null;
    return url.startsWith(import.meta.env.VITE_SUPABASE_URL ?? '\0') ? proxyGambar(url) : url;
}

function Foto({ url }: { url?: string | null }) {
    const src = gambar(url);
    return src ? <img src={src} alt="" crossOrigin="anonymous" /> : <span className="noimg" />;
}

// ── Tomoro ───────────────────────────────────────────────────────────────────

const rupiahTomoro = (d: TomoroStrukData, n: number) =>
    `${d.currencyUnit ?? 'Rp'} ${n.toLocaleString('en-US', { maximumFractionDigits: 2 }).replaceAll(',', '.')}`;

/** "26/10/2026 23:36:47" WIB, sama dengan panel. */
function waktuTomoro(ms: number) {
    const p = Object.fromEntries(
        new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Jakarta', day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
        }).formatToParts(ms).map((x) => [x.type, x.value]),
    );
    return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}:${p.second}`;
}

function StatusTomoro({ d }: { d: TomoroStrukData }) {
    const s = d.status;
    if (s >= 2 && s <= 4) {
        return (
            <section className="card wf">
                <p className="no">{d.takeFoodNo ?? ''}</p>
                <div className="steps">
                    <img alt="" className={`ic s0${s === 2 ? ' big' : ''}`} src={`/tomoro-assets/ordered-${s === 2 ? 2 : 1}.webp`} />
                    <img alt="" className={`ic s1${s === 3 || s === 4 ? ' big' : ''}`} src={`/tomoro-assets/progress-${s === 3 ? 2 : 1}.webp`} />
                    <img alt="" className={`ic s2${s === 4 ? ' big' : ''}`} src={`/tomoro-assets/pickup-${s === 4 ? 2 : 1}.webp`} />
                    <span className="dl l1">- - - - - - - - - - -</span>
                    <span className="dl l2">- - - - - - - - - - -</span>
                    {s === 2 && <i className="dot d1" />}
                    {s === 3 && <i className="dot d2" />}
                    {s === 4 && <i className="dot d3" />}
                    <span className={`lb s0${s === 2 ? ' on' : ''}`}>Ordered</span>
                    <span className={`lb s1${s === 3 ? ' on' : ''}`}>In Progress</span>
                    <span className={`lb s2${s === 4 ? ' on' : ''}`}>Pickup</span>
                </div>
                <div
                    className="arw"
                    style={{ backgroundImage: `url(/tomoro-assets/arrow-${s === 2 ? 'left' : s === 3 ? 'center' : 'right'}.webp)` }}
                />
                <p className="tip">{d.statusRateCard ?? ''}</p>
            </section>
        );
    }
    if (s === 5 || s === 8) {
        return (
            <section className="st">
                <p className="big-no">{d.takeFoodNo ?? ''}</p>
                <p className="done">
                    <img src="/tomoro-assets/complete.webp" alt="" />
                    {s === 5 ? 'Order Completed' : 'Order Arrived'}
                </p>
            </section>
        );
    }
    return (
        <section className="st">
            <p className="ttl">
                <img alt="" src={`/tomoro-assets/${s === 1 ? 'wait' : 'complete'}.webp`} />
                {s === 1 ? 'Waiting for Payment' : 'Order Canceled'}
            </p>
            <p className="desc">{s === 1 ? '' : `Cancel Reason: ${d.cancelReasonMsg ?? ''}`}</p>
        </section>
    );
}

export function TomoroStruk({ data: d }: { data: TomoroStrukData }) {
    return (
        <div className="tr">
            <header className="hd">
                <div className="back"><img src="/tomoro-assets/back.webp" alt="" /></div>
            </header>
            <div className="mn">
                <StatusTomoro d={d} />
                {d.status !== 6 && (
                    <section className="card pt">
                        <b>TOMORO Points</b>
                        <span><img src="/tomoro-assets/point.webp" alt="" />{`+ ${d.pointNum ?? ''} pts`}</span>
                    </section>
                )}
                <section className="card ol">
                    <i className="cut" />
                    <div className="sh">
                        <p className="nm">{d.storeName}</p>
                        <p className="ad">{d.storeAddress}</p>
                        <i className="info" />
                    </div>
                    {(d.items ?? []).map((it, i) => (
                        <div className="it" key={i}>
                            <Foto url={it.image} />
                            <div className="tx">
                                <p className="n">{it.name}</p>
                                <p className="d">{it.desc}</p>
                                <p className="p">
                                    {rupiahTomoro(d, it.price)}
                                    {it.linePrice > it.price && <s>{rupiahTomoro(d, it.linePrice)}</s>}
                                    <span className="ct">x{it.amount}</span>
                                </p>
                            </div>
                        </div>
                    ))}
                    <div className="sm">
                        {(d.summary ?? []).map((r, i) => (
                            <p className="r" key={i}>
                                <span>{r.name}</span>
                                <b className={r.discount ? 'red' : undefined}>{`${r.discount ? '- ' : ''}${rupiahTomoro(d, r.money)}`}</b>
                            </p>
                        ))}
                    </div>
                    <i className="dash" />
                    <p className="tt"><b>Total</b><b>{rupiahTomoro(d, d.paymentMoney)}</b></p>
                </section>
                <section className="card in">
                    {d.note && <p className="r"><span>Additional Notes</span><span className="v">{d.note}</span></p>}
                    <p className="r"><span>Order Number</span><span className="v">{d.code}</span><i className="cp" /></p>
                    <p className="r"><span>Order Time</span><span className="v">{d.createTime ? waktuTomoro(d.createTime) : ''}</span></p>
                    <p className="r"><span>Order Channel</span><span className="v">{d.bizChannel}</span></p>
                    {d.payChannelName && <p className="r"><span>Payment Method</span><span className="v">{d.payChannelName}</span></p>}
                </section>
            </div>
        </div>
    );
}

// ── Janji Jiwa ───────────────────────────────────────────────────────────────

const IKON_JIWA: Record<string, string> = {
    ORDER_READY: 'check', ORDER_COMPLETED: 'check',
    ORDER_CANCELLED: 'sad', CANCELLED: 'sad', FAILED: 'sad', EXPIRED: 'sad',
};

export function JiwaStruk({ data: d }: { data: JiwaStrukData }) {
    return (
        <div className="jr">
            <header className="hd">
                <div className="back">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#15181b" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" /></svg>
                </div>
                <h1>Detail Status Pesanan</h1>
            </header>
            <div>
                <section className="card st">
                    <div className="row">
                        <div className="txt">
                            <h2>{d.title || '-'}</h2>
                            {d.subtitle && <p className="sub">{d.subtitle}</p>}
                        </div>
                        <img className="icon" alt="" src={`/janjiw-assets/status-${IKON_JIWA[d.status] ?? 'clock'}.svg`} />
                    </div>
                    <p className="oid">
                        {`ORDER ID: ${d.receipt ?? ''}`}
                        <span className="copy">
                            <svg viewBox="219 -741 586 586" aria-hidden="true"><path fill="#15181b" d="M284-422L284-656Q284-664 290-670Q296-676 304-676L538-676Q546-676 552-670Q558-664 558-656L558-630Q558-617 568-608Q577-598 590-598Q603-598 613-608Q623-617 623-630L623-656Q623-691 598-716Q573-741 538-741L304-741Q269-741 244-716Q219-691 219-656L219-422Q219-387 244-362Q269-337 304-337L330-337Q343-337 353-347Q362-357 362-370Q362-383 353-393Q343-402 330-402L304-402Q296-402 290-408Q284-414 284-422ZM499-559Q459-559 430-530Q401-501 401-461L401-253Q401-213 430-184Q459-155 499-155L707-155Q747-155 776-184Q805-213 805-253L805-461Q805-501 776-530Q747-559 707-559L499-559ZM466-253L466-461Q466-474 476-484Q486-494 499-494L707-494Q721-494 731-484Q740-474 740-461L740-253Q740-239 731-230Q721-220 707-220L499-220Q486-220 476-230Q466-239 466-253Z" /></svg>
                        </span>
                    </p>
                    <div className="meta">
                        <span>{`Tanggal: ${d.datetime || '-'}`}</span>
                        <span className="tnc">Syarat Dan Ketentuan</span>
                    </div>
                </section>
                {d.pickupCode && (
                    <section className="card pk">
                        <div className="left">
                            <p className="lbl">Kode Pick Up Kamu</p>
                            <p className="code">{d.pickupCode}</p>
                            <div className="qrbtn">
                                Lihat Kode QR
                                <svg viewBox="0 -960 1024 1024" aria-hidden="true"><path fill="#fff" d="M256-409L475-409L475-176L256-176L256-409ZM329-254L402-254L402-331L329-331L329-254ZM768-176L549-176L549-409L768-409L768-176ZM695-331L622-331L622-254L695-254L695-331ZM256-720L475-720L475-487L256-487L256-720ZM329-565L402-565L402-642L329-642L329-565ZM731-487L768-487L768-642L658-642L658-603L622-603L622-720L549-720L549-487L658-487L658-526L731-526L731-487ZM731-720L731-681L768-681L768-720L731-720ZM658-720L658-681L695-681L695-720L658-720Z" /></svg>
                            </div>
                        </div>
                        {d.qr && (
                            <svg className="qr" shapeRendering="crispEdges" role="img" aria-label="QR kode pick up" viewBox={`0 0 ${d.qr.size} ${d.qr.size}`}>
                                <path fill="#000" d={d.qr.d} />
                            </svg>
                        )}
                    </section>
                )}
                <section className="card ta">
                    <h2>Detail Take Away</h2>
                    <div className="tl">
                        <div className="rail">
                            <span className="dot"><img src="/janjiw-assets/store.svg" alt="" className="store" /></span>
                            <span className="dash" />
                        </div>
                        <div className="txt first">
                            <p className="lbl">Lokasi Outlet</p>
                            <p className="name">{d.outletName || '-'}</p>
                            {d.outletAddress && <p className="addr">{d.outletAddress}</p>}
                        </div>
                    </div>
                    <div className="tl">
                        <div className="rail">
                            <span className="dot"><img src="/janjiw-assets/clock.svg" alt="" className="clock" /></span>
                        </div>
                        <div className="txt">
                            <p className="lbl">Waktu Pick Up</p>
                            <p className="time">{d.pickupTime || '-'}</p>
                        </div>
                    </div>
                </section>
                <section className="card ls">
                    <h2>Daftar Pesanan</h2>
                    {(d.items ?? []).map((it, i) => (
                        <div className="it" key={i}>
                            <Foto url={it.image} />
                            <div className="txt">
                                <p className="nm">{`${it.qty}x ${it.name}`}</p>
                                {it.info && <p className="inf">{it.info}</p>}
                                {it.notes && <p className="inf">{it.notes}</p>}
                            </div>
                        </div>
                    ))}
                </section>
            </div>
        </div>
    );
}

// ── Kartu + ekspor ───────────────────────────────────────────────────────────

export function KopsuStrukCard({
    data,
    brand,
    fileName,
}: {
    data: TomoroStrukData | JiwaStrukData;
    brand: 'tomoro' | 'janjijiwa';
    fileName?: string;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const eksport = useEksporGambar(
        ref,
        `Struk_${brand === 'tomoro' ? 'Tomoro' : 'JanjiJiwa'}_${fileName ?? 'pesanan'}.png`,
        'Struk',
        LEBAR_EKSPOR,
    );

    return (
        <div className="space-y-2">
            {/* container-type: satuan --u struk JJ dihitung dari lebar kartu ini, bukan lebar layar. */}
            <div ref={ref} className="mx-auto w-full max-w-[400px]" style={{ containerType: 'inline-size' }}>
                {brand === 'tomoro'
                    ? <TomoroStruk data={data as TomoroStrukData} />
                    : <JiwaStruk data={data as JiwaStrukData} />}
            </div>
            <TombolEkspor {...eksport} className="max-w-[400px]" />
        </div>
    );
}
