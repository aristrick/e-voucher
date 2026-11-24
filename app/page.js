'use client';
import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
const cached = () => { try { return JSON.parse(localStorage.getItem('tiket') || 'null'); } catch { return null; } };
export default function Home() {
  const [t, setT] = useState(null), [mode, setMode] = useState('login'), [f, setF] = useState({ nik: '', hp: '', pw: '' }), [err, setErr] = useState(''), [ready, setReady] = useState(false), [toast, setToast] = useState('');
  const last = useRef(null), tt = useRef(null);
  const say = (m) => { setToast(m); clearTimeout(tt.current); tt.current = setTimeout(() => setToast(''), 5000); };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const load = async () => {
    try {
      const r = await fetch('/api/ticket', { method: 'POST' });
      if (r.status === 401) { setT(null); localStorage.removeItem('tiket'); return; }
      const d = await r.json().catch(() => null);
      if (!d) return setErr(`Server bermasalah (kode ${r.status}). Hubungi panitia.`);
      const prev = last.current;
      if (prev) {
        const baru = d.coupons.filter((c) => c.redeemed_at && !(prev.coupons || []).find((x) => x.id === c.id)?.redeemed_at);
        if (baru.length) say('Kupon ' + baru.map((c) => c.nama).join(', ') + ' berhasil ditukar');
        else if (d.hadir && !prev.hadir) say('Check-in berhasil. Selamat datang!');
      }
      last.current = d;
      setErr(''); setT(d); localStorage.setItem('tiket', JSON.stringify(d));
    } catch { setErr('Tidak ada sinyal. Tiket tersimpan tetap bisa dipakai.'); }
  };
  useEffect(() => {
    const c = cached(); if (c) { setT(c); last.current = c; }
    load().finally(() => setReady(true));
    const i = setInterval(() => { if (!document.hidden) load(); }, 10000);
    const vis = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(i); document.removeEventListener('visibilitychange', vis); };
  }, []);
  const submit = async () => {
    const body = mode === 'login' ? { action: 'login', nik: f.nik, password: f.pw } : { action: 'activate', nik: f.nik, hp4: f.hp, password: f.pw };
    const r = await fetch('/api/auth', { method: 'POST', body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return setErr(d.error || 'Gagal masuk');
    setErr(''); load();
  };
  const out = async () => { await fetch('/api/auth', { method: 'POST', body: JSON.stringify({ action: 'logout' }) }); localStorage.removeItem('tiket'); last.current = null; setT(null); };
  if (!t && !ready) return <div className="wrap">Memuat...</div>;
  if (!t) return (
    <div className="wrap"><div className="card">
      <h1>Tiket gathering</h1>
      <div className="row" style={{ marginBottom: 8 }}>
        <button className={'btn b' + (mode === 'login' ? ' sel' : '')} onClick={() => { setMode('login'); setErr(''); }}>Masuk</button>
        <button className={'btn b' + (mode === 'activate' ? ' sel' : '')} onClick={() => { setMode('activate'); setErr(''); }}>Aktivasi akun</button>
      </div>
      <input placeholder="NIK" inputMode="numeric" value={f.nik} onChange={set('nik')} />
      {mode === 'activate' && <input placeholder="4 digit terakhir no. HP" inputMode="numeric" maxLength={4} value={f.hp} onChange={set('hp')} />}
      <input type="password" placeholder={mode === 'login' ? 'Password' : 'Buat password (min. 6 karakter)'} value={f.pw} onChange={set('pw')} onKeyDown={(e) => e.key === 'Enter' && submit()} />
      {err && <p>{err}</p>}
      <button className="btn" onClick={submit}>{mode === 'login' ? 'Masuk' : 'Aktifkan dan masuk'}</button>
    </div><a href="/login">Login panitia</a></div>
  );
  return (
    <div className="wrap">
      {toast && <div className="toast" onClick={() => setToast('')}>{toast}</div>}
      <h2>Halo, {t.nama.split(' ')[0]}</h2>
      <div className="card purple">
        <div className="row"><span>Tiket gathering</span><span className={'chip' + (t.hadir ? '' : ' no')}>{t.hadir ? 'HADIR' : 'BELUM CHECK-IN'}</span></div>
        <h1>{t.nama}</h1><div>NIK {t.nik} · {t.cabang}</div>
        <div className="cut" />
        <div style={{ background: '#fff', border: '3px solid #000', borderRadius: 12, padding: 12, width: 'fit-content', margin: '0 auto' }}>
          <QRCodeSVG value={t.token} size={180} />
        </div>
      </div>
      {t.win && <div className="card yellow"><h2>Selamat, kamu menang!</h2>Hadiah: {t.win}. Temui panitia untuk mengambil.</div>}
      <div className="card"><h2>Kupon</h2>
        {t.coupons.map((c) => (
          <div className="row" key={c.id} style={{ margin: '8px 0' }}><span>{c.nama}</span>
            <span className={'chip' + (c.redeemed_at ? ' no' : '')}>{c.redeemed_at ? 'SUDAH DITUKAR' : 'TERSEDIA'}</span></div>
        ))}
      </div>
      {err && <p>{err}</p>}
      <button className="btn y" onClick={out}>Keluar</button>
    </div>
  );
}
