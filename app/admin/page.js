'use client';
import { useEffect, useState } from 'react';
export default function Admin() {
  const [d, setD] = useState(null), [csv, setCsv] = useState(''), [msg, setMsg] = useState('');
  const [sent, setSent] = useState({}), [pn, setPn] = useState(''), [ps, setPs] = useState(1), [cn, setCn] = useState('');
  const [su, setSu] = useState(''), [sm, setSm] = useState(''), [sp, setSp] = useState(''), [rn, setRn] = useState('');
  useEffect(() => { try { setSent(JSON.parse(localStorage.getItem('sent') || '{}')); } catch {} load(); }, []);
  const call = async (body) => {
    const r = await fetch('/api/admin', { method: 'POST', body: JSON.stringify(body) });
    if (r.status === 401) { location.href = '/login'; return {}; }
    const j = await r.json(); setMsg(r.ok ? '' : j.error); return j;
  };
  const load = async () => { const j = await call({ action: 'overview' }); if (j.employees) setD(j); };
  const imp = async () => {
    const rows = csv.split('\n').map((l) => l.split(/[,;\t]/).map((s) => s.trim())).filter((r) => r[0] && r[0].toLowerCase() !== 'nik')
      .map(([nik, nama, cabang, hp]) => ({ nik, nama, cabang, hp }));
    const j = await call({ action: 'import', rows }); if (!j.error) setMsg(rows.length + ' karyawan diimpor'); load();
  };
  const wa = (e) => `https://wa.me/${(e.hp || '').replace(/\D/g, '').replace(/^0/, '62')}?text=${encodeURIComponent(`Halo ${e.nama}, tiket gathering kamu ada di ${location.origin}. Aktivasi akun dengan NIK ${e.nik} dan 4 digit terakhir nomor HP kamu.`)}`;
  const mark = (nik) => { const n = { ...sent, [nik]: 1 }; setSent(n); localStorage.setItem('sent', JSON.stringify(n)); };
  const out = async () => { await fetch('/api/auth', { method: 'POST', body: JSON.stringify({ action: 'logout' }) }); location.href = '/login'; };
  if (!d) return <div className="wrap">Memuat...{msg && <p>{msg}</p>}</div>;
  const hadir = d.employees.filter((e) => e.checked_in_at).length;
  return (
    <div className="wrap wide">
      <div className="row"><h1>Dashboard</h1>
        <span className="row"><a className="btn b" href="/stage">Layar undian</a><a className="btn b" href="/staff">Scan</a><button className="btn y" onClick={out}>Keluar</button></span></div>
      {msg && <div className="card yellow">{msg}</div>}
      <div className="grid" style={{ marginBottom: 16 }}>
        <div className="card purple"><h2>{d.employees.length}</h2>Karyawan</div>
        <div className="card ok"><h2>{hadir}</h2>Hadir</div>
        {d.coupons.map((c) => <div className="card" key={c.id}><h2>{d.redemptions.filter((r) => r.coupon_type_id === c.id).length}</h2>{c.nama} ditukar</div>)}
        <div className="card yellow"><h2>{d.draws.filter((x) => x.status !== 'forfeited').length}</h2>Pemenang</div>
      </div>
      <div className="card"><h2>Import karyawan</h2>
        <p>Satu baris satu orang: nik, nama, cabang, no hp</p>
        <textarea rows={5} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={'20190342, Budi Santoso, Jakarta Barat, 081234567890'} />
        <button className="btn" onClick={imp}>Import</button></div>
      <div className="grid">
        <div className="card"><h2>Panitia</h2>
          {d.staff.map((s) => <div className="row" key={s.id} style={{ margin: '6px 0' }}><span>{s.username}{s.nama ? ` (${s.nama})` : ''}</span>
            <button className="btn y" style={{ padding: '2px 8px', boxShadow: 'none' }} onClick={async () => { await call({ action: 'toggleStaff', id: s.id, aktif: !s.aktif }); load(); }}>{s.aktif ? 'Nonaktifkan' : 'Aktifkan'}</button></div>)}
          <input placeholder="Username" autoCapitalize="none" value={su} onChange={(e) => setSu(e.target.value)} />
          <input placeholder="Nama" value={sm} onChange={(e) => setSm(e.target.value)} />
          <input type="password" placeholder="Password (min. 6)" value={sp} onChange={(e) => setSp(e.target.value)} />
          <button className="btn y" onClick={async () => { const j = await call({ action: 'addStaff', username: su, nama: sm, password: sp }); if (!j.error) { setSu(''); setSm(''); setSp(''); } load(); }}>Tambah panitia</button></div>
        <div className="card"><h2>Reset password peserta</h2>
          <input placeholder="NIK peserta" value={rn} onChange={(e) => setRn(e.target.value)} />
          <button className="btn y" onClick={async () => { const j = await call({ action: 'resetPeserta', nik: rn }); if (!j.error) { setMsg('Password direset. Peserta bisa aktivasi ulang.'); setRn(''); } }}>Reset</button></div>
        <div className="card"><h2>Kupon</h2>{d.coupons.map((c) => <div key={c.id}>{c.nama}</div>)}
          <input placeholder="Nama kupon baru" value={cn} onChange={(e) => setCn(e.target.value)} />
          <button className="btn y" onClick={async () => { await call({ action: 'addCoupon', nama: cn }); setCn(''); load(); }}>Tambah</button></div>
        <div className="card"><h2>Hadiah</h2>{d.prizes.map((p) => <div key={p.id}>{p.nama} (stok {p.stok})</div>)}
          <input placeholder="Nama hadiah" value={pn} onChange={(e) => setPn(e.target.value)} />
          <input type="number" min="1" value={ps} onChange={(e) => setPs(e.target.value)} />
          <button className="btn y" onClick={async () => { await call({ action: 'addPrize', nama: pn, stok: ps }); setPn(''); load(); }}>Tambah</button></div>
      </div>
      <div className="card"><div className="row"><h2>Kirim info akun (WhatsApp)</h2><button className="btn b" onClick={load}>Refresh</button></div>
        <table><tbody>{d.employees.map((e) => (
          <tr key={e.nik}><td>{e.nama}</td><td>{e.nik}</td><td>{e.checked_in_at ? 'Hadir' : '-'}</td>
            <td>{e.hp ? <a className="btn" style={{ padding: '2px 8px', boxShadow: 'none', background: sent[e.nik] ? '#ddd' : undefined }} target="_blank" rel="noreferrer" href={wa(e)} onClick={() => mark(e.nik)}>{sent[e.nik] ? 'Terkirim' : 'Kirim'}</a> : 'HP kosong'}</td></tr>
        ))}</tbody></table></div>
    </div>
  );
}
