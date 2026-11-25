'use client';
import { useState } from 'react';
import { useLoad, useAct, Loading, Title } from '../ui';
export default function Kupon() {
  const { data: d, err, reload } = useLoad({ action: 'coupons' });
  const { run, Msg } = useAct(() => reload(true));
  const [nama, setNama] = useState('');
  const add = async () => { const r = await run({ action: 'addCoupon', nama }, 'Kupon ditambahkan'); if (r.ok) setNama(''); };
  return (
    <>
      <Title>Kupon</Title>
      <Msg />
      <div className="card"><h2>Tambah kupon</h2>
        <div className="gap" style={{ flexWrap: 'nowrap' }}>
          <input aria-label="Nama kupon" placeholder="Contoh: Makan siang" value={nama} onChange={(e) => setNama(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
          <button className="btn" onClick={add}>Tambah</button></div>
      </div>
      {!d ? <Loading err={err} /> : d.coupons.length === 0 ? <div className="card empty">Belum ada kupon.</div> : (
        <div className="tw"><table>
          <thead><tr><th>Kupon</th><th>Sudah ditukar</th><th></th></tr></thead>
          <tbody>{d.coupons.map((c) => (
            <tr key={c.id}><td><b>{c.nama}</b></td><td>{c.used}</td>
              <td><span className="gap">
                <button className="btn sm y" onClick={() => { const n = prompt('Nama kupon baru', c.nama); if (n && n.trim()) run({ action: 'renameCoupon', id: c.id, nama: n }, 'Nama kupon diubah'); }}>Ubah nama</button>
                <button className="btn sm w" onClick={() => confirm(c.used ? `Hapus kupon ${c.nama}? ${c.used} catatan penukaran ikut terhapus.` : `Hapus kupon ${c.nama}?`) && run({ action: 'deleteCoupon', id: c.id }, 'Kupon dihapus')}>Hapus</button>
              </span></td></tr>))}
          </tbody></table></div>
      )}
    </>
  );
}
