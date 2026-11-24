'use client';
import { useEffect, useRef, useState } from 'react';

export default function Staff() {
  const [mode, setMode] = useState('checkin'), [coupon, setCoupon] = useState(''), [coupons, setCoupons] = useState([]);
  const [res, setRes] = useState(null), [code, setCode] = useState(''), [on, setOn] = useState(false);
  const [loadErr, setLoadErr] = useState(''), [camErr, setCamErr] = useState('');
  const busy = useRef(false), ref = useRef({}), timer = useRef(null);
  ref.current = { mode, coupon };

  const call = (body) => fetch('/api/staff', { method: 'POST', body: JSON.stringify(body) });

  // tutup popup, lalu izinkan scan berikutnya (jeda singkat agar QR yang sama tidak terbaca ulang)
  const release = () => {
    clearTimeout(timer.current);
    setRes(null);
    setTimeout(() => { busy.current = false; }, 800);
  };
  const show = (d) => {
    setRes(d);
    navigator.vibrate?.(d.ok ? 80 : [80, 60, 80]);
    clearTimeout(timer.current);
    timer.current = setTimeout(release, 3000);
  };

  const act = async (c) => {
    if (busy.current || !c) return;
    busy.current = true;
    try {
      const r = await call({ action: ref.current.mode, code: c, coupon_id: Number(ref.current.coupon) });
      if (r.status === 401) { location.href = '/login'; return; }
      const d = await r.json().catch(() => ({ ok: false, msg: 'Server bermasalah (' + r.status + '), scan lagi' }));
      show(d);
    } catch {
      show({ ok: false, msg: 'Koneksi bermasalah, scan lagi' });
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      while (alive) {
        try {
          const r = await call({ action: 'coupons' });
          if (r.status === 401) { location.href = '/login'; return; }
          const d = await r.json().catch(() => null);
          if (r.ok && Array.isArray(d)) { setCoupons(d); setCoupon(d[0]?.id || ''); setOn(true); return; }
          setLoadErr((d && d.error) || 'Server error ' + r.status);
        } catch { setLoadErr('Koneksi bermasalah, mencoba lagi...'); }
        await new Promise((x) => setTimeout(x, 3000));
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!on) return;
    let s, dead = false;
    (async () => {
      const { Html5Qrcode } = await import('html5-qrcode');
      if (dead) return;
      s = new Html5Qrcode('cam');
      try { await s.start({ facingMode: 'environment' }, { fps: 10, qrbox: 220 }, (t) => act(t)); }
      catch { setCamErr('Kamera tidak bisa dibuka. Pakai input manual di bawah.'); }
      if (dead) { try { if (s.isScanning) await s.stop(); } catch {} }
    })();
    return () => { dead = true; try { if (s && s.isScanning) s.stop().catch(() => {}); } catch {} };
  }, [on]);

  const out = async () => { await fetch('/api/auth', { method: 'POST', body: JSON.stringify({ action: 'logout' }) }); location.href = '/login'; };

  if (!on) return <div className="wrap">Memuat...{loadErr && <p>{loadErr}</p>}</div>;
  return (
    <div className="wrap">
      <div className="row" style={{ marginBottom: 12 }}>
        <button className={'btn b' + (mode === 'checkin' ? ' sel' : '')} onClick={() => setMode('checkin')}>Check-in</button>
        <button className={'btn b' + (mode === 'redeem' ? ' sel' : '')} onClick={() => setMode('redeem')}>Redeem</button>
        <button className="btn y" onClick={out}>Keluar</button>
      </div>
      {mode === 'redeem' && (coupons.length
        ? <select value={coupon} onChange={(e) => setCoupon(e.target.value)}>{coupons.map((c) => <option key={c.id} value={c.id}>{c.nama}</option>)}</select>
        : <div className="card yellow">Belum ada kupon. Admin perlu menambah kupon dulu.</div>)}
      <div id="cam" />
      {camErr && <p>{camErr}</p>}
      <div className="card" style={{ marginTop: 16 }}>
        <input placeholder="Kamera gagal? Ketik NIK atau kode tiket" value={code} onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { act(code); setCode(''); } }} />
        <button className="btn y" onClick={() => { act(code); setCode(''); }}>Proses manual</button>
      </div>

      {res && (
        <div className="pop" onClick={release}>
          <div className={'pop-box ' + (res.ok ? 'ok' : 'bad')}>
            <div className="pop-icon">{res.ok ? '✓' : '✕'}</div>
            <div className="pop-title">{res.ok ? 'Berhasil' : 'Gagal'}</div>
            {res.nama && <div className="pop-name">{res.nama}</div>}
            {res.nik && <div>NIK {res.nik}{res.cabang ? ' · ' + res.cabang : ''}</div>}
            {res.kupon && <div className="pop-item">{res.kupon}</div>}
            <div className="pop-msg">{res.msg}</div>
            <div className="pop-hint">Ketuk untuk menutup</div>
          </div>
        </div>
      )}
    </div>
  );
}
