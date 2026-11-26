'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { adm, holdLoop, post } from '@/lib/client';

// Muat data dari /api/admin. Kalau gagal sebelum ada data, otomatis coba lagi tiap 3 detik.
export function useLoad(body, every = 0) {
  const [data, setData] = useState(null), [err, setErr] = useState(''), [loading, setLoading] = useState(true);
  const ref = useRef(body); ref.current = body;
  const key = JSON.stringify(body);
  const reload = useCallback(async (silent) => {
    if (!silent) setLoading(true);
    const r = await adm(ref.current);
    if (r.ok) { setData(r); setErr(''); } else setErr(r.error || 'Gagal memuat data');
    setLoading(false);
  }, []);
  useEffect(() => { reload(); }, [key, reload]);
  useEffect(() => {
    if (!every) return;
    const i = setInterval(() => { if (!document.hidden) reload(true); }, every);
    return () => clearInterval(i);
  }, [every, reload]);
  useEffect(() => {
    if (!err || data) return;
    const t = setTimeout(() => reload(true), 3000);
    return () => clearTimeout(t);
  }, [err, data, reload]);
  return { data, err, loading, reload };
}

// ---------- notifikasi (toast) dan dialog konfirmasi/isian sesuai tema, pengganti popup bawaan browser ----------
const UICtx = createContext(null);
export const useUI = () => useContext(UICtx) || { toast: () => {}, ask: async () => true, askText: async () => null, begin: () => {}, end: () => {} };
let seq = 0;
export function UIProvider({ children }) {
  const [toasts, setToasts] = useState([]), [dlg, setDlg] = useState(null), [saving, setSaving] = useState(0);
  const begin = useCallback(() => setSaving((n) => n + 1), []), end = useCallback(() => setSaving((n) => Math.max(0, n - 1)), []);
  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback((type, text) => {
    const id = ++seq;
    setToasts((t) => [...t.slice(-3), { id, type, text }]);
    setTimeout(() => dismiss(id), type === 'err' ? 6500 : 3500);
  }, [dismiss]);
  const ask = useCallback((message, o = {}) => new Promise((res) => setDlg({ kind: 'confirm', message, ...o, res })), []);
  const askText = useCallback((message, o = {}) => new Promise((res) => setDlg({ kind: 'prompt', message, ...o, res })), []);
  const close = (v) => { dlg?.res(v); setDlg(null); };
  return (
    <UICtx.Provider value={{ toast, ask, askText, begin, end }}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={'toast-item ' + t.type} role={t.type === 'err' ? 'alert' : 'status'} onClick={() => dismiss(t.id)}>
            <span className="ti">{t.type === 'err' ? '✕' : '✓'}</span><span>{t.text}</span>
          </div>))}
      </div>
      {dlg && <Dialog d={dlg} close={close} />}
      {saving > 0 && <Saving />}
    </UICtx.Provider>
  );
}
// Animasi pixel untuk menyimpan perubahan dan membuka tiket. Muncul langsung, durasinya digenapkan ke satu putaran penuh (lihat holdLoop).
export function Splash({ text = 'Menyimpan perubahan' }) {
  return (
    <div className="pop saving" role="status" aria-live="polite" style={{ zIndex: 70 }}>
      <div className="pop-box splash-box">
        <img src="/loading.gif" width="104" height="110" alt="" />
        <div className="splash-t">{text}<span className="splash-dots" aria-hidden="true" /></div>
      </div>
    </div>
  );
}
const Saving = () => <Splash />;
function Dialog({ d, close }) {
  const [v, setV] = useState(d.value || ''), ok = useRef(null);
  const prompt = d.kind === 'prompt';
  const cancel = () => close(prompt ? null : false), yes = () => close(prompt ? v : true);
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') cancel(); };
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k);
  });
  useEffect(() => { if (!prompt) ok.current?.focus(); }, [prompt]);
  const danger = d.danger ?? /^Hapus/i.test(d.message);
  return (
    <div className="pop dlg" onMouseDown={(e) => e.target === e.currentTarget && cancel()}>
      <div className="pop-box modal" role="alertdialog" aria-modal="true" aria-label={d.title || 'Konfirmasi'} style={{ maxWidth: 440 }}>
        <div className="dlg-ic" data-danger={danger ? '1' : '0'}>{prompt ? '✎' : danger ? '!' : '?'}</div>
        <h2 style={{ marginBottom: 6 }}>{d.title || (prompt ? 'Isi data' : danger ? 'Hapus data?' : 'Konfirmasi')}</h2>
        <p style={{ margin: '0 0 14px' }}>{d.message}</p>
        {prompt && <input autoFocus value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && v.trim() && yes()} />}
        <div className="gap" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="btn w" onClick={cancel}>Batal</button>
          <button ref={ok} className={'btn ' + (danger ? 'r' : 'g')} disabled={prompt && !v.trim()} onClick={yes}>{d.okText || (prompt ? 'Simpan' : danger ? 'Ya, hapus' : 'Lanjutkan')}</button>
        </div>
      </div>
    </div>
  );
}

