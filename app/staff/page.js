'use client';
import { useEffect, useRef, useState } from 'react';
export default function Staff() {
  const [pin, setPin] = useState(''), [mode, setMode] = useState('checkin'), [coupon, setCoupon] = useState(''), [coupons, setCoupons] = useState([]);
  const [res, setRes] = useState(null), [code, setCode] = useState(''), [on, setOn] = useState(false);
  const busy = useRef(false), ref = useRef({});
  ref.current = { pin, mode, coupon };
  useEffect(() => { setPin(localStorage.getItem('pin') || ''); }, []);
  const call = (body) => fetch('/api/staff', { method: 'POST', headers: { 'x-pin': ref.current.pin }, body: JSON.stringify(body) });
  const act = async (c) => {
    if (busy.current || !c) return;
    busy.current = true;
    const r = await call({ action: ref.current.mode, code: c, coupon_id: Number(ref.current.coupon), booth: 'booth' });
    const d = r.status === 401 ? { ok: false, msg: 'PIN salah' } : await r.json();
    setRes(d); navigator.vibrate?.(d.ok ? 80 : [80, 60, 80]);
    setTimeout(() => { busy.current = false; }, 2000);
  };
  const login = async () => {
    localStorage.setItem('pin', pin);
    const r = await call({ action: 'coupons' });
    if (!r.ok) return setRes({ ok: false, msg: 'PIN salah' });
    const d = await r.json(); setCoupons(d); setCoupon(d[0]?.id || ''); setRes(null); setOn(true);
  };
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
  if (!on) return (
    <div className="wrap"><div className="card"><h1>Panitia</h1>
      <input type="password" placeholder="PIN panitia" value={pin} onChange={(e) => setPin(e.target.value)} />
      {res && <p>{res.msg}</p>}<button className="btn" onClick={login}>Masuk</button></div></div>
  );
  return (
    <div className="wrap">
      <div className="row" style={{ marginBottom: 12 }}>
        <button className={'btn b' + (mode === 'checkin' ? ' sel' : '')} onClick={() => setMode('checkin')}>Check-in</button>
        <button className={'btn b' + (mode === 'redeem' ? ' sel' : '')} onClick={() => setMode('redeem')}>Redeem</button>
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
