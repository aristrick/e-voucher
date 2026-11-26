'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { adm, unit } from '@/lib/client';
import * as sfx from '@/lib/sound';

const COLORS = ['#A66CFF', '#FF8FB8', '#FFD84D', '#7CC4FF', '#C8E64A'];
const TAU = Math.PI * 2, SIZE = 900, R = SIZE / 2 - 14;
const IDLE = Array.from({ length: 12 }, () => ({ nama: '?' }));
const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const short = (s, n = 16) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

// Dropdown hadiah buatan sendiri: nama panjang turun ke baris berikutnya (select bawaan browser memotongnya).
function PrizePick({ prizes, value, onChange, disabled }) {
  const [open, setOpen] = useState(false), [hi, setHi] = useState(0), [q, setQ] = useState(''), box = useRef(null), sbox = useRef(null);
  const cur = prizes.find((p) => String(p.id) === String(value));
  const left = (p) => Math.max(p.stok - p.won, 0);
  // kolom cari hanya muncul jika hadiahnya banyak; semua kata yang diketik harus ada di nama hadiah
  const searchable = prizes.length > 6;
  const shown = useMemo(() => {
    const t = q.toLowerCase().split(/\s+/).filter(Boolean);
    return t.length ? prizes.filter((p) => t.every((w) => String(p.nama).toLowerCase().includes(w))) : prizes;
  }, [prizes, q]);
  useEffect(() => {
    if (!open) return;
    const f = (e) => { if (!box.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', f); return () => document.removeEventListener('pointerdown', f);
  }, [open]);
  const openList = () => { setQ(''); setHi(Math.max(prizes.findIndex((p) => String(p.id) === String(value)), 0)); setOpen(true); };
  useEffect(() => { if (open && searchable) sbox.current?.focus(); }, [open, searchable]);
  useEffect(() => { if (open) document.getElementById('pz-o' + hi)?.scrollIntoView({ block: 'nearest' }); }, [open, hi]);
  const pick = (p) => {
    if (!p || left(p) < 1) return;
    onChange(String(p.id)); setOpen(false); setQ('');
    box.current?.querySelector('button')?.blur(); // supaya tombol Spasi langsung bisa memutar roda
  };
  const onKey = (e) => {
    if (disabled) return;
    if (!open) { if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); openList(); } return; }
    const typing = e.target.tagName === 'INPUT';   // Spasi di kolom cari adalah huruf biasa, bukan memilih
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); box.current?.querySelector('button')?.focus(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setHi((i) => Math.min(i + 1, shown.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' || (e.key === ' ' && !typing)) { e.preventDefault(); pick(shown[hi]); }
    else if (e.key === 'Tab') setOpen(false);
  };
  return (
    <div className="pzd" ref={box}>
      <button type="button" id="pz" className="pzd-btn" disabled={disabled} aria-haspopup="listbox" aria-expanded={open} aria-controls="pz-list"
        aria-activedescendant={open ? `pz-o${hi}` : undefined} onClick={() => (open ? setOpen(false) : openList())} onKeyDown={onKey}>
        <span className="pzd-txt">{cur ? <><b>{cur.nama}</b><small>sisa {left(cur)} dari {cur.stok}</small></> : <b>Semua hadiah sudah habis</b>}</span>
        <span className="pzd-arr" aria-hidden="true" />
      </button>
      {open && (
        <div className="pzd-pop">
          {searchable && (
            <div className="pzd-search">
              <input ref={sbox} type="search" aria-label="Cari hadiah" placeholder="Cari nama hadiah..." autoComplete="off" value={q}
                onChange={(e) => { setQ(e.target.value); setHi(0); }} onKeyDown={onKey} />
              <small>{shown.length} dari {prizes.length} hadiah</small>
            </div>
          )}
          <ul id="pz-list" role="listbox" className="pzd-list" aria-labelledby="pz">
            {shown.map((p, i) => (
              <li key={p.id} id={`pz-o${i}`} role="option" aria-selected={String(p.id) === String(value)} aria-disabled={left(p) < 1}
                className={(i === hi ? 'hi ' : '') + (left(p) < 1 ? 'out' : '')} onPointerEnter={() => setHi(i)} onClick={() => pick(p)}>
                <b>{p.nama}</b><small>{left(p) < 1 ? 'Habis' : `sisa ${left(p)} dari ${p.stok}`}</small>
              </li>
            ))}
            {shown.length === 0 && <li role="presentation" className="none">Tidak ada hadiah yang cocok dengan "{q}"</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

function paint(cv, segs, rot) {
  const c = cv.getContext('2d'), n = segs.length, arc = TAU / n, m = SIZE / 2;
  c.clearRect(0, 0, SIZE, SIZE);
  c.save(); c.translate(m, m); c.rotate(rot);
  segs.forEach((s, i) => {
    let k = i % COLORS.length; if (i === n - 1 && n > 1 && k === 0) k = 2;
    c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, R, i * arc, (i + 1) * arc); c.closePath();
    c.fillStyle = COLORS[k]; c.fill(); c.lineWidth = 5; c.strokeStyle = '#000'; c.stroke();
    c.save(); c.rotate((i + 0.5) * arc); c.fillStyle = '#000'; c.textAlign = 'right'; c.textBaseline = 'middle';
    c.font = `700 ${Math.max(14, Math.min(34, arc * R * 0.36))}px "Space Grotesk",system-ui,sans-serif`;
    c.fillText(short(s.nama), R - 26, 0); c.restore();
  });
  c.restore();
  c.beginPath(); c.arc(m, m, R + 2, 0, TAU); c.lineWidth = 10; c.strokeStyle = '#000'; c.stroke();
  c.beginPath(); c.arc(m, m, 52, 0, TAU); c.fillStyle = '#fff'; c.fill(); c.lineWidth = 8; c.strokeStyle = '#000'; c.stroke();
  c.fillStyle = '#000'; c.font = '700 26px "Space Grotesk",system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('UNDI', m, m + 1);
}

export default function Stage() {
  const [d, setD] = useState(null), [lerr, setLerr] = useState(''), [prize, setPrize] = useState(''), [err, setErr] = useState('');
  const [segs, setSegs] = useState(IDLE), [run, setRun] = useState(false), [win, setWin] = useState(null), [boom, setBoom] = useState(false), [mute, setMute] = useState(false), [note, setNote] = useState('');
  const nt = useRef(null), cv = useRef(null), rot = useRef(0), raf = useRef(0), lock = useRef(false);
  const [ppl, setPpl] = useState(null);
  useEffect(() => { setMute(sfx.isMuted()); }, []);

  const load = useCallback(async () => {
    const r = await adm({ action: 'stageInfo' });
    if (!r.ok) { setLerr(r.error || 'Data belum bisa dimuat'); return false; }
    setLerr(''); setD(r);
    setPrize((p) => (r.prizes.some((x) => String(x.id) === String(p) && x.stok > x.won) ? p : String(r.prizes.find((x) => x.stok > x.won)?.id || '')));
    return r;
  }, []);
  useEffect(() => {
    let alive = true;
    (async () => { while (alive) { if (await load()) break; await new Promise((x) => setTimeout(x, 3000)); } })();
    return () => { alive = false; cancelAnimationFrame(raf.current); };
  }, [load]);
  useEffect(() => { if (cv.current) paint(cv.current, segs, rot.current); }, [segs, d]);
  // daftar peserta di kiri roda: diambil ulang saat hadiah diganti atau data berubah (setelah menang / tidak hadir). Tidak berubah selama roda berputar.
  useEffect(() => {
    if (!d) return;
    let dead = false;
    adm({ action: 'stagePeserta', prize_id: prize ? Number(prize) : null }).then((r) => { if (!dead && r.ok) setPpl(r); });
    return () => { dead = true; };
  }, [prize, d]);
  const pplList = useMemo(() => (ppl?.list || []).map((x) => <li key={x.nik}><b>{x.nama}</b><small>{x.nik}</small></li>), [ppl]);

  const animate = (list, idx, done) => {
    const arc = TAU / list.length;
    // titik runcing di atas (-90 derajat). Segmen pemenang diputar ke sana, dengan sedikit geser acak di dalam segmennya.
    const target = -Math.PI / 2 - (idx + 0.5 + (Math.random() - 0.5) * 0.6) * arc;
    const from = rot.current, delta = ((target - from) % TAU + TAU) % TAU;
    const to = from + delta + TAU * (6 + Math.floor(Math.random() * 3));
    const dur = 7500, t0 = performance.now(); let lastSeg = -1;
    const frame = (now) => {
      const p = Math.min((now - t0) / dur, 1), e = 1 - Math.pow(1 - p, 4);
      rot.current = from + (to - from) * e;
      const seg = Math.floor((((-Math.PI / 2 - rot.current) % TAU) + TAU) % TAU / arc);
      if (seg !== lastSeg) { lastSeg = seg; sfx.tick(); }
      paint(cv.current, list, rot.current);
      if (p < 1) raf.current = requestAnimationFrame(frame); else done();
    };
    raf.current = requestAnimationFrame(frame);
  };

  // pid diisi saat undi ulang: id hadiah dikirim langsung, tidak dibaca dari state yang bisa sudah berubah/usang
  const spin = async (pid) => {
    const forced = typeof pid === 'number';
    // kunci lewat ref (langsung berlaku, tidak tergantung render): hanya satu undian berjalan pada satu waktu
    if (!forced && (lock.current || run)) return;
    if (!forced && (!prize || d.eligible < 1)) return;
    const prizeId = forced ? pid : Number(prize);
    lock.current = true;
    setErr(''); setWin(null); setBoom(false); setRun(true);
    sfx.unlock(); sfx.spinStart();
    const r = await adm({ action: 'draw', prize_id: prizeId });
    if (!r.ok) { lock.current = false; setRun(false); return setErr(r.error); }
    r.winner.prize_id = prizeId; r.winner.prize_nama = d.prizes.find((x) => x.id === prizeId)?.nama || '';
    const list = shuffle([...(r.decoys || []), r.winner]);
    const idx = list.findIndex((x) => x === r.winner);
    rot.current = 0; setSegs(list);
    requestAnimationFrame(() => animate(list, idx, () => { sfx.win(); setWin(r.winner); setBoom(true); lock.current = false; setRun(false); load(); setTimeout(() => setBoom(false), 5000); }));
  };
  const forfeit = async () => {
    if (lock.current) return;
    const id = win.draw_id, pid = win.prize_id;
    lock.current = true; setRun(true); setWin(null);   // tombol Putar roda dan tombol Spasi terkunci selama proses undi ulang
    const r = await adm({ action: 'forfeit', draw_id: id });
    if (!r.ok) { lock.current = false; setRun(false); return setErr(r.error); }
    // pastikan stok benar-benar sudah kembali di data terbaru sebelum memutar lagi (bukan sekadar menunggu waktu)
    let fresh = null;
    for (let i = 0; i < 3 && !fresh; i++) {
      const x = await load(); const p = x && x.prizes.find((y) => y.id === pid);
      if (p && p.stok > p.won && x.eligible > 0) fresh = x; else await new Promise((t) => setTimeout(t, 400));
    }
    if (!fresh) { lock.current = false; setRun(false); return setErr('Stok hadiah belum terbarui atau tidak ada peserta tersisa. Coba putar lagi sebentar lagi.'); }
    setPrize(String(pid));           // dropdown kembali ke hadiah yang diundi ulang
    setTimeout(() => spin(pid), 300);
  };
  useEffect(() => {
    const k = (e) => { if (e.code === 'Space' && !win && !e.target.matches?.('select,input,button')) { e.preventDefault(); spin(); } };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  });
  const pieces = useMemo(() => Array.from({ length: 60 }, (_, i) => ({ left: Math.random() * 100 + '%', background: COLORS[i % 5], animationDuration: 2 + Math.random() * 2.5 + 's', animationDelay: Math.random() * 0.8 + 's' })), [boom]);
  const full = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.());

  if (!d) return <div className="stage" role="status" aria-busy="true" aria-label="Memuat"><div><span className="sk" style={{ width: 'min(82vh,760px)', maxWidth: '100%', aspectRatio: '1/1', height: 'auto', borderRadius: '50%', margin: '0 auto' }} /></div><div>{lerr && <p className="err">{lerr}</p>}<div className="card"><span className="sk" style={{ width: '50%', height: 16 }} /><span className="sk" style={{ height: 44, marginTop: 12 }} /><span className="sk" style={{ height: 44, marginTop: 8 }} /><span className="sk" style={{ height: 60, marginTop: 12 }} /></div></div></div>;
  const cur = d.prizes.find((x) => String(x.id) === String(prize));
  const sisa = cur ? cur.stok - cur.won : 0;
  const sorted = [...d.prizes].sort((a, b) => (a.stok - a.won < 1) - (b.stok - b.won < 1));

  return (
    <div className="stage">
      <aside className="card stage-list" aria-label="Peserta yang akan diundi">
        <div className="row"><h2 style={{ margin: 0 }}>Peserta diundi</h2><span className="chip" aria-label="Jumlah peserta">{ppl ? ppl.list.length + (ppl.truncated ? '+' : '') : '...'}</span></div>
        <p className="mute" style={{ margin: '4px 0 8px' }}>{cur ? 'Untuk hadiah ' + cur.nama : 'Semua hadiah sudah habis'}</p>
        {!ppl ? <span className="sk" style={{ height: 120 }} /> : ppl.list.length === 0 ? <div className="empty">Tidak ada peserta yang tersisa.</div> : <ol className="sl">{pplList}</ol>}
      </aside>

      <div>
        <div className="wheel-box">
          <div className="pointer" />
          <canvas ref={cv} width={SIZE} height={SIZE} role="img" aria-label="Roda undian" />
        </div>
      </div>

      <div>
        <div className="card pzcard">
          <label className="lbl" htmlFor="pz" style={{ marginTop: 0 }}>Hadiah yang diundi</label>
          {d.prizes.length === 0
            ? <p>Belum ada hadiah. <a href="/admin/hadiah">Tambah hadiah</a></p>
            : (
              <PrizePick prizes={sorted} value={prize} onChange={setPrize} disabled={run} />
            )}
          <button className="btn block" style={{ fontSize: 24, padding: '14px 16px', marginTop: 8 }} disabled={run || !prize || sisa < 1 || d.eligible < 1} onClick={spin}>{run ? 'Roda berputar...' : 'Putar roda'}</button>
          {d.prizes.length > 0 && !prize && <div className="err">Semua hadiah sudah habis diundi.</div>}
          {d.eligible < 1 && <div className="err">Tidak ada peserta yang tersisa.</div>}
          {err && !(d.eligible < 1 && /tersisa/i.test(err)) && <div className="err">{err}</div>}
          <p className="mute">Peserta yang ikut: {d.eligible} (sudah check-in dan jatah hadiahnya belum penuh). Tekan Spasi untuk memutar.</p>
        </div>
        <div className="card"><h2>Pemenang terakhir</h2>
          {d.recent.length === 0 && <div className="empty">Belum ada pemenang.</div>}
          <div className="recent-list">{d.recent.map((x) => {
            const no = x.status === 'forfeited';
            return (
              <div key={x.id} className={'wrow ' + (no ? 'no' : 'ok')}>
                <div className="row"><b className={no ? 'cut' : ''}>{x.employees?.nama}</b><span className={'chip' + (no ? ' no' : '')}>{no ? 'Tidak hadir' : 'Menang'}</span></div>
                <div className="mute">{x.prizes?.nama}</div>
              </div>);
          })}</div>
        </div>
        <div className="gap">
          <a className="btn sm w" href="/admin">Dashboard</a>
          <button className="btn sm w" onClick={full}>Layar penuh</button>
          <button className="btn sm w" onClick={() => { const m = !mute; sfx.setMuted(m); setMute(m); if (!m) sfx.tick(); }}>{mute ? 'Suara mati' : 'Suara hidup'}</button>
        </div>
      </div>

      {note && <div className="toast-stage" role="alert" onClick={() => setNote('')}>{note}</div>}

      {boom && <div className="confetti" aria-hidden="true">{pieces.map((st, i) => <i key={i} style={st} />)}</div>}

      {win && (
        <div className="pop">
          <div className="pop-box yellow" role="dialog" aria-modal="true" aria-label="Pemenang">
            <div>Pemenang {win.prize_nama || cur?.nama}</div>
            <div className="win-name">{win.nama}</div>
            <div>NIK {win.nik}{unit(win) ? ' · ' + unit(win) : ''}</div>
            <div className="gap" style={{ justifyContent: 'center', marginTop: 18 }}>
              <button className="btn g" onClick={() => setWin(null)}>Selesai</button>
              <button className="btn w" onClick={forfeit}>Tidak hadir, undi ulang</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
