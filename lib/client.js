// Pemanggil API untuk halaman klien. Selalu mengembalikan { ok, status, ...data } dan tidak pernah melempar error.
export const post = async (url, body) => {
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
    const j = await r.json().catch(() => ({ error: `Server bermasalah (kode ${r.status})` }));
    return { ok: r.ok, status: r.status, ...j };
  } catch {
    return { ok: false, status: 0, error: 'Koneksi bermasalah. Periksa sinyal lalu coba lagi.' };
  }
};
// Untuk halaman admin: sesi habis langsung diarahkan ke login
export const adm = async (body) => {
  const r = await post('/api/admin', body);
  if (r.status === 401 && typeof location !== 'undefined') location.href = '/login';
  return r;
};
// Divisi dan cabang peserta dalam satu baris, dilewati jika kosong
export const unit = (o) => [o?.divisi, o?.cabang].filter(Boolean).join(' · ');
const TZ = 'Asia/Jakarta';
// tanggal dan jam (WIB) terpisah, dipakai di layar dan di file Excel
export const wib = (s) => {
  if (!s) return { tgl: '', jam: '' };
  const d = new Date(s);
  return {
    tgl: d.toLocaleDateString('id-ID', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric' }),
    jam: d.toLocaleTimeString('id-ID', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).replace(/\./g, ':'),
  };
};
export const fmtFull = (s) => { if (!s) return ''; const { tgl, jam } = wib(s); return `${tgl}, ${jam} WIB`; };
export const fmtTime = (s) => s ? wib(s).jam.slice(0, 5) : '';
export const fmtDateTime = (s) => s ? `${wib(s).tgl}, ${wib(s).jam.slice(0, 5)}` : '';

// Satu putaran animasi /loading.gif = 12 frame x 90 ms.
// Aturan jeda: minimal satu putaran penuh. Kalau proses sudah melewati satu putaran, animasi hanya
// dilanjutkan sampai akhir putaran bila sisanya pendek (<= snap ms); kalau tidak, langsung selesai.
// Jadi pengguna tidak pernah menunggu lebih lama dari yang perlu. Pengguna yang mematikan animasi di HP tidak diberi jeda.
export const LOOP_MS = 1080;
export const holdLoop = (t0, snap = 450) => {
  if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve();
  const el = Date.now() - t0;
  const rem = el < LOOP_MS ? LOOP_MS - el : LOOP_MS - (el % LOOP_MS);
  const wait = el < LOOP_MS || rem <= snap ? rem : 0;
  return new Promise((r) => setTimeout(r, wait));
};
