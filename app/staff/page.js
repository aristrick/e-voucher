'use client';
import { useEffect, useRef, useState } from 'react';
import { post, fmtTime, fmtFull } from '@/lib/client';

export default function Staff() {
  const [mode, setMode] = useState('checkin'), [coupon, setCoupon] = useState(''), [coupons, setCoupons] = useState([]);
  const [res, setRes] = useState(null), [code, setCode] = useState(''), [on, setOn] = useState(false), [booth, setBooth] = useState('');
  const [isAdmin, setIsAdmin] = useState(false), [loadErr, setLoadErr] = useState(''), [camErr, setCamErr] = useState(''), [hist, setHist] = useState([]);
  const busy = useRef(false), ref = useRef({}), timer = useRef(null);
  ref.current = { mode, coupon, booth };

  useEffect(() => { setBooth(localStorage.getItem('booth') || ''); }, []);
  const saveBooth = (v) => { setBooth(v); localStorage.setItem('booth', v); };

  // tutup popup, lalu izinkan scan berikutnya (jeda singkat agar QR yang sama tidak terbaca ulang)
  const release = () => {
    clearTimeout(timer.current);
    setRes(null);
    setTimeout(() => { busy.current = false; }, 800);
  };
  const show = (d) => {
    setRes(d);
    setHist((h) => [{ ...d, at: new Date().toISOString(), aksi: d.aksi || ref.current.mode }, ...h].slice(0, 10));
    navigator.vibrate?.(d.ok ? 80 : [80, 60, 80]);
    clearTimeout(timer.current);
    timer.current = setTimeout(release, 3000);
  };

  const act = async (c) => {
    if (busy.current || !c) return;
    busy.current = true;
    const r = await post('/api/staff', { action: ref.current.mode, code: c, coupon_id: Number(ref.current.coupon), booth: ref.current.booth });
    if (r.status === 401) { location.href = '/login'; return; }
    show(r.status === 0 ? { ok: false, msg: 'Koneksi bermasalah, scan lagi' } : { ...r, ok: !!r.ok, msg: r.msg || r.error || 'Server bermasalah, scan lagi' });
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      while (alive) {
        const r = await post('/api/staff', { action: 'coupons' });
        if (r.status === 401) { location.href = '/login'; return; }
        if (r.ok && Array.isArray(r.coupons)) { setCoupons(r.coupons); setIsAdmin(r.role === 'admin'); setCoupon(r.coupons[0]?.id || ''); setOn(true); return; }
        setLoadErr(r.error || 'Server error ' + r.status);
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

  const out = async () => { await post('/api/auth', { action: 'logout' }); location.href = '/login'; };
  const manual = () => { act(code); setCode(''); };

  if (!on) return <div className="wrap">Memuat...{loadErr && <div className="err">{loadErr}. Mencoba lagi...</div>}</div>;
  const okCount = hist.filter((h) => h.ok).length;
  return (
    <div className="wrap">
      <div className="row" style={{ marginBottom: 12 }}>
        <span className="gap">
          <button className={'btn b' + (mode === 'checkin' ? ' sel' : '')} onClick={() => setMode('checkin')}>Check-in</button>
          <button className={'btn b' + (mode === 'redeem' ? ' sel' : '')} onClick={() => setMode('redeem')}>Redeem</button>
        </span>
        <span className="gap">
          {isAdmin && <a className="btn sm w" href="/admin">Dashboard</a>}
          <button className="btn sm y" onClick={out}>Keluar</button>
        </span>
      </div>
      {mode === 'redeem' && <>
        {coupons.length
          ? <select aria-label="Kupon yang ditukar" value={coupon} onChange={(e) => setCoupon(e.target.value)}>{coupons.map((c) => <option key={c.id} value={c.id}>{c.nama}</option>)}</select>
          : <div className="card yellow">Belum ada kupon. Admin perlu menambah kupon dulu.</div>}
        <input aria-label="Nama booth" placeholder="Nama booth (opsional)" value={booth} onChange={(e) => saveBooth(e.target.value)} />
      </>}
      <div id="cam" />
      {camErr && <div className="err">{camErr}</div>}
      <div className="card" style={{ marginTop: 16 }}>
        <input aria-label="NIK atau kode tiket" placeholder="Kamera gagal? Ketik NIK atau kode tiket" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && manual()} />
        <button className="btn y block" onClick={manual}>Proses manual</button>
      </div>

      {hist.length > 0 && <div className="card"><div className="row"><h2>Riwayat scan</h2><span className="mute">{okCount} berhasil</span></div>
        {hist.map((h, i) => (
          <div className="row" key={i} style={{ margin: '8px 0' }}>
            <span><b>{h.nama || 'Tidak dikenal'}</b><div className="mute">{h.aksi === 'redeem' ? 'Redeem' + (h.kupon ? ' ' + h.kupon : '') : 'Check-in'} · {fmtTime(h.at)}{h.ok ? '' : ' · ' + h.msg}</div></span>
            <span className={'chip' + (h.ok ? '' : ' no')}>{h.ok ? 'Berhasil' : 'Gagal'}</span>
          </div>))}
      </div>}

      {res && (
        <div className="pop" onClick={release}>
          <div className={'pop-box ' + (res.ok ? 'ok' : 'bad')}>
            <div className="pop-icon">{res.ok ? '✓' : '✕'}</div>
            <div className="pop-title">{res.ok ? 'Berhasil' : 'Gagal'}</div>
            {res.nama && <div className="pop-name">{res.nama}</div>}
            {res.nik && <div>NIK {res.nik}{res.cabang ? ' · ' + res.cabang : ''}</div>}
            {res.kupon && <div className="pop-item">{res.kupon}</div>}
            <div className="pop-msg">{res.msg}</div>
            {res.at && <div className="pop-time">{res.ok ? 'Tercatat' : 'Sebelumnya'}: {fmtFull(res.at)}</div>}
            <div className="pop-hint">Ketuk untuk menutup</div>
          </div>
        </div>
      )}
    </div>
  );
}
