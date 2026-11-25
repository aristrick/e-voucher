'use client';
import { useEffect, useState } from 'react';
import { useLoad, useAct, Modal, Pager, Loading, Title } from '../ui';
import { adm, fmtFull } from '@/lib/client';

const FILTERS = [['', 'Semua'], ['hadir', 'Sudah check-in'], ['belum', 'Belum check-in'], ['nonaktif', 'Belum aktivasi']];
const SIZE = 20;
const EMPTY = { id: null, nik: '', nama: '', cabang: '', max_hadiah: '' };

export default function Peserta() {
  const [q, setQ] = useState(''), [qq, setQq] = useState(''), [status, setStatus] = useState(''), [page, setPage] = useState(1);
  const [imp, setImp] = useState(false), [rows, setRows] = useState([]), [fname, setFname] = useState(''), [ferr, setFerr] = useState('');
  const [form, setForm] = useState(null), [busy, setBusy] = useState(false);
  useEffect(() => { const t = setTimeout(() => { setQq(q); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);
  const { data: d, err, reload } = useLoad({ action: 'employees', q: qq, status, page, size: SIZE });
  const { run, Msg, setMsg } = useAct(() => reload(true));

  const closeImp = () => { setImp(false); setRows([]); setFname(''); setFerr(''); };
  const onFile = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    setFerr(''); setRows([]); setFname(f.name);
    try { const { readPeserta } = await import('@/lib/excel'); setRows(await readPeserta(f)); } catch (x) { setFerr(x.message); }
  };
  const doImport = async () => {
    const r = await run({ action: 'import', rows });
    if (r.ok) { setMsg({ ok: true, t: `${r.imported} peserta diimpor` + (r.skipped ? `, ${r.skipped} baris dilewati (NIK atau nama kosong/tidak valid)` : '') + (r.duplicates ? `, ${r.duplicates} NIK ganda digabung` : '') }); closeImp(); setPage(1); }
  };
  const doExport = async () => {
    setBusy(true);
    const r = await adm({ action: 'exportEmployees' });
    if (!r.ok) { setBusy(false); return setMsg({ ok: false, t: r.error }); }
    try { const { exportPeserta } = await import('@/lib/excel'); await exportPeserta(r); } catch { setMsg({ ok: false, t: 'Gagal membuat file Excel' }); }
    setBusy(false);
  };
  const template = async () => { const { downloadTemplate } = await import('@/lib/excel'); downloadTemplate(); };

  const saveForm = async () => {
    const body = { action: form.id ? 'updateEmployee' : 'addEmployee', ...form };
    const r = await run(body, form.id ? 'Data peserta diperbarui' : 'Peserta ditambahkan');
    if (r.ok) { setForm(null); if (!form.id) { setPage(1); setQ(''); } }
  };
  const fset = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <Title right={<><button className="btn sm w" disabled={busy} onClick={doExport}>{busy ? 'Menyiapkan...' : 'Ekspor Excel'}</button><button className="btn sm w" onClick={() => setImp(true)}>Import Excel</button><button className="btn" onClick={() => { setMsg(null); setForm({ ...EMPTY }); }}>Tambah peserta</button></>}>Peserta</Title>
      <Msg />
      <div className="card">
        <input aria-label="Cari peserta" placeholder="Cari nama, NIK, atau cabang" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="gap" style={{ marginTop: 6 }}>
          {FILTERS.map(([v, l]) => <button key={v} className={'btn sm ' + (status === v ? 'sel' : 'w')} onClick={() => { setStatus(v); setPage(1); }}>{l}</button>)}
        </div>
      </div>
      {!d ? <Loading err={err} /> : <>
        {err && <div className="err">{err}</div>}
        {d.rows.length === 0 ? <div className="card empty">{qq || status ? 'Tidak ada peserta yang cocok.' : 'Belum ada peserta. Klik Tambah peserta, atau Import Excel untuk banyak sekaligus.'}</div> : (
          <div className="tw"><table>
            <thead><tr><th>Nama</th><th>NIK</th><th>Cabang</th><th>Check-in</th><th>Kupon</th><th>Akun</th><th></th></tr></thead>
            <tbody>{d.rows.map((e) => (
              <tr key={e.id}>
                <td><b>{e.nama}</b>{e.max_hadiah ? <div className="mute">Jatah hadiah: {e.max_hadiah}</div> : null}</td><td>{e.nik}</td><td>{e.cabang || '-'}</td>
                <td>{e.checked_in_at
                  ? <><span className="chip">Sudah</span><div className="mute">{fmtFull(e.checked_in_at)}</div></>
                  : <span className="chip off">Belum</span>}</td>
                <td>{e.kupon.length === 0 ? <span className="mute">-</span> : e.kupon.map((k, i) => <div key={i}><b>{k.nama}</b><div className="mute">{fmtFull(k.at)}</div></div>)}</td>
                <td>{e.aktif ? <><span className="chip">Aktif</span><div className="mute">{e.hp || ''}</div></> : <span className="chip warn">Belum aktivasi</span>}</td>
                <td><span className="gap">
                  {!e.checked_in_at && <button className="btn sm g" onClick={() => confirm(`Check-in manual untuk ${e.nama}? Waktu check-in dicatat sekarang.`) && run({ action: 'checkinManual', nik: e.nik }, `${e.nama} berhasil check-in`)}>Check-in</button>}
                  <button className="btn sm y" onClick={() => { setMsg(null); setForm({ id: e.id, nik: e.nik, nama: e.nama, cabang: e.cabang || '', max_hadiah: e.max_hadiah || '' }); }}>Ubah</button>
                  {e.aktif && <button className="btn sm w" onClick={() => confirm(`Reset password ${e.nama}? Peserta perlu aktivasi ulang (isi nomor HP dan password baru).`) && run({ action: 'resetPeserta', nik: e.nik }, 'Password direset. Peserta bisa aktivasi ulang.')}>Reset</button>}
                  <button className="btn sm w" onClick={() => confirm(`Hapus ${e.nama}? Riwayat kupon dan undian peserta ini ikut terhapus.`) && run({ action: 'deleteEmployee', nik: e.nik }, 'Peserta dihapus')}>Hapus</button>
                </span></td>
              </tr>))}
            </tbody></table></div>
        )}
        <Pager page={d.page} size={d.size} total={d.total} onPage={setPage} />
      </>}

      {form && <Modal title={form.id ? 'Ubah peserta' : 'Tambah peserta'} onClose={() => setForm(null)}>
        <label className="lbl" htmlFor="f-nik">NIK</label><input id="f-nik" inputMode="numeric" placeholder="20190342" value={form.nik} onChange={fset('nik')} />
        <label className="lbl" htmlFor="f-nama">Nama</label><input id="f-nama" placeholder="Budi Santoso" value={form.nama} onChange={fset('nama')} />
        <label className="lbl" htmlFor="f-cab">Cabang (opsional)</label><input id="f-cab" placeholder="Jakarta Barat" value={form.cabang} onChange={fset('cabang')} />
        <label className="lbl" htmlFor="f-max">Jatah hadiah undian (opsional)</label>
        <input id="f-max" type="number" min="1" max="100" placeholder="Kosong = ikut pengaturan umum" value={form.max_hadiah} onChange={fset('max_hadiah')} />
        <p className="mute">Nomor HP tidak perlu diisi. Peserta mengisinya sendiri saat membuat password.</p>
        <Msg /><button className="btn block" onClick={saveForm}>{form.id ? 'Simpan perubahan' : 'Tambah peserta'}</button>
      </Modal>}

      {imp && <Modal title="Import peserta dari Excel" onClose={closeImp}>
        <p className="mute">Pilih file <b>.xlsx</b> dengan kolom <b>NIK, Nama, Cabang</b> (satu orang per baris, judul kolom di baris pertama). NIK yang sudah ada akan diperbarui.</p>
        <button className="btn sm w" onClick={template}>Unduh template Excel</button>
        <input type="file" accept=".xlsx" onChange={onFile} aria-label="Pilih file Excel" style={{ marginTop: 12 }} />
        {fname && !ferr && <div className="mute">{fname}</div>}
        {ferr && <div className="err">{ferr}</div>}
        {rows.length > 0 && <div className="tw" style={{ maxHeight: 180, overflow: 'auto' }}><table>
          <thead><tr><th>NIK</th><th>Nama</th><th>Cabang</th></tr></thead>
          <tbody>{rows.slice(0, 5).map((r, i) => <tr key={i}><td>{r.nik}</td><td>{r.nama}</td><td>{r.cabang}</td></tr>)}</tbody></table></div>}
        <div className="row"><span className="mute">{rows.length} baris siap diimpor</span>
          <button className="btn" disabled={!rows.length} onClick={doImport}>Import {rows.length || ''} peserta</button></div>
      </Modal>}
    </>
  );
}
