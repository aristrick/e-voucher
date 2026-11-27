'use client';
import { useLoad, useAct, Loading, Busy, Title, useUI } from '../ui';

// Saklar: nama peserta tampil lengkap atau disensor (A*** S*******) saat peserta mengetik NIK di halaman depan.
export default function CekNik() {
  const { ask } = useUI();
  const { data: d, err, reload, loading } = useLoad({ action: 'nameVisible' });
  const { run } = useAct(() => reload(true));

  const toggle = async () => {
    const show = !d.visible;
    const ok = await ask(show
      ? 'Siapa pun yang mengetik NIK di halaman depan akan melihat nama lengkap pemilik NIK itu, sebelum login.'
      : 'Nama peserta akan disensor saat cek NIK, contoh: A*** S*******. Hanya huruf pertama tiap kata yang terlihat.',
    { title: show ? 'Tampilkan nama lengkap?' : 'Sensor nama?', okText: show ? 'Ya, tampilkan' : 'Ya, sensor', danger: false });
    if (ok) run({ action: 'setNameVisible', show }, show ? 'Nama lengkap ditampilkan saat cek NIK' : 'Nama disensor saat cek NIK');
  };

  return (
    <>
      <Busy on={loading && !!d} />
      <Title>Cek NIK</Title>
      {!d ? <Loading err={err} cols={2} rows={3} /> : <>
        {err && <div className="err">{err}</div>}
        <div className="card">
          <div className="row">
            <div><h2 style={{ margin: 0 }}>Nama saat cek NIK</h2><span className={'chip' + (d.visible ? '' : ' off')}>{d.visible ? 'Nama lengkap' : 'Disensor'}</span></div>
            <button className={'btn ' + (d.visible ? 'r' : 'g')} onClick={toggle}>{d.visible ? 'Sensor nama' : 'Tampilkan nama lengkap'}</button>
          </div>
          <p className="mute" style={{ marginBottom: 0 }}>{d.visible
            ? 'Di halaman depan, setelah peserta mengetik NIK, tampil "Atas nama" beserta nama lengkap. Nyalakan sensor kalau khawatir ada yang menebak NIK untuk melihat nama karyawan lain.'
            : 'Di halaman depan, setelah peserta mengetik NIK, nama tampil tersensor (hanya huruf pertama tiap kata). Peserta tetap bisa masuk seperti biasa.'}</p>
        </div>
      </>}
    </>
  );
}
