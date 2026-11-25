'use client';
import { useState } from 'react';
import { useLoad, useAct, Modal, Loading, Title } from '../ui';
export default function Hadiah() {
  const { data: d, err, reload } = useLoad({ action: 'prizes' });
  const { run, Msg } = useAct(() => reload(true));
  const [f, setF] = useState({ nama: '', stok: 1 }), [ed, setEd] = useState(null);
  const add = async () => { const r = await run({ action: 'addPrize', ...f }, 'Hadiah ditambahkan'); if (r.ok) setF({ nama: '', stok: 1 }); };
  const save = async () => { const r = await run({ action: 'updatePrize', ...ed }, 'Hadiah diperbarui'); if (r.ok) setEd(null); };
  return (
    <>
      <Title right={<a className="btn b" href="/stage" target="_blank" rel="noreferrer">Buka layar undian</a>}>Hadiah doorprize</Title>
      <Msg />
      <div className="card"><h2>Tambah hadiah</h2>
        <div className="row" style={{ alignItems: 'flex-end', flexWrap: 'nowrap' }}>
          <div style={{ flex: 1 }}><label className="lbl" htmlFor="pn">Nama hadiah</label><input id="pn" placeholder="Contoh: TV 43 inci" value={f.nama} onChange={(e) => setF({ ...f, nama: e.target.value })} /></div>
          <div style={{ width: 90 }}><label className="lbl" htmlFor="ps">Jumlah</label><input id="ps" type="number" min="1" value={f.stok} onChange={(e) => setF({ ...f, stok: e.target.value })} /></div>
          <button className="btn" onClick={add}>Tambah</button></div>
      </div>
      {!d ? <Loading err={err} /> : d.prizes.length === 0 ? <div className="card empty">Belum ada hadiah.</div> : (
        <div className="tw"><table>
          <thead><tr><th>Hadiah</th><th>Jumlah</th><th>Sudah diundi</th><th>Sisa</th><th></th></tr></thead>
          <tbody>{d.prizes.map((p) => (
            <tr key={p.id}><td><b>{p.nama}</b></td><td>{p.stok}</td><td>{p.won}</td>
              <td><span className={'chip' + (p.stok - p.won > 0 ? '' : ' no')}>{Math.max(p.stok - p.won, 0)}</span></td>
              <td><span className="gap">
                <button className="btn sm y" onClick={() => setEd({ id: p.id, nama: p.nama, stok: p.stok })}>Ubah</button>
                <button className="btn sm w" onClick={() => confirm(`Hapus hadiah ${p.nama}?` + (p.won ? ` ${p.won} pemenangnya ikut terhapus.` : '')) && run({ action: 'deletePrize', id: p.id }, 'Hadiah dihapus')}>Hapus</button>
              </span></td></tr>))}
          </tbody></table></div>
      )}
      {ed && <Modal title="Ubah hadiah" onClose={() => setEd(null)}>
        <label className="lbl" htmlFor="en">Nama hadiah</label><input id="en" value={ed.nama} onChange={(e) => setEd({ ...ed, nama: e.target.value })} />
        <label className="lbl" htmlFor="es">Jumlah</label><input id="es" type="number" min="1" value={ed.stok} onChange={(e) => setEd({ ...ed, stok: e.target.value })} />
        <Msg /><button className="btn" onClick={save}>Simpan</button>
      </Modal>}
    </>
  );
}
