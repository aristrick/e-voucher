'use client';
import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { post, fmtFull, unit, holdLoop } from '@/lib/client';
import { useUI, Splash } from '@/app/admin/ui';
import Confetti from './confetti';
import PxIcons from './pxicons';
import PwField from './pwfield';
import KeyIcon from './keyicon';

const cached = () => { try { return JSON.parse(localStorage.getItem('tiket') || 'null'); } catch { return null; } };

export default function Home() {
  const { ask } = useUI();
  const [t, setT] = useState(null), [ev, setEv] = useState(null), [ready, setReady] = useState(false), [toast, setToast] = useState('');
  const [step, setStep] = useState(1), [info, setInfo] = useState(null), [f, setF] = useState({ nik: '', hp: '', pw: '', pw2: '' });
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const last = useRef(null), tt = useRef(null), partied = useRef(false), inflight = useRef(false), lastLoad = useRef(0);
  const [party, setParty] = useState(false), [splash, setSplash] = useState(false), [fresh, setFresh] = useState([]), [enter, setEnter] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  // Saat tiket pertama kali tampil (setelah login atau saat halaman dibuka), selalu mulai dari bagian paling atas tiket.
  const hasT = !!t;
  useEffect(() => {
    if (!hasT) return;
    const top = () => window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    top(); const r = requestAnimationFrame(top); const x = setTimeout(top, 120);
    return () => { cancelAnimationFrame(r); clearTimeout(x); };
  }, [hasT]);
  const say = (m) => { setToast(m); clearTimeout(tt.current); tt.current = setTimeout(() => setToast(''), 5000); };

  const load = async () => {
    if (inflight.current) return true;
    inflight.current = true; lastLoad.current = Date.now();
    try { return await loadInner(); } finally { inflight.current = false; }
  };
  // mengembalikan false bila gagal (sinyal/server), supaya polling bisa mundur (backoff)
  const loadInner = async () => {
    const r = await post('/api/ticket');
    if (r.status === 401) { setT(null); last.current = null; localStorage.removeItem('tiket'); return true; }
    if (r.status === 0) { setErr('Tidak ada sinyal. Tiket tersimpan tetap bisa dipakai.'); return false; }
    if (!r.ok) { setErr(r.error); return false; }
    const prev = last.current;
    if (prev) {
      const baru = r.coupons.filter((c) => c.redeemed_at && !(prev.coupons || []).find((x) => x.id === c.id)?.redeemed_at);
      if (baru.length) setFresh((f) => [...f, ...baru.map((c) => c.id)]);
      if (baru.length) say('Kupon ' + baru.map((c) => c.nama).join(', ') + ' berhasil ditukar');
      else if (prev.prizes && (r.prizes || []).some((p) => p.claimed_at && !prev.prizes.find((x) => x.id === p.id)?.claimed_at)) say('Hadiah kamu sudah diserahkan. Selamat menikmati!');
      else if (r.kamar?.kunci?.diambil_at && !prev.kamar?.kunci?.diambil_at) say(r.kamar.kunci.saya ? 'Kunci kamar sudah diserahkan kepadamu' : 'Kunci kamar sudah diambil oleh ' + r.kamar.kunci.pemegang);
      else if (r.kamar?.dapat && !prev.kamar?.dapat) say('Pembagian kamar sudah tersedia: kamar ' + r.kamar.nomor + (r.kamar.nama ? ' (' + r.kamar.nama + ')' : ''));
      else if (r.hadir && !prev.hadir) say('Check-in berhasil. Selamat datang!');
      else if (r.win && !prev.win) say('Selamat, kamu memenangkan ' + r.win + '!');
    }
    last.current = r; setErr(''); setT(r); localStorage.setItem('tiket', JSON.stringify(r));
    return true;
  };

  useEffect(() => {
    const c = cached(); if (c) { setT(c); last.current = c; }
    new Image().src = '/loading.gif';
    fetch('/api/event').then((r) => r.json()).then(setEv).catch(() => {});
    // Polling tiap ~25 detik (+ acak 0-5 detik agar 500 HP tidak serentak). Gagal -> jeda dilipat dua, maksimal 2 menit; sukses -> kembali normal.
    let stop = false, timer = null, fails = 0;
    const BASE = 25000, MAX = 120000;
    const schedule = () => {
      if (stop) return;
      const wait = Math.min(BASE * 2 ** fails, MAX) + Math.random() * 5000;
      timer = setTimeout(tick, wait);
    };
    const tick = async () => {
      if (stop) return;
      if (document.hidden) return schedule();
      const ok = await load().catch(() => false);
      fails = ok ? 0 : Math.min(fails + 1, 3);
      schedule();
    };
    load().then((ok) => { fails = ok ? 0 : 1; }).catch(() => { fails = 1; }).finally(() => { setReady(true); schedule(); });
    // kembali membuka tab: muat ulang, tapi paling cepat 10 detik dari muatan terakhir
    const vis = () => {
      if (document.hidden) return;
      if (Date.now() - lastLoad.current > 10000) load().then((ok) => { if (ok) fails = 0; }).catch(() => {});
      fetch('/api/event').then((r) => r.json()).then(setEv).catch(() => {});
    };
    document.addEventListener('visibilitychange', vis);
    return () => { stop = true; clearTimeout(timer); document.removeEventListener('visibilitychange', vis); };
  }, []);

  // pemenang undian: confetti sekali setiap login atau buka tiket, dan langsung saat kemenangan baru masuk
  useEffect(() => {
    if (!t?.win || partied.current) return;
    partied.current = true; setParty(true); say('Selamat, kamu memenangkan ' + t.win + '!');
    const x = setTimeout(() => setParty(false), 6500); return () => clearTimeout(x);
  }, [t?.win]);

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
    const t0 = Date.now(); setSplash(true);
    const r = await post('/api/auth', info.activated ? { action: 'login', nik: f.nik, hp: f.hp, password: f.pw } : { action: 'activate', nik: f.nik, hp: f.hp, password: f.pw });
    if (!r.ok) { await new Promise((x) => setTimeout(x, 350)); setSplash(false); setBusy(false); return setErr(r.error); }
    await load(); await holdLoop(t0);
    setEnter(true); setSplash(false); setBusy(false); setF({ nik: '', hp: '', pw: '', pw2: '' }); setStep(1); setInfo(null);
  };
  const out = async () => { const ok = await ask('Yakin ingin keluar dari akun ini?', { title: 'Keluar?', okText: 'Ya, keluar' }); if (!ok) return; await post('/api/auth', { action: 'logout' }); localStorage.removeItem('tiket'); last.current = null; partied.current = false; setT(null); setStep(1); };

  if (!t && !ready) return <div className="wrap" role="status" aria-busy="true" aria-label="Memuat"><div className="card"><span className="sk" style={{ width: '40%', height: 18 }} /><span className="sk" style={{ height: 52, marginTop: 14 }} /><span className="sk" style={{ width: '70%', height: 14 }} /></div><div className="card"><span className="sk" style={{ width: '50%', height: 22 }} /><span className="sk" style={{ height: 180, marginTop: 14 }} /></div></div>;
  const e = ev?.event || {};

  /* ---------- sudah punya tiket ---------- */
  if (t) {
    const used = t.coupons.filter((c) => c.redeemed_at).length, all = t.coupons.length;
    // tiket lama di cache HP belum punya daftar hadiah: pakai teks hadiah sampai data baru masuk
    const pz = t.prizes || (t.win ? t.win.split(', ').map((nama) => ({ nama })) : []);
    return (
      <div className="wrap">
        {splash && <Splash text="Membuka tiketmu" />}
        {party && <Confetti />}
        {toast && <div className="toast" onClick={() => setToast('')}>{toast}</div>}
        <div className="row" style={{ marginBottom: 12 }}><h2 style={{ margin: 0 }}>Tiket saya</h2><button className="btn sm y" onClick={out}>Keluar</button></div>

        {pz.length > 0 && (
          <div className="card yellow prize-banner" role="status">
            <div className="pb-tag">Selamat, kamu memenangkan hadiah!</div>
            {pz.map((p, i) => (
              <div className={'pb-item' + (p.claimed_at ? ' done' : '')} key={p.id || i}>
                <div className="pop-item pb-name">{p.nama}</div>
                <div className="pb-state">{p.claimed_at
                  ? 'Sudah diambil · ' + fmtFull(p.claimed_at)
                  : 'Belum diambil. Tunjukkan QR tiket di bawah ke panitia untuk menukarkan hadiah ini.'}</div>
              </div>))}
          </div>
        )}

        <div className={'ticket' + (enter ? ' enter' : '')}>
          <div className="t-sec up">
            <div className="t-ribbon"><span>Tiket masuk</span><PxIcons /><span>1 karyawan</span></div>
            <div className="t-top">
              <div className="t-event">{e.event_name || 'Gathering'}</div>
              <div className="t-state"><span className={'chip stamp' + (t.hadir ? ' on' : ' no')}>{t.hadir ? 'Sudah check-in' : 'Belum check-in'}</span></div>
              <div className="t-lbl">Atas nama</div>
              <div className="t-name">{t.nama}</div>
              <dl className="t-info"><dt>NIK</dt><dd>{t.nik}</dd>{unit(t) && <><dt>Unit</dt><dd>{unit(t)}</dd></>}</dl>
              {(e.event_date || e.event_venue) && <div className="t-when">{e.event_date && <b>{e.event_date}</b>}{e.event_venue && <div>{e.event_venue}</div>}</div>}
            </div>
          </div>
          <div className="t-perf" aria-hidden="true" />
          <div className="t-sec dn">
            <div className="t-bot">
              <div className="qr"><QRCodeSVG value={t.token} size={190} /></div>
              <div className="code">{t.kode}</div>
              <div className="mute">Tunjukkan QR ini ke panitia di pintu masuk dan di booth</div>
            </div>
          </div>
        </div>

        {t.kamar && (
          <div className="card room-card" aria-label="Pembagian kamar">
            <h2>Kamar kamu</h2>
            {!t.kamar.dapat ? <p className="mute" style={{ margin: 0 }}>Pembagian kamar belum tersedia untuk kamu. Hubungi panitia kalau kamu belum mendapat kamar.</p> : <>
              <div className="room-top">
                <div className="room-no"><small>KAMAR</small>{t.kamar.nomor}</div>
                <div>
                  {t.kamar.nama && <div className="room-name">{t.kamar.nama}</div>}
                  {t.kamar.catatan && <div className="room-note">{t.kamar.catatan}</div>}
                  <div className="room-note">{t.kamar.jumlah} penghuni{t.kamar.kapasitas ? ' dari ' + t.kamar.kapasitas + ' tempat' : ''}</div>
                </div>
              </div>
              {(() => {
                const k = t.kamar.kunci;
                if (!k) return (
                  <div className="key-box" role="status">
                    <KeyIcon size={22} />
                    <div>
                      <b>Kunci kamar belum diambil</b>
                      <div className="mu">Saat datang, tunjukkan QR tiket ke panitia. Siapa pun penghuni kamar yang discan lebih dulu menjadi pembawa kunci.</div>
                    </div>
                  </div>);
                return (
                  <div className={'key-box' + (k.saya ? ' me' : '')} role="status">
                    <KeyIcon size={22} />
                    <div>
                      <b>{k.saya ? 'Kamu pembawa kunci kamar ini' : 'Pembawa kunci: ' + k.pemegang}</b>
                      <div className="mu">{(k.saya ? 'Kunci sudah kamu ambil' : 'Kunci sudah diambil atas nama ' + k.pemegang) + (k.diambil_at ? ' · ' + fmtFull(k.diambil_at) : '')}</div>
                    </div>
                  </div>);
              })()}
              <h3>Teman sekamar{t.kamar.teman.length ? ' (' + t.kamar.teman.length + ')' : ''}</h3>
              {t.kamar.teman.length === 0 ? <p className="mute" style={{ margin: 0 }}>Belum ada teman sekamar yang terdaftar.</p> : (
                <ul className="mates">{t.kamar.teman.map((m, i) => <li key={i} className={m.kunci ? 'key' : ''}><b>{m.nama}{m.kunci && <> <KeyIcon size={14} label="Pembawa kunci" /></>}</b>{m.unit && <span className="mu">{m.unit}</span>}</li>)}</ul>)}
            </>}
          </div>
        )}

        <div className="card"><h2>Status tiket</h2>
          <ul className="tl">
            <li><span className="dot done">✓</span><div><b>Tiket terbit</b><div className="mute">Tiket siap dipakai, tapi belum dihitung hadir</div></div></li>
            <li><span className={'dot' + (t.hadir ? ' done' : '')}>{t.hadir ? '✓' : ''}</span><div><b>Check-in di pintu masuk</b><div className="mute">{t.hadir ? 'Check-in: ' + fmtFull(t.hadir_at) : 'Belum. Tercatat saat panitia memindai QR kamu di pintu masuk'}</div></div></li>
            <li><span className={'dot' + (all && used === all ? ' done' : used ? ' part' : '')}>{all && used === all ? '✓' : ''}</span><div><b>Tukar kupon</b><div className="mute">{all ? `${used} dari ${all} kupon sudah ditukar` : 'Belum ada kupon'}</div></div></li>
            <li><span className={'dot' + (t.win ? ' done' : '')}>{t.win ? '✓' : ''}</span><div><b>Undian doorprize</b><div className="mute">{t.win ? 'Kamu menang ' + t.win : t.hadir ? 'Kamu otomatis ikut undian' : 'Check-in dulu supaya ikut undian'}</div></div></li>
          </ul>
        </div>

        <div className="card plain"><h2>Kupon</h2>
          {all === 0 && <div className="empty">Belum ada kupon.</div>}
          {t.coupons.map((c) => (
            <div className="row cpn-row" key={c.id}><span className={'cpn' + (c.redeemed_at ? ' used' : '') + (fresh.includes(c.id) ? ' fresh' : '')}>{c.nama}</span>
              <span style={{ textAlign: 'right' }}><span className={'chip' + (c.redeemed_at ? ' off' : '')}>{c.redeemed_at ? 'Sudah ditukar' : 'Tersedia'}</span>{c.redeemed_at && <div className="mute">{fmtFull(c.redeemed_at)}</div>}</span></div>
          ))}
        </div>
        {ev?.survey && <div className="card"><h2>Survey acara</h2><p className="mute" style={{ marginTop: 0 }}>Bantu kami jadi lebih baik dengan mengisi umpan balik singkat tentang acara ini.</p><a className="btn block" href="/survey">Isi survey</a></div>}
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
            <div className="t-sec up white">
              <div className="t-ribbon"><span>Tiket masuk</span><PxIcons /><span>Gratis</span></div>
              <div className="t-top">
                <div className="row"><h2 style={{ margin: 0 }}>Tiket karyawan</h2><span className="chip">Tersedia</span></div>
                <div className="price" style={{ marginTop: 10 }}>Gratis</div>
                <div className="mute">1 tiket untuk 1 karyawan</div>
              </div>
            </div>
            <div className="t-perf" aria-hidden="true" />
            <div className="t-sec dn">
              <div className="t-bot" style={{ textAlign: 'left' }}>
                <b>Tiket ini sudah termasuk</b>
                <ul className="perk">
                  <li>Akses masuk lewat scan QR</li>
                  {perks.map((p) => <li key={p}>{p}</li>)}
                </ul>
              </div>
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
              <PwField id="pw" autoComplete={info.activated ? 'current-password' : 'new-password'} value={f.pw} onChange={set('pw')} onKeyDown={(x) => x.key === 'Enter' && info.activated && submit()} />
              {!info.activated && <>
                <label className="lbl" htmlFor="pw2">Ulangi password</label>
                <PwField id="pw2" autoComplete="new-password" value={f.pw2} onChange={set('pw2')} onKeyDown={(x) => x.key === 'Enter' && submit()} />
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
