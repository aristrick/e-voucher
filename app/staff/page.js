'use client';
import { useEffect, useState } from 'react';
export default function Stage() {
  const [d, setD] = useState(null), [prize, setPrize] = useState(''), [show, setShow] = useState(null);
  const [final, setFinal] = useState(false), [err, setErr] = useState(''), [run, setRun] = useState(false);
  const call = async (b) => {
    try {
      const r = await fetch('/api/admin', { method: 'POST', body: JSON.stringify(b) });
      if (r.status === 401) { location.href = '/login'; return { ok: false, error: 'Login sebagai admin' }; }
      const j = await r.json().catch(() => ({ error: 'Server error ' + r.status }));
      return { ok: r.ok, ...j };
    } catch { return { ok: false, error: 'Koneksi bermasalah, coba lagi' }; }
  };
  const load = async () => {
    const j = await call({ action: 'overview' });
    if (!j.ok || !j.employees) return false;
    setD(j); setPrize((p) => p || j.prizes[0]?.id || ''); return true;
  };
  useEffect(() => {
    let alive = true;
    (async () => { while (alive) { if (await load()) break; await new Promise((r) => setTimeout(r, 3000)); } })();
    return () => { alive = false; };
  }, []);
  const spin = async () => {
    if (run) return;
    setErr(''); setFinal(false); setRun(true);
    const won = new Set(d.draws.map((x) => x.employees.nik));
    const names = d.employees.filter((e) => e.checked_in_at && !won.has(e.nik));
    const j = await call({ action: 'draw', prize_id: Number(prize) });
    if (!j.ok) { setRun(false); return setErr(j.error); }
    const w = j.data[0]; let i = 0, delay = 50;
    const tick = () => {
      if (i++ > 35) { setShow({ nama: w.w_nama, nik: w.w_nik }); setFinal(true); setRun(false); load(); return; }
      setShow(names[Math.floor(Math.random() * names.length)]); delay += i * 3; setTimeout(tick, delay);
    };
    tick();
  };
  const forfeit = async (id) => { await call({ action: 'forfeit', draw_id: id }); setShow(null); setFinal(false); load(); };
  if (!d) return <div className="wrap">Memuat...</div>;
  return (
    <div className="wrap wide">
      <div className="row" style={{ marginBottom: 16 }}>
        <select style={{ maxWidth: 360 }} value={prize} onChange={(e) => setPrize(e.target.value)}>
          {d.prizes.map((p) => <option key={p.id} value={p.id}>{p.nama} (stok {p.stok})</option>)}</select>
        <button className="btn" style={{ fontSize: 24 }} onClick={spin}>{run ? 'Mengacak...' : 'Undi!'}</button>
      </div>
      {err && <div className="card bad">{err}</div>}
      <div className={'card big ' + (final ? 'yellow' : 'purple')}>
        <div>{show ? show.nama : 'Siapa yang beruntung?'}</div>
        {show && <div style={{ fontSize: '0.45em' }}>NIK {show.nik}</div>}
      </div>
      <div className="card"><h2>Pemenang</h2>
        {d.draws.map((x) => (
          <div className="row" key={x.id} style={{ margin: '6px 0' }}>
            <span style={{ textDecoration: x.status === 'forfeited' ? 'line-through' : 'none' }}>{x.employees.nama} ({x.employees.nik}) - {x.prizes.nama}</span>
            {x.status !== 'forfeited' && <button className="btn y" style={{ padding: '2px 8px', boxShadow: 'none' }} onClick={() => forfeit(x.id)}>Tidak hadir, undi ulang</button>}
          </div>))}
      </div>
    </div>
  );
}