'use client';
import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { post, fmtFull } from '@/lib/client';

const cached = () => { try { return JSON.parse(localStorage.getItem('tiket') || 'null'); } catch { return null; } };

export default function Home() {
  const [t, setT] = useState(null), [ev, setEv] = useState(null), [ready, setReady] = useState(false), [toast, setToast] = useState('');
  const [step, setStep] = useState(1), [info, setInfo] = useState(null), [f, setF] = useState({ nik: '', hp: '', pw: '', pw2: '' });
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const last = useRef(null), tt = useRef(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const say = (m) => { setToast(m); clearTimeout(tt.current); tt.current = setTimeout(() => setToast(''), 5000); };

  const load = async () => {
    const r = await post('/api/ticket');
    if (r.status === 401) { setT(null); last.current = null; localStorage.removeItem('tiket'); return; }
    if (r.status === 0) return setErr('Tidak ada sinyal. Tiket tersimpan tetap bisa dipakai.');
    if (!r.ok) return setErr(r.error);
    const prev = last.current;
    if (prev) {
      const baru = r.coupons.filter((c) => c.redeemed_at && !(prev.coupons || []).find((x) => x.id === c.id)?.redeemed_at);
      if (baru.length) say('Kupon ' + baru.map((c) => c.nama).join(', ') + ' berhasil ditukar');
      else if (r.hadir && !prev.hadir) say('Check-in berhasil. Selamat datang!');
      else if (r.win && !prev.win) say('Selamat, kamu memenangkan ' + r.win + '!');
    }
    last.current = r; setErr(''); setT(r); localStorage.setItem('tiket', JSON.stringify(r));
  };

  useEffect(() => {
    const c = cached(); if (c) { setT(c); last.current = c; }
    fetch('/api/event').then((r) => r.json()).then(setEv).catch(() => {});
    load().finally(() => setReady(true));
    const i = setInterval(() => { if (!document.hidden) load(); }, 10000);
    const vis = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(i); document.removeEventListener('visibilitychange', vis); };
  }, []);

  const lookup = async () => {
    if (!f.nik.trim()) return setErr('Isi NIK dulu');
    setBusy(true); setErr('');
    const r = await post('/api/auth', { action: 'lookup', nik: f.nik });
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    setInfo(r); setStep(2);
  };
  const submit = async () => {
    const hpNeeded = !info.activated || info.hp_required;
    if (hpNeeded && info.activated && f.hp.replace(/\D/g, '').length !== 4) return setErr('Isi 4 angka terakhir nomor HP kamu');
    if (hpNeeded && !info.activated && f.hp.replace(/\D/g, '').length < 9) return setErr('Isi nomor HP yang valid, contoh 081234567890');
    if (!f.pw || (!info.activated && f.pw.length < 6)) return setErr(info.activated ? 'Isi password' : 'Password minimal 6 karakter');
    if (!info.activated && f.pw !== f.pw2) return setErr('Ulangi password dengan sama persis');
    setBusy(true); setErr('');
    const r = await post('/api/auth', info.activated ? { action: 'login', nik: f.nik, hp: f.hp, password: f.pw } : { action: 'activate', nik: f.nik, hp: f.hp, password: f.pw });
    if (!r.ok) { setBusy(false); return setErr(r.error); }
    await load(); setBusy(false); setF({ nik: '', hp: '', pw: '', pw2: '' }); setStep(1); setInfo(null);
  };
  const out = async () => { await post('/api/auth', { action: 'logout' }); localStorage.removeItem('tiket'); last.current = null; setT(null); setStep(1); };

  if (!t && !ready) return <div className="wrap" role="status" aria-busy="true" aria-label="Memuat"><div className="card"><span className="sk" style={{ width: '40%', height: 18 }} /><span className="sk" style={{ height: 52, marginTop: 14 }} /><span className="sk" style={{ width: '70%', height: 14 }} /></div><div className="card"><span className="sk" style={{ width: '50%', height: 22 }} /><span className="sk" style={{ height: 180, marginTop: 14 }} /></div></div>;
  const e = ev?.event || {};

  /* ---------- sudah punya tiket ---------- */
  if (t) {
    const used = t.coupons.filter((c) => c.redeemed_at).length, all = t.coupons.length;
    return (
      <div className="wrap">
        {toast && <div className="toast" onClick={() => setToast('')}>{toast}</div>}
        <div className="row" style={{ marginBottom: 12 }}><h2 style={{ margin: 0 }}>Tiket saya</h2><button className="btn sm y" onClick={out}>Keluar</button></div>

        <div className="ticket">
          <div className="t-top">
            <div className="row"><b>{e.event_name || 'Gathering'}</b><span className={'chip' + (t.hadir ? '' : ' no')}>{t.hadir ? 'Sudah check-in' : 'Belum check-in'}</span></div>
            <div className="mute" style={{ color: '#000', marginTop: 10 }}>Atas nama</div>
            <div className="t-name">{t.nama}</div>
            <div>NIK {t.nik}{t.cabang ? ' · ' + t.cabang : ''}</div>
            {(e.event_date || e.event_venue) && <div style={{ marginTop: 6 }}>{[e.event_date, e.event_venue].filter(Boolean).join(' · ')}</div>}
          </div>
          <div className="t-tear" />
          <div className="t-bot">
            <div className="qr"><QRCodeSVG value={t.token} size={190} /></div>
            <div className="code">{t.kode}</div>
            <div className="mute">Tunjukkan QR ini ke panitia di pintu masuk dan di booth</div>
          </div>
        </div>

        {t.win && <div className="card yellow"><h2>Selamat, kamu menang!</h2>Hadiah: <b>{t.win}</b>. Temui panitia untuk mengambil.</div>}

        <div className="card"><h2>Status tiket</h2>
          <ul className="tl">
            <li><span className="dot done">✓</span><div><b>Tiket terbit</b><div className="mute">Tiket siap dipakai, tapi belum dihitung hadir</div></div></li>
            <li><span className={'dot' + (t.hadir ? ' done' : '')}>{t.hadir ? '✓' : ''}</span><div><b>Check-in di pintu masuk</b><div className="mute">{t.hadir ? 'Check-in: ' + fmtFull(t.hadir_at) : 'Belum. Tercatat saat panitia memindai QR kamu di pintu masuk'}</div></div></li>
            <li><span className={'dot' + (all && used === all ? ' done' : used ? ' part' : '')}>{all && used === all ? '✓' : ''}</span><div><b>Tukar kupon</b><div className="mute">{all ? `${used} dari ${all} kupon sudah ditukar` : 'Belum ada kupon'}</div></div></li>
            <li><span className={'dot' + (t.win ? ' done' : '')}>{t.win ? '✓' : ''}</span><div><b>Undian doorprize</b><div className="mute">{t.win ? 'Kamu menang ' + t.win : t.hadir ? 'Kamu otomatis ikut undian' : 'Check-in dulu supaya ikut undian'}</div></div></li>
          </ul>
        </div>

        <div className="card"><h2>Kupon</h2>
          {all === 0 && <div className="empty">Belum ada kupon.</div>}
          {t.coupons.map((c) => (
            <div className="row" key={c.id} style={{ margin: '8px 0' }}><span>{c.nama}</span>
              <span style={{ textAlign: 'right' }}><span className={'chip' + (c.redeemed_at ? ' off' : '')}>{c.redeemed_at ? 'Sudah ditukar' : 'Tersedia'}</span>{c.redeemed_at && <div className="mute">{fmtFull(c.redeemed_at)}</div>}</span></div>
          ))}
        </div>
        {err && <div className="err">{err}</div>}
      </div>
    );
  }

  /* ---------- belum punya tiket: halaman depan + alur klaim ---------- */
  const perks = [...(ev?.benefits || []).map((b) => 'Kupon ' + b), ...(ev?.doorprize ? ['Undian doorprize'] : [])];
  return (
    <div className="wrap land">
      <div className="land-grid">
        <div>
          <div className="hero">
            <span className="chip yellow" style={{ background: 'var(--yellow)' }}>E-tiket khusus karyawan</span>
            <h1>{e.event_name || 'Gathering Karyawan'}</h1>
            {e.event_desc && <p>{e.event_desc}</p>}
            {(e.event_date || e.event_venue) && <div className="meta">
              {e.event_date && <div><small>Tanggal</small>{e.event_date}</div>}
              {e.event_venue && <div><small>Lokasi</small>{e.event_venue}</div>}
            </div>}
          </div>
          <div className="ticket">
            <div className="t-top" style={{ background: '#fff' }}>
              <div className="row"><h2 style={{ margin: 0 }}>Tiket karyawan</h2><span className="chip">Tersedia</span></div>
              <div className="price" style={{ marginTop: 10 }}>Gratis</div>
              <div className="mute">1 tiket untuk 1 karyawan</div>
            </div>
            <div className="t-tear" />
            <div className="t-bot" style={{ textAlign: 'left' }}>
              <b>Tiket ini sudah termasuk</b>
              <ul className="perk">
                <li>Akses masuk lewat scan QR</li>
                {perks.map((p) => <li key={p}>{p}</li>)}
              </ul>
            </div>
          </div>
        </div>

        <div>
          <div className="card" id="klaim">
            <div className="steps">
              <div className={'step ' + (step === 1 ? 'on' : 'done')}><b>1</b>Cek NIK</div>
              <div className={'step ' + (step === 2 ? 'on' : '')}><b>2</b>Verifikasi</div>
              <div className="step"><b>3</b>Tiket terbit</div>
            </div>

            {step === 1 && <>
              <h2>Klaim tiketmu</h2>
              <label className="lbl" htmlFor="nik">NIK karyawan</label>
              <input id="nik" placeholder="Contoh: 20190342" inputMode="numeric" autoComplete="username" value={f.nik} onChange={set('nik')} onKeyDown={(x) => x.key === 'Enter' && lookup()} />
              {err && <div className="err">{err}</div>}
              <button className="btn block" disabled={busy} onClick={lookup}>{busy ? 'Mengecek...' : 'Cek NIK'}</button>
            </>}

            {step === 2 && info && <>
              <h2>{info.activated ? 'Masuk ke tiketmu' : 'Aktifkan tiketmu'}</h2>
              <div className="good" style={{ background: 'var(--yellow)' }}>Atas nama {info.nama}</div>
              {(!info.activated || info.hp_required) && <>
                <label className="lbl" htmlFor="hp">{info.activated ? '4 angka terakhir nomor HP (yang kamu isi saat membuat password)' : 'Nomor HP aktif'}</label>
                {info.activated
                  ? <input id="hp" placeholder="Contoh: 7890" inputMode="numeric" maxLength={4} autoComplete="off" value={f.hp} onChange={(e) => setF({ ...f, hp: e.target.value.replace(/\D/g, '').slice(0, 4) })} />
                  : <input id="hp" placeholder="081234567890" inputMode="tel" autoComplete="tel" value={f.hp} onChange={set('hp')} />}
              </>}
              <label className="lbl" htmlFor="pw">{info.activated ? 'Password' : 'Buat password (min. 6 karakter)'}</label>
              <input id="pw" type="password" autoComplete={info.activated ? 'current-password' : 'new-password'} value={f.pw} onChange={set('pw')} onKeyDown={(x) => x.key === 'Enter' && info.activated && submit()} />
              {!info.activated && <>
                <label className="lbl" htmlFor="pw2">Ulangi password</label>
                <input id="pw2" type="password" autoComplete="new-password" value={f.pw2} onChange={set('pw2')} onKeyDown={(x) => x.key === 'Enter' && submit()} />
              </>}
              {err && <div className="err">{err}</div>}
              <button className="btn block" disabled={busy} onClick={submit}>{busy ? 'Memproses...' : info.activated ? 'Masuk dan lihat tiket' : 'Terbitkan tiket'}</button>
              <button className="btn w block" style={{ marginTop: 10 }} onClick={() => { setStep(1); setErr(''); setInfo(null); }}>Ganti NIK</button>
              {info.activated && <p className="mute">Lupa password? Minta panitia mereset, lalu aktifkan ulang.</p>}
            </>}
          </div>

          <div className="card"><h2>Cara klaim</h2>
            <ol style={{ paddingLeft: 20, margin: 0 }}>
              <li>Masukkan NIK kamu.</li>
              <li>Isi nomor HP kamu dan buat password. Saat masuk berikutnya cukup isi 4 angka terakhir nomor HP.</li>
              <li>Tiket QR terbit. Tunjukkan ke panitia di pintu masuk.</li>
            </ol>
            <p className="mute">Tiket terbit setelah kamu membuat password. Check-in baru tercatat saat panitia memindai QR tiketmu di pintu masuk.</p>
          </div>
          <a href="/login">Login panitia</a>
        </div>
      </div>
    </div>
  );
}
