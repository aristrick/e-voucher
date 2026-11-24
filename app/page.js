'use client';
import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
const cached = () => { try { return JSON.parse(localStorage.getItem('tiket') || 'null'); } catch { return null; } };
export default function Home() {
  const [t, setT] = useState(null), [nik, setNik] = useState(''), [pin, setPin] = useState(''), [err, setErr] = useState('');
  const load = async (body) => {
    try {
      const r = await fetch('/api/ticket', { method: 'POST', body: JSON.stringify(body) });
      const d = await r.json().catch(() => null);
      if (!d) return setErr(`Server bermasalah (kode ${r.status}). Hubungi panitia.`);
      if (!r.ok) return setErr(d.error);
      setErr(''); setT(d); localStorage.setItem('tiket', JSON.stringify(d));
    } catch { setErr('Tidak ada sinyal. Tiket tersimpan tetap bisa dipakai.'); }
  };
  useEffect(() => {
    const q = new URLSearchParams(location.search).get('t');
    const c = cached();
    if (c && !q) setT(c);
    if (q || c) load({ token: q || c.token });
    const i = setInterval(() => { const k = q || cached()?.token; if (k) load({ token: k }); }, 5000);
    return () => clearInterval(i);
  }, []);
  if (!t) return (
    <div className="wrap"><div className="card">
      <h1>Tiket gathering</h1>
      <input placeholder="NIK" inputMode="numeric" value={nik} onChange={(e) => setNik(e.target.value)} />
      <input placeholder="4 digit terakhir no. HP" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value)} />
      {err && <p>{err}</p>}
      <button className="btn" onClick={() => load({ nik, pin })}>Lihat tiket</button>
    </div></div>
  );
  return (
    <div className="wrap">
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
      <button className="btn y" onClick={() => { localStorage.removeItem('tiket'); setT(null); }}>Ganti akun</button>
    </div>
  );
}