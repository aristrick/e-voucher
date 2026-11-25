'use client';
import { useEffect, useState } from 'react';
import { useLoad, useAct, Modal, Pager, Loading, Busy, Title, useUI } from '../ui';
import { adm, fmtFull, fmtDateTime, fmtTime } from '@/lib/client';

const FILTERS = [['', 'Semua'], ['hadir', 'Sudah check-in'], ['belum', 'Belum check-in'], ['nonaktif', 'Belum aktivasi']];
const SIZE = 50;
const EMPTY = { id: null, nik: '', nama: '', divisi: '', cabang: '', max_hadiah: '' };

export default function Peserta() {
  const { ask, askText } = useUI();
  const [q, setQ] = useState(''), [qq, setQq] = useState(''), [status, setStatus] = useState(''), [page, setPage] = useState(1);
  const [imp, setImp] = useState(false), [rows, setRows] = useState([]), [fname, setFname] = useState(''), [ferr, setFerr] = useState('');
  const [form, setForm] = useState(null), [busy, setBusy] = useState(false), [rs, setRs] = useState(null);
  useEffect(() => { const t = setTimeout(() => { setQq(q); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);
  const { data: d, err, reload, loading } = useLoad({ action: 'employees', q: qq, status, page, size: SIZE });
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
  const delAll = async () => {
    const t = await askText(`Ini menghapus SEMUA peserta${d?.total ? ` (${d.total} orang)` : ''} beserta riwayat kupon dan undian mereka. Tidak bisa dibatalkan. Sebaiknya ekspor Excel dulu. Ketik HAPUS untuk melanjutkan.`, { title: 'Hapus semua peserta?', okText: 'Hapus semua', danger: true });
    if (t == null) return;
    if (t.trim() !== 'HAPUS') return setMsg({ ok: false, t: 'Dibatalkan: kata konfirmasi harus HAPUS' });
    const r = await run({ action: 'deleteAllEmployees', confirm: 'HAPUS' });
    if (r.ok) { setMsg({ ok: true, t: `${r.removed} peserta dihapus` }); setPage(1); setQ(''); }
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
      <Busy on={loading && !!d} />
      <Title right={<><button className="btn sm w" disabled={busy} onClick={doExport}>{busy ? 'Menyiapkan...' : 'Ekspor Excel'}</button><button className="btn sm w" onClick={() => setImp(true)}>Import Excel</button><button className="btn sm r" disabled={!d?.total} onClick={delAll}>Hapus semua</button><button className="btn" onClick={() => { setMsg(null); setForm({ ...EMPTY }); }}>Tambah peserta</button></>}>Peserta</Title>
      <Msg />
      <div className="card">
        <div className="toolbar">
          <input aria-label="Cari peserta" placeholder="Cari nama, NIK, divisi, atau cabang" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="filters">
            {FILTERS.map(([v, l]) => <button key={v} className={'btn sm ' + (status === v ? 'sel' : 'w')} onClick={() => { setStatus(v); setPage(1); }}>{l}</button>)}
          </div>
        </div>
      </div>
      {!d ? <Loading err={err} cols={8} rows={10} /> : <>
        {err && <div className="err">{err}</div>}
        {d.rows.length === 0 ? <div className="card empty">{qq || status ? 'Tidak ada peserta yang cocok.' : 'Belum ada peserta. Klik Tambah peserta, atau Import Excel untuk banyak sekaligus.'}</div> : (
          <div className={'tw stick' + (loading ? ' busy' : '')}><table className="rt">
            <thead><tr><th>Nama</th><th>NIK</th><th>Divisi</th><th>Cabang</th><th>Check-in</th><th>Kupon</th><th>Akun</th><th className="act">Aksi</th></tr></thead>
            <tbody>{d.rows.map((e) => (
              <tr key={e.id}>
                <td className="nm"><b>{e.nama}</b>{e.max_hadiah ? <span className="sub">Jatah hadiah: {e.max_hadiah}</span> : null}</td>
                <td className="nw mono" data-label="NIK">{e.nik}</td>
                <td className="nw" data-label="Divisi">{e.divisi || '-'}</td>
                <td className="nw" data-label="Cabang">{e.cabang || '-'}</td>
                <td className="nw" data-label="Check-in">{e.checked_in_at
                  ? <span><span className="chip">Sudah</span><span className="sub" style={{ marginTop: 3 }}>{fmtDateTime(e.checked_in_at)}</span></span>
                  : <span className="chip off">Belum</span>}</td>
                <td data-label="Kupon">{e.kupon.length === 0 ? <span className="dim">-</span>
                  : <span className="kps">{e.kupon.map((k, i) => <span className="kp" key={i} title={fmtFull(k.at)}>{k.nama}<i>{fmtTime(k.at)}</i></span>)}</span>}</td>
                <td className="nw" data-label="Akun">{e.aktif
                  ? <span><span className="chip">Aktif</span>{e.hp ? <span className="sub mono" style={{ marginTop: 3 }}>{e.hp}</span> : null}</span>
                  : <span className="chip warn">Belum aktivasi</span>}</td>
                <td className="act"><span className="acts">
                  {!e.checked_in_at && <button className="btn sm g" onClick={async () => (await ask(`Check-in manual untuk ${e.nama}? Waktu check-in dicatat sekarang.`, { title: 'Check-in manual', okText: 'Check-in' })) && run({ action: 'checkinManual', nik: e.nik }, `${e.nama} berhasil check-in`)}>Check-in</button>}
                  <button className="btn sm y" onClick={() => { setMsg(null); setForm({ id: e.id, nik: e.nik, nama: e.nama, divisi: e.divisi || '', cabang: e.cabang || '', max_hadiah: e.max_hadiah || '' }); }}>Ubah</button>
                  {(e.aktif || e.kupon.length > 0 || e.undian.length > 0) && <button className="btn sm w" onClick={() => setRs(e)}>Reset</button>}
                  <button className="btn sm r" onClick={async () => (await ask(`Hapus ${e.nama}? Riwayat kupon dan undian peserta ini ikut terhapus.`)) && run({ action: 'deleteEmployee', nik: e.nik }, 'Peserta dihapus')}>Hapus</button>
                </span></td>
              </tr>))}
            </tbody></table></div>
        )}
        <Pager page={d.page} size={d.size} total={d.total} onPage={setPage} />
      </>}

      {rs && (() => {
        const e = d?.rows.find((x) => x.id === rs.id) || rs;   // data terbaru setelah tiap reset
        const done = (t) => run(t.body, t.ok);
        const resetKupon = async (k) => {
          const all = !k;
          if (await ask(all ? `Hapus semua catatan penukaran kupon ${e.nama} (${e.kupon.length} kupon)? Peserta bisa menukar kupon itu lagi.` : `Hapus catatan penukaran kupon ${k.nama} milik ${e.nama}? Peserta bisa menukarnya lagi.`, { title: all ? 'Reset semua kupon?' : 'Reset kupon?', danger: true, okText: 'Ya, reset' }))
            done({ body: { action: 'resetKupon', nik: e.nik, coupon_id: k?.id, kupon_nama: k?.nama }, ok: all ? 'Semua kupon direset' : `Kupon ${k.nama} direset` });
        };
        const resetUndian = async (u) => {
          const all = !u;
          if (await ask(all ? `Hapus semua catatan undian ${e.nama} (${e.undian.length} catatan)? Stok hadiah kembali dan peserta bisa diundi lagi.` : `Hapus catatan undian ${u.nama} milik ${e.nama}? Stok hadiah kembali dan peserta bisa diundi lagi.`, { title: all ? 'Reset semua undian?' : 'Reset undian?', danger: true, okText: 'Ya, reset' }))
            done({ body: { action: 'resetUndian', nik: e.nik, draw_id: u?.id, hadiah_nama: u?.nama }, ok: all ? 'Semua undian direset' : `Undian ${u.nama} direset` });
        };
        const resetAkun = async () => {
          if (await ask(`Reset password dan nomor HP ${e.nama}? Peserta perlu aktivasi ulang (isi nomor HP dan password baru).`, { title: 'Reset akun?', danger: true, okText: 'Ya, reset' }))
            done({ body: { action: 'resetPeserta', nik: e.nik }, ok: 'Password dan nomor HP direset. Peserta bisa aktivasi ulang.' });
        };
        return <Modal title={'Reset ' + e.nama} onClose={() => setRs(null)}>
          <p className="mute" style={{ marginTop: 0 }}>Pilih yang ingin direset. Aksi ini dicatat di History.</p>
          <h3 style={{ marginTop: 10 }}>Akun</h3>
          {e.aktif
            ? <button className="opt" onClick={resetAkun}><b>Reset password dan nomor HP</b><span>Peserta harus aktivasi ulang. Nomor HP saat ini: {e.hp || '-'}</span></button>
            : <div className="mute">Akun belum diaktivasi, tidak ada yang perlu direset.</div>}
          <h3 style={{ marginTop: 14 }}>Kupon</h3>
          {e.kupon.length === 0 ? <div className="mute">Belum ada kupon yang ditukar.</div> : <>
            {e.kupon.map((k) => <button key={k.id} className="opt" onClick={() => resetKupon(k)}><b>Reset kupon {k.nama}</b><span>Ditukar {fmtFull(k.at)}</span></button>)}
            {e.kupon.length > 1 && <button className="opt danger" onClick={() => resetKupon(null)}><b>Reset semua kupon ({e.kupon.length})</b><span>Semua catatan penukaran peserta ini dihapus</span></button>}
          </>}
          <h3 style={{ marginTop: 14 }}>Undian</h3>
          {e.undian.length === 0 ? <div className="mute">Belum pernah menang undian.</div> : <>
            {e.undian.map((u) => <button key={u.id} className="opt" onClick={() => resetUndian(u)}><b>Reset undian {u.nama}</b><span>{u.status === 'forfeited' ? 'Ditandai tidak hadir' : 'Menang'} · {fmtFull(u.at)}</span></button>)}
            {e.undian.length > 1 && <button className="opt danger" onClick={() => resetUndian(null)}><b>Reset semua undian ({e.undian.length})</b><span>Semua catatan undian peserta ini dihapus</span></button>}
          </>}
        </Modal>;
      })()}

      {form && <Modal title={form.id ? 'Ubah peserta' : 'Tambah peserta'} onClose={() => setForm(null)}>
        <div className="form2"><div><label className="lbl" htmlFor="f-nik">NIK</label><input id="f-nik" inputMode="numeric" placeholder="20190342" value={form.nik} onChange={fset('nik')} /></div>
        <div><label className="lbl" htmlFor="f-nama">Nama</label><input id="f-nama" placeholder="Budi Santoso" value={form.nama} onChange={fset('nama')} /></div>
        <div><label className="lbl" htmlFor="f-div">Divisi (opsional)</label><input id="f-div" placeholder="Sales" value={form.divisi} onChange={fset('divisi')} /></div>
        <div><label className="lbl" htmlFor="f-cab">Cabang (opsional)</label><input id="f-cab" placeholder="Jakarta Barat" value={form.cabang} onChange={fset('cabang')} /></div>
        <div><label className="lbl" htmlFor="f-max">Jatah hadiah undian (opsional)</label>
        <input id="f-max" type="number" min="1" max="100" placeholder="Kosong = ikut pengaturan umum" value={form.max_hadiah} onChange={fset('max_hadiah')} /></div></div>
        <p className="mute">Nomor HP tidak perlu diisi. Peserta mengisinya sendiri saat membuat password.</p>
        <Msg /><button className="btn block" onClick={saveForm}>{form.id ? 'Simpan perubahan' : 'Tambah peserta'}</button>
      </Modal>}

      {imp && <Modal title="Import peserta dari Excel" onClose={closeImp}>
        <p className="mute">Pilih file <b>.xlsx</b> dengan kolom <b>NIK, Nama, Divisi, Cabang</b> (satu orang per baris, judul kolom di baris pertama). NIK yang sudah ada akan diperbarui.</p>
        <button className="btn sm w" onClick={template}>Unduh template Excel</button>
        <input type="file" accept=".xlsx" onChange={onFile} aria-label="Pilih file Excel" style={{ marginTop: 12 }} />
        {fname && !ferr && <div className="mute">{fname}</div>}
        {ferr && <div className="err">{ferr}</div>}
        {rows.length > 0 && <div className="tw" style={{ maxHeight: 180, overflow: 'auto' }}><table>
          <thead><tr><th>NIK</th><th>Nama</th><th>Divisi</th><th>Cabang</th></tr></thead>
          <tbody>{rows.slice(0, 5).map((r, i) => <tr key={i}><td>{r.nik}</td><td>{r.nama}</td><td>{r.divisi}</td><td>{r.cabang}</td></tr>)}</tbody></table></div>}
        <div className="row"><span className="mute">{rows.length} baris siap diimpor</span>
          <button className="btn" disabled={!rows.length} onClick={doImport}>Import {rows.length || ''} peserta</button></div>
      </Modal>}
    </>
  );
}
