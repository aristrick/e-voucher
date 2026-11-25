'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { adm } from '@/lib/client';

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

// Jalankan aksi admin dan tampilkan hasilnya sebagai pesan
export function useAct(after) {
  const [msg, setMsg] = useState(null);
  const run = async (body, okText) => {
    const r = await adm(body);
    if (r.ok) { setMsg(okText ? { ok: true, t: okText } : null); await after?.(r); } else setMsg({ ok: false, t: r.error });
    return r;
  };
  const Msg = () => msg ? <div className={msg.ok ? 'good' : 'err'} onClick={() => setMsg(null)}>{msg.t}</div> : null;
  return { run, Msg, setMsg };
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

export const Loading = ({ err }) => <div className="card">{err ? <div className="err">{err.replace(/\.$/, '')}. Mencoba lagi...</div> : 'Memuat...'}</div>;
export const Title = ({ children, right }) => <div className="ptitle"><h1>{children}</h1><div className="gap">{right}</div></div>;
