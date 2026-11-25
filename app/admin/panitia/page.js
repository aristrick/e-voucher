'use client';
import { useState } from 'react';
import { useLoad, useAct, Modal, Loading, Title, useUI } from '../ui';
export default function Panitia() {
  const { ask } = useUI();
  const { data: d, err, reload } = useLoad({ action: 'staff' });
  const { run, Msg } = useAct(() => reload(true));
  const [add, setAdd] = useState(false), [f, setF] = useState({ username: '', nama: '', password: '' }), [rs, setRs] = useState(null), [pw, setPw] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const create = async () => { const r = await run({ action: 'addStaff', ...f }, 'Panitia ditambahkan'); if (r.ok) { setAdd(false); setF({ username: '', nama: '', password: '' }); } };
  const reset = async () => { const r = await run({ action: 'resetStaff', id: rs.id, password: pw }, 'Password panitia diganti'); if (r.ok) { setRs(null); setPw(''); } };
  return (
    <>
      <Title right={<button className="btn" onClick={() => setAdd(true)}>Tambah panitia</button>}>Panitia</Title>
      <Msg />
      {!d ? <Loading err={err} cols={4} rows={5} /> : d.staff.length === 0 ? <div className="card empty">Belum ada akun panitia. Klik Tambah panitia.</div> : (
        <div className="tw stick"><table className="rt">
          <thead><tr><th>Username</th><th>Nama</th><th>Status</th><th className="act">Aksi</th></tr></thead>
          <tbody>{d.staff.map((s) => (
            <tr key={s.id}><td className="nm"><b>{s.username}</b></td><td data-label="Nama">{s.nama || '-'}</td>
              <td data-label="Status"><span className={'chip' + (s.aktif ? '' : ' off')}>{s.aktif ? 'Aktif' : 'Nonaktif'}</span></td>
              <td className="act"><span className="acts">
                <button className="btn sm y" onClick={() => run({ action: 'toggleStaff', id: s.id, aktif: !s.aktif })}>{s.aktif ? 'Nonaktifkan' : 'Aktifkan'}</button>
                <button className="btn sm w" onClick={() => setRs(s)}>Ganti password</button>
                <button className="btn sm r" onClick={async () => (await ask(`Hapus akun ${s.username}?`)) && run({ action: 'deleteStaff', id: s.id }, 'Akun dihapus')}>Hapus</button>
              </span></td></tr>))}
          </tbody></table></div>
      )}
      <p className="mute">Panitia yang dinonaktifkan langsung tidak bisa scan (maksimal jeda 20 detik).</p>
      {add && <Modal title="Tambah panitia" onClose={() => setAdd(false)}>
        <label className="lbl" htmlFor="su">Username</label><input id="su" autoCapitalize="none" value={f.username} onChange={set('username')} />
        <label className="lbl" htmlFor="sn">Nama</label><input id="sn" value={f.nama} onChange={set('nama')} />
        <label className="lbl" htmlFor="sp">Password (min. 6 karakter)</label><input id="sp" type="password" value={f.password} onChange={set('password')} />
        <Msg /><button className="btn" onClick={create}>Simpan</button>
      </Modal>}
      {rs && <Modal title={'Ganti password ' + rs.username} onClose={() => setRs(null)}>
        <label className="lbl" htmlFor="np">Password baru (min. 6 karakter)</label><input id="np" type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
        <Msg /><button className="btn" onClick={reset}>Simpan password</button>
      </Modal>}
    </>
  );
}