// Jalankan aksi admin: berhasil atau gagal ditampilkan sebagai notifikasi
const NoMsg = () => null;
export function useAct(after) {
  const { toast, begin, end } = useUI();
  const setMsg = (m) => { if (m) toast(m.ok ? 'ok' : 'err', m.t); };
  const run = async (body, okText) => {
    const t0 = Date.now(); begin();
    let r; try { r = await adm(body); await holdLoop(t0); } finally { end(); }
    if (r.ok) { if (okText) toast('ok', okText); await after?.(r); } else toast('err', r.error || 'Terjadi kesalahan');
    return r;
  };
  return { run, Msg: NoMsg, setMsg };
}

export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="pop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pop-box modal" role="dialog" aria-modal="true" aria-label={title} style={{ maxWidth: 640 }}>
        <div className="row"><h2 style={{ margin: 0 }}>{title}</h2><button className="btn sm w" onClick={onClose}>Tutup</button></div>
        {children}
      </div>
    </div>
  );
}

export function Pager({ page, size, total, onPage }) {
  const pages = Math.max(Math.ceil(total / size), 1);
  const from = total ? (page - 1) * size + 1 : 0, to = Math.min(page * size, total);
  return (
    <div className="pager">
      <span className="mute">{from}–{to} dari {total}</span>
      <span className="gap">
        <button className="btn sm w" disabled={page <= 1} onClick={() => onPage(page - 1)}>Sebelumnya</button>
        <span>{page} / {pages}</span>
        <button className="btn sm w" disabled={page >= pages} onClick={() => onPage(page + 1)}>Berikutnya</button>
      </span>
    </div>
  );
}

// ---------- skeleton loading ----------
const W = ['62%', '40%', '78%', '30%', '55%', '70%'];
const Bar = ({ w = '100%', h = 14, style }) => <span className="sk" style={{ width: w, height: h, ...style }} />;
function SkTable({ rows = 8, cols = 5 }) {
  return (
    <div className="tw" aria-hidden="true">
      <div className="sk-head">{Array.from({ length: cols }, (_, i) => <Bar key={i} w={['18%', '12%', '14%', '16%', '10%'][i % 5]} h={12} />)}</div>
      {Array.from({ length: rows }, (_, r) => (
        <div className="sk-row" key={r}>{Array.from({ length: cols }, (_, i) => <Bar key={i} w={W[(r + i) % W.length]} h={i === 0 ? 16 : 13} />)}</div>))}
    </div>
  );
}
function SkCards() {
  return (
    <div aria-hidden="true">
      <div className="stats">{[0, 1, 2, 3].map((i) => <div className="card" key={i}><Bar w="42%" h={38} /><Bar w="60%" h={14} /></div>)}</div>
      <div className="cols cols-3">{[0, 1, 2].map((i) => <div className="card" key={i}><Bar w="45%" h={20} />{[0, 1, 2, 3].map((j) => <div key={j} style={{ marginTop: 16 }}><Bar w={W[(i + j) % W.length]} h={13} /><Bar h={16} style={{ marginTop: 8 }} /></div>)}</div>)}</div>
    </div>
  );
}
function SkForm() {
  return (
    <div className="split" aria-hidden="true">
      <div className="card"><Bar w="30%" h={22} />{[0, 1, 2, 3].map((i) => <div key={i} style={{ marginTop: 18 }}><Bar w="22%" h={12} /><Bar h={44} style={{ marginTop: 8 }} /></div>)}</div>
      <div className="card"><Bar w="40%" h={22} /><Bar w="50%" h={12} style={{ marginTop: 18 }} /><Bar h={44} style={{ marginTop: 8 }} /><Bar h={40} w="50%" style={{ marginTop: 22 }} /></div>
    </div>
  );
}
export const Skeleton = ({ kind = 'table', rows, cols }) => kind === 'cards' ? <SkCards /> : kind === 'form' ? <SkForm /> : <SkTable rows={rows} cols={cols} />;
export const Loading = ({ err, kind = 'table', rows, cols }) => (
  <div role="status" aria-busy="true" aria-label="Memuat data">
    {err && <div className="err">{err.replace(/\.$/, '')}. Mencoba lagi...</div>}
    <Skeleton kind={kind} rows={rows} cols={cols} />
  </div>
);
// garis kemajuan tipis di atas halaman saat data dimuat ulang (filter, ganti halaman)
export const Busy = ({ on }) => (on ? <div className="topbar" aria-hidden="true" /> : null);
// Baris judul halaman admin. Kiri: judul. Kanan: tombol milik halaman (Segarkan, Tambah, dst.), garis pemisah, lalu menu cepat
// (Layar undian, Scan, Keluar akun). Menu cepat dulu ada di dasar sidebar dan sering terpotong di layar yang pendek.
export const Title = ({ children, right }) => {
  const { ask } = useUI();
  const out = async () => {
    const ok = await ask('Yakin ingin keluar dari akun ini?', { title: 'Keluar?', okText: 'Ya, keluar' });
    if (!ok) return;
    await post('/api/auth', { action: 'logout' }); location.href = '/login';
  };
  return (
    <div className="ptitle">
      <h1>{children}</h1>
      <div className="ptools">
        {right && <><div className="gap">{right}</div><span className="psep" aria-hidden="true" /></>}
        <div className="gap" role="group" aria-label="Menu cepat">
          <a className="btn sm p" href="/stage">Layar undian</a>
          <a className="btn sm g" href="/staff">Halaman scan</a>
          <button className="btn sm r" onClick={out}>Keluar akun</button>
        </div>
      </div>
    </div>
  );
};
