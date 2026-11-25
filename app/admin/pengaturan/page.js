'use client';
import { useEffect, useState } from 'react';
import { useLoad, useAct, Loading, Title } from '../ui';
export default function Pengaturan() {
  const { data: d, err } = useLoad({ action: 'getSettings' });
  const { run, Msg } = useAct();
  const [s, setS] = useState(null);
  useEffect(() => { if (d && !s) setS(d.settings); }, [d, s]);
  if (!s) return <><Title>Pengaturan acara</Title><Loading err={err} kind="form" /></>;
  const set = (k) => (e) => setS({ ...s, [k]: e.target.value });
  return (
    <>
      <Title>Pengaturan acara</Title>
      <Msg />
      <div className="split wide">
        <div className="card"><h2>Info acara</h2><p className="mute">Tampil di halaman depan dan di e-tiket peserta.</p>
          <div className="form2">
            <div className="full"><label className="lbl" htmlFor="a">Nama acara</label><input id="a" value={s.event_name} onChange={set('event_name')} /></div>
            <div><label className="lbl" htmlFor="b">Tanggal dan jam</label><input id="b" placeholder="Sabtu, 14 Des 2026 · 18.00 WIB" value={s.event_date} onChange={set('event_date')} /></div>
            <div><label className="lbl" htmlFor="c">Lokasi</label><input id="c" placeholder="Ballroom Hotel Contoh, Jakarta" value={s.event_venue} onChange={set('event_venue')} /></div>
            <div className="full"><label className="lbl" htmlFor="e">Keterangan singkat</label><textarea id="e" rows={5} value={s.event_desc} onChange={set('event_desc')} /></div>
          </div>
        </div>
        <div className="card"><h2>Undian</h2>
          <label className="lbl" htmlFor="m">Jatah hadiah per karyawan saat undian</label>
          <input id="m" type="number" min="1" max="100" value={s.max_prizes_per_employee} onChange={set('max_prizes_per_employee')} style={{ maxWidth: 160 }} />
          <p className="mute">Berapa kali satu karyawan boleh menang. Jika dibiarkan 1, karyawan yang sudah dapat hadiah tidak ikut undian lagi. Jatah per orang bisa diubah khusus di halaman Peserta (Ubah).</p>
          <div className="cut" />
          <button className="btn" onClick={() => run({ action: 'saveSettings', settings: s }, 'Pengaturan disimpan')}>Simpan pengaturan</button>
        </div>
      </div>
    </>
  );
}
