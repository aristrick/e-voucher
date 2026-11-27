'use client';
import { useEffect, useRef, useState } from 'react';
import { post, fmtTime, fmtFull, unit } from '@/lib/client';
import * as sfx from '@/lib/sound';
import { useUI } from '@/app/admin/ui';
import KeyIcon from '@/app/keyicon';

export default function Staff() {
  const { ask } = useUI();
  const [mode, setMode] = useState('checkin'), [keyOp, setKeyOp] = useState('take'), [coupon, setCoupon] = useState(''), [coupons, setCoupons] = useState([]);
  const [res, setRes] = useState(null), [code, setCode] = useState(''), [on, setOn] = useState(false), [booth, setBooth] = useState('');
  const [camReady, setCamReady] = useState(false), [torchOk, setTorchOk] = useState(false), [torch, setTorch] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false), [loadErr, setLoadErr] = useState(''), [camErr, setCamErr] = useState(''), [hist, setHist] = useState([]);
  const ref = useRef({}), timer = useRef(null), sc = useRef(null), heldRef = useRef(false);
  ref.current = { mode, coupon, booth, keyOp };

  const [mute, setMute] = useState(false);
  useEffect(() => {
    import('html5-qrcode').catch(() => {});   // muat pembaca QR lebih awal supaya kamera cepat siap
    setBooth(localStorage.getItem('booth') || ''); setMute(sfx.isMuted());
    // browser baru mengizinkan suara setelah layar disentuh sekali
    const u = () => sfx.unlock();
    window.addEventListener('pointerdown', u, { once: true }); window.addEventListener('keydown', u, { once: true });
    return () => { window.removeEventListener('pointerdown', u); window.removeEventListener('keydown', u); };
  }, []);
  const toggleMute = () => { const m = !mute; sfx.setMuted(m); setMute(m); if (!m) sfx.success(); };
  const saveBooth = (v) => { setBooth(v); localStorage.setItem('booth', v); };

  // Penyebab scan terasa lambat sebelumnya: kamera tidak menerima QR baru selama popup terbuka (sampai 3,8 detik)
  // dan tidak ada tanda apa pun selama menunggu server. Sekarang scan tidak pernah dikunci oleh popup:
  // hanya QR yang sama persis ditahan 3 detik agar tidak terbaca berulang.
  const [pending, setPending] = useState(false);
  const inflight = useRef(0), last = useRef({ c: '', t: 0 });
  const release = () => { clearTimeout(timer.current); heldRef.current = false; last.current.t = Date.now(); setRes(null); };
  // popup hadiah dan kunci (held) TIDAK menutup sendiri: panitia harus membaca hadiahnya lalu mengetuk Selesai
  const show = (d, held, mode) => {
    heldRef.current = held;
    setRes({ ...d, held });
    setHist((h) => [{ ...d, at: new Date().toISOString(), aksi: d.aksi || mode }, ...h].slice(0, 10));
    navigator.vibrate?.(d.ok ? 80 : [80, 60, 80]);
    if (d.ok) sfx.success(); else sfx.fail();
    clearTimeout(timer.current);
    if (!held) timer.current = setTimeout(release, 1800);
  };

  const act = async (c, manual) => {
    c = String(c || '').trim();
    if (!c) return;
    const now = Date.now();
    const mode = ref.current.mode;
    // mode KUNCI punya dua pilihan: ambil kunci (action key) atau terima kunci kembali (action keyback)
    const action = mode === 'key' && ref.current.keyOp === 'back' ? 'keyback' : mode;
    // mode Hadiah: selama popup terbuka atau ada scan yang belum selesai, scan lain diabaikan supaya hadiah peserta sebelumnya tidak tertimpa popup baru
    if ((mode === 'prize' || mode === 'key') && (heldRef.current || inflight.current > 0)) return;
    if (!manual && last.current.c === c && now - last.current.t < 3000) return;
    last.current = { c, t: now };
    sfx.scan(); navigator.vibrate?.(20);   // tanda instan bahwa QR terbaca
    inflight.current++; setPending(true);
    const r = await post('/api/staff', { action, code: c, coupon_id: Number(ref.current.coupon), booth: ref.current.booth });
    inflight.current--; if (!inflight.current) setPending(false);
    if (r.status === 401) { location.href = '/login'; return; }
    last.current.t = Date.now();
    show(r.status === 0 ? { ok: false, msg: 'Koneksi bermasalah, scan lagi' } : { ...r, ok: !!r.ok, msg: r.msg || r.error || 'Server bermasalah, scan lagi' }, mode === 'prize' || mode === 'key', action);
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
      s = new Html5Qrcode('cam'); sc.current = s;
      try {
        await s.start({ facingMode: 'environment' }, {
          fps: 24, disableFlip: true,
          // Kamera belakang dengan fokus otomatis terus-menerus dan resolusi 720p: QR tidak perlu menunggu fokus ulang dan tetap tajam
          videoConstraints: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 }, advanced: [{ focusMode: 'continuous' }] },
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },   // pakai pembaca QR bawaan perangkat jika ada (jauh lebih cepat)
        }, (t) => act(t));
        if (!dead) { setCamReady(true); try { setTorchOk(!!s.getRunningTrackCameraCapabilities().torchFeature().isSupported()); } catch {} }
      }
      catch { setCamErr('Kamera tidak bisa dibuka. Pakai input manual di bawah.'); }
      if (dead) { try { if (s.isScanning) await s.stop(); } catch {} }
    })();
    return () => { dead = true; try { if (s && s.isScanning) s.stop().catch(() => {}); } catch {} };
  }, [on]);

  const toggleTorch = async () => { try { await sc.current.getRunningTrackCameraCapabilities().torchFeature().apply(!torch); setTorch(!torch); } catch {} };
  const out = async () => { const ok = await ask('Yakin ingin keluar dari akun ini?', { title: 'Keluar?', okText: 'Ya, keluar' }); if (!ok) return; await post('/api/auth', { action: 'logout' }); location.href = '/login'; };
  const manual = () => { act(code, true); setCode(''); };

  if (!on) return <div className="wrap" role="status" aria-busy="true" aria-label="Memuat">{loadErr && <div className="err">{loadErr}. Mencoba lagi...</div>}<span className="sk" style={{ height: 52, borderRadius: 12 }} /><span className="sk" style={{ height: 300, marginTop: 14, borderRadius: 12 }} /><span className="sk" style={{ height: 52, marginTop: 14, borderRadius: 12 }} /></div>;
  const okCount = hist.filter((h) => h.ok).length;
  return (
    <div className="wrap">
      <div className="row" style={{ marginBottom: 10, justifyContent: 'flex-end' }}>
        <span className="gap">
          <button className="btn sm w" onClick={toggleMute} aria-pressed={!mute}>{mute ? 'Suara mati' : 'Suara hidup'}</button>
          {isAdmin && <a className="btn sm w" href="/admin">Dashboard</a>}
          <button className="btn sm y" onClick={out}>Keluar</button>
        </span>
      </div>
      <div className="modes" role="group" aria-label="Pilih mode scan">
        <button type="button" className={'mode ci' + (mode === 'checkin' ? ' on' : '')} aria-pressed={mode === 'checkin'} onClick={() => setMode('checkin')}>
          <b>{mode === 'checkin' ? '✓ ' : ''}CHECK-IN</b><span>Catat kehadiran di pintu masuk</span></button>
        <button type="button" className={'mode rd' + (mode === 'redeem' ? ' on' : '')} aria-pressed={mode === 'redeem'} onClick={() => setMode('redeem')}>
          <b>{mode === 'redeem' ? '✓ ' : ''}REDEEM</b><span>Tukar kupon di booth</span></button>
        <button type="button" className={'mode hd' + (mode === 'prize' ? ' on' : '')} aria-pressed={mode === 'prize'} onClick={() => setMode('prize')}>
          <b>{mode === 'prize' ? '✓ ' : ''}HADIAH</b><span>Serahkan hadiah undian ke pemenang</span></button>
        <button type="button" className={'mode ky' + (mode === 'key' ? ' on' : '')} aria-pressed={mode === 'key'} onClick={() => setMode('key')}>
          <b>{mode === 'key' ? '✓ ' : ''}KUNCI</b><span>Ambil kunci kamar atau terima kunci kembali</span></button>
      </div>
      {mode === 'key' && (
        <div className="gap" role="group" aria-label="Ambil atau kembalikan kunci" style={{ margin: '0 0 12px' }}>
          <button type="button" className={'btn ' + (keyOp === 'take' ? 'sel' : 'w')} style={{ flex: 1 }} aria-pressed={keyOp === 'take'} onClick={() => setKeyOp('take')}>Ambil kunci</button>
          <button type="button" className={'btn ' + (keyOp === 'back' ? 'sel' : 'w')} style={{ flex: 1 }} aria-pressed={keyOp === 'back'} onClick={() => setKeyOp('back')}>Kembalikan kunci</button>
        </div>)}
      {mode === 'key' && <p className="mute" style={{ margin: '0 0 10px' }}>{keyOp === 'back' ? 'Scan QR penghuni kamar yang mengembalikan kunci (atau ketik NIK-nya). Penghuni mana pun di kamar itu boleh.' : 'Penghuni kamar yang pertama discan jadi pembawa kunci. Penghuni lain di kamar itu tidak bisa mengambil lagi.'}</p>}
      {mode === 'redeem' && (coupons.length
        ? <select aria-label="Kupon yang ditukar" value={coupon} onChange={(e) => setCoupon(e.target.value)}>{coupons.map((c) => <option key={c.id} value={c.id}>{c.nama}</option>)}</select>
        : <div className="card yellow">Belum ada kupon. Admin perlu menambah kupon dulu.</div>)}
      {mode !== 'checkin' && <input aria-label="Nama booth" placeholder="Nama booth (opsional)" value={booth} onChange={(e) => saveBooth(e.target.value)} />}
      {!camErr && <>
        <div className={'camwrap ' + (mode === 'checkin' ? 'ci' : mode === 'redeem' ? 'rd' : mode === 'key' ? 'ky' : 'hd')}>
          <div id="cam" />
          {camReady && <div className="scan-frame" aria-hidden="true"><i /><i /><i /><i /></div>}
          <span className="cam-mode">{mode === 'checkin' ? 'MODE CHECK-IN' : mode === 'prize' ? 'MODE HADIAH' : mode === 'key' ? (keyOp === 'back' ? 'MODE KUNCI · KEMBALI' : 'MODE KUNCI · AMBIL') : 'MODE REDEEM' + (coupons.find((c) => String(c.id) === String(coupon))?.nama ? ' · ' + coupons.find((c) => String(c.id) === String(coupon)).nama : '')}</span>
          {!camReady && <div className="cam-load" role="status">Menyalakan kamera...</div>}
          {torchOk && <button type="button" className="btn sm w torch" onClick={toggleTorch} aria-pressed={torch}>{torch ? 'Senter mati' : 'Senter'}</button>}
          {pending && <div className="scanning" role="status">Memproses...</div>}
        </div>
        <p className="mute" style={{ textAlign: 'center', margin: '8px 0 0' }}>Arahkan QR ke dalam bingkai, jarak sekitar 15 sampai 25 cm</p>
      </>}
      {camErr && <div className="err">{camErr}</div>}
      <div className="card" style={{ marginTop: 16 }}>
        <input aria-label="NIK atau kode tiket" placeholder="Kamera gagal? Ketik NIK atau kode tiket" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && manual()} />
        <button className="btn y block" onClick={manual}>Proses manual</button>
      </div>

      {hist.length > 0 && <div className="card"><div className="row"><h2>Riwayat scan</h2><span className="mute">{okCount} berhasil</span></div>
        {hist.map((h, i) => (
          <div className="row" key={i} style={{ margin: '8px 0' }}>
            <span><b>{h.nama || 'Tidak dikenal'}</b><div className="mute">{h.aksi === 'redeem' ? 'Redeem' + (h.kupon ? ' ' + h.kupon : '') : h.aksi === 'keyback' ? 'Kunci kembali' + (h.kamar ? ' kamar ' + h.kamar : '') : h.aksi === 'key' ? 'Kunci kamar' + (h.kamar ? ' ' + h.kamar : '') : h.aksi === 'prize' ? 'Hadiah' + (h.hadiah?.length ? ' ' + h.hadiah.join(', ') : '') : 'Check-in'} · {fmtTime(h.at)}{h.ok ? '' : ' · ' + h.msg}</div></span>
            <span className={'chip' + (h.ok ? '' : ' no')}>{h.ok ? 'Berhasil' : 'Gagal'}</span>
          </div>))}
      </div>}

      {res && (
        <div className="pop" onClick={res.held ? undefined : release}>
          <div className={'pop-box ' + (res.ok ? 'ok' : 'bad')}>
            <div className="pop-icon">{res.ok ? '✓' : '✕'}</div>
            <div className="pop-title">{res.ok ? 'Berhasil' : 'Gagal'}</div>
            {res.nama && <div className="pop-name">{res.nama}</div>}
            {res.nik && <div>NIK {res.nik}{unit(res) ? ' · ' + unit(res) : ''}</div>}
            {res.kupon && <div className="pop-item">{res.kupon}</div>}
            {res.kamar && <div className="pop-item pop-key"><KeyIcon size={20} /> Kamar {res.kamar}</div>}
            {res.hadiah?.length > 0 && <div className="pop-items"><div className="pop-sub">{res.ok ? 'Hadiah yang diserahkan' : 'Hadiah peserta'}</div>{res.hadiah.map((h, i) => <div className="pop-item" key={i}>{h}</div>)}</div>}
            <div className="pop-msg">{res.msg}</div>
            {res.at && <div className="pop-time">{res.ok ? 'Tercatat' : 'Sebelumnya'}: {fmtFull(res.at)}</div>}
            {res.held
              ? <button type="button" className="btn g block" style={{ marginTop: 16 }} onClick={release} autoFocus>Selesai, tutup</button>
              : <div className="pop-hint">Ketuk untuk menutup</div>}
          </div>
        </div>
      )}
    </div>
  );
}
