'use client';
import { useEffect, useRef, useState } from 'react';
export default function Staff() {
  const [mode, setMode] = useState('checkin'), [coupon, setCoupon] = useState(''), [coupons, setCoupons] = useState([]);
  const [res, setRes] = useState(null), [code, setCode] = useState(''), [on, setOn] = useState(false);
  const busy = useRef(false), ref = useRef({});
  ref.current = { mode, coupon };
  const call = (body) => fetch('/api/staff', { method: 'POST', body: JSON.stringify(body) });
  const act = async (c) => {
    if (busy.current || !c) return;
    busy.current = true;
    try {
      const r = await call({ action: ref.current.mode, code: c, coupon_id: Number(ref.current.coupon), booth: 'booth' });
      if (r.status === 401) { location.href = '/login'; return; }
      const d = await r.json().catch(() => ({ ok: false, msg: 'Server bermasalah (' + r.status + '), scan lagi' }));
      setRes(d); navigator.vibrate?.(d.ok ? 80 : [80, 60, 80]);
    } catch { setRes({ ok: false, msg: 'Koneksi bermasalah, scan lagi' }); }
    setTimeout(() => { busy.current = false; }, 2000);
  };
  useEffect(() => {
    let alive = true;
    (async () => {
      while (alive) {
        try {
          const r = await call({ action: 'coupons' });
          if (r.status === 401) { location.href = '/login'; return; }
          if (r.ok) { const d = await r.json(); setCoupons(d); setCoupon(d[0]?.id || ''); setOn(true); return; }
        } catch {}
        await new Promise((x) => setTimeout(x, 3000));
      }
    })();
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    if (!on) return;
    let s;
    (async () => {
      const { Html5Qrcode } = await import('html5-qrcode');
      s = new Html5Qrcode('cam');
      s.start({ facingMode: 'environment' }, { fps: 10, qrbox: 220 }, (t) => act(t)).catch(() => {});
    })();
    return () => { try { s?.isScanning && s.stop(); } catch {} };
  }, [on]);
  const out = async () => { await fetch('/api/auth', { method: 'POST', body: JSON.stringify({ action: 'logout' }) }); location.href = '/login'; };
  if (!on) return <div className="wrap">Memuat...</div>;
  return (
    <div className="wrap">
      <div className="row" style={{ marginBottom: 12 }}>
        <button className={'btn b' + (mode === 'checkin' ? ' sel' : '')} onClick={() => setMode('checkin')}>Check-in</button>
        <button className={'btn b' + (mode === 'redeem' ? ' sel' : '')} onClick={() => setMode('redeem')}>Redeem</button>
        <button className="btn y" onClick={out}>Keluar</button>
      </div>
      {mode === 'redeem' && <select value={coupon} onChange={(e) => setCoupon(e.target.value)}>{coupons.map((c) => <option key={c.id} value={c.id}>{c.nama}</option>)}</select>}
      <div id="cam" />
      {res && <div className={'card big ' + (res.ok ? 'ok' : 'bad')} style={{ marginTop: 16, fontSize: 28 }}>
        {res.nama && <div style={{ fontSize: 36 }}>{res.nama}</div>}{res.nik && <div>NIK {res.nik}</div>}<div>{res.msg}</div></div>}
      <div className="card" style={{ marginTop: 16 }}>
        <input placeholder="Kamera gagal? Ketik NIK atau kode tiket" value={code} onChange={(e) => setCode(e.target.value)} />
        <button className="btn y" onClick={() => { act(code); setCode(''); }}>Proses manual</button>
      </div>
    </div>
  );
}