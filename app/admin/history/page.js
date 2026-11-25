'use client';
import { useEffect, useState } from 'react';
import { useLoad, Pager, Loading, Busy, Title } from '../ui';
import { fmtDateTime, wib } from '@/lib/client';

const KAT = [['', 'Semua'], ['checkin', 'Check-in'], ['redeem', 'Redeem'], ['peserta', 'Peserta'], ['undian', 'Undian'], ['hadiah', 'Hadiah'], ['kupon', 'Kupon'], ['panitia', 'Panitia'], ['pengaturan', 'Pengaturan']];
const LABEL = Object.fromEntries(KAT.filter(([v]) => v));
const STATUS = [['', 'Semua hasil'], ['ok', 'Berhasil'], ['gagal', 'Gagal']];
const SIZE = 50;

export default function History() {
  const [q, setQ] = useState(''), [qq, setQq] = useState(''), [kat, setKat] = useState(''), [st, setSt] = useState(''), [page, setPage] = useState(1), [auto, setAuto] = useState(true);
  useEffect(() => { const t = setTimeout(() => { setQq(q); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);
  const { data: d, err, reload, loading } = useLoad({ action: 'history', q: qq, kategori: kat, status: st, page, size: SIZE }, auto && page === 1 ? 5000 : 0);

  // kelompokkan per tanggal supaya mudah dibaca
  const groups = [];
  (d?.rows || []).forEach((r) => {
    const tgl = wib(r.created_at).tgl;
    const g = groups[groups.length - 1];
    if (g && g.tgl === tgl) g.rows.push(r); else groups.push({ tgl, rows: [r] });
  });

  return (
    <>
      <Busy on={loading && !!d} />
      <Title right={<>
        <label className="live" style={{ cursor: 'pointer' }}><input type="checkbox" style={{ width: 'auto', margin: 0 }} checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Otomatis perbarui</label>
        <button className="btn sm b" onClick={() => reload()}>Segarkan</button></>}>History</Title>
      <div className="card">
        <div className="toolbar">
          <input aria-label="Cari riwayat" placeholder="Cari nama peserta, kupon, atau petugas" value={q} onChange={(e) => setQ(e.target.value)} />
          <select aria-label="Hasil" value={st} onChange={(e) => { setSt(e.target.value); setPage(1); }}>{STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </div>
        <div className="filters" style={{ marginTop: 10 }}>
          {KAT.map(([v, l]) => <button key={v} className={'btn sm ' + (kat === v ? 'sel' : 'w')} onClick={() => { setKat(v); setPage(1); }}>{l}</button>)}
        </div>
      </div>
      {err && <div className="err">{err}</div>}
      {!d ? <Loading err={err} cols={5} rows={12} /> : d.rows.length === 0 ? <div className="card empty">{qq || kat || st ? 'Tidak ada aktivitas yang cocok.' : 'Belum ada aktivitas tercatat. Aktivitas baru muncul di sini otomatis.'}</div> : (
        <div className={'tw stick' + (loading ? ' busy' : '')}><table className="rt">
          <thead><tr><th>Waktu</th><th>Kategori</th><th>Aktivitas</th><th>Oleh</th><th>Hasil</th></tr></thead>
          <tbody>{groups.map((g) => [
            <tr key={'h' + g.tgl} className="dayrow"><td colSpan={5}><b>{g.tgl}</b></td></tr>,
            ...g.rows.map((r) => (
              <tr key={r.id}>
                <td className="nw mono nolabel" data-label="Waktu">{wib(r.created_at).jam}</td>
                <td data-label="Kategori"><span className={'kat ' + r.kategori}>{LABEL[r.kategori] || r.kategori}</span></td>
                <td className="nm" style={{ minWidth: 280 }}>{r.ringkas}</td>
                <td className="nw" data-label="Oleh">{r.actor || '-'}{r.actor_role === 'staff' ? <span className="sub">Panitia</span> : null}</td>
                <td data-label="Hasil"><span className={'chip' + (r.ok ? '' : ' no')}>{r.ok ? 'Berhasil' : 'Gagal'}</span></td>
              </tr>)),
          ])}</tbody></table></div>
      )}
      {d && <Pager page={d.page} size={d.size} total={d.total} onPage={setPage} />}
      {d && <p className="mute">{d.last24} aktivitas dalam 24 jam terakhir. Waktu dalam WIB.</p>}
    </>
  );
}
