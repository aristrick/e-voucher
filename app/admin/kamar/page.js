'use client';
import { useEffect, useState } from 'react';
import { useLoad, useAct, Modal, Loading, Busy, Title, useUI } from '../ui';
import { adm, unit } from '@/lib/client';

const EMPTY = { id: null, nomor: '', nama: '', kapasitas: '', catatan: '' };

export default function Kamar() {
  const { ask } = useUI();
  const { data: d, err, reload, loading } = useLoad({ action: 'rooms' });
  const { run, setMsg } = useAct(() => reload(true));
  const [q, setQ] = useState(''), [form, setForm] = useState(null), [pid, setPid] = useState(null), [busy, setBusy] = useState(false);
  const [imp, setImp] = useState(false), [rows, setRows] = useState([]), [fname, setFname] = useState(''), [ferr, setFerr] = useState('');

  const toggle = async () => {
    const on = !d.enabled;
    const ok = await ask(on ? 'Peserta akan melihat nomor kamar, nama kamar, dan teman sekamar di tiket mereka. Peserta yang belum dibagi kamar melihat pesan "belum tersedia".' : 'Info kamar disembunyikan dari tiket peserta. Data pembagian kamar tetap tersimpan.',
      { title: on ? 'Aktifkan pembagian kamar?' : 'Nonaktifkan pembagian kamar?', okText: on ? 'Ya, aktifkan' : 'Ya, nonaktifkan', danger: false });
    if (ok) run({ action: 'setRoomEnabled', open: on }, on ? 'Pembagian kamar diaktifkan' : 'Pembagian kamar dinonaktifkan');
  };
  const fset = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const save = async () => {
    const r = await run({ action: form.id ? 'updateRoom' : 'addRoom', ...form }, form.id ? 'Kamar diperbarui' : 'Kamar ditambahkan');
    if (r.ok) setForm(null);
  };
  const del = async (r) => (await ask(r.penghuni.length ? `Hapus kamar ${r.nomor}? ${r.penghuni.length} penghuninya kembali menjadi belum dapat kamar.` : `Hapus kamar ${r.nomor}?`)) && run({ action: 'deleteRoom', id: r.id }, 'Kamar dihapus');

  const doExport = async () => {
    setBusy(true);
    try { const { exportKamar } = await import('@/lib/excel'); await exportKamar(d); } catch { setMsg({ ok: false, t: 'Gagal membuat file Excel' }); }
    setBusy(false);
  };
  const closeImp = () => { setImp(false); setRows([]); setFname(''); setFerr(''); };
  const onFile = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    setFerr(''); setRows([]); setFname(f.name);
    try { const { readKamar } = await import('@/lib/excel'); setRows(await readKamar(f)); } catch (x) { setFerr(x.message); }
  };
  const doImport = async () => {
    const r = await run({ action: 'importRooms', rows });
    if (!r.ok) return;
    const extra = [r.created && `${r.created} kamar baru dibuat`, r.notFound && `${r.notFound} NIK tidak ditemukan`, r.mismatch && `${r.mismatch} nama di Excel berbeda dari data peserta (periksa NIK-nya)`, r.full && `${r.full} gagal karena kamar penuh`, r.skipped && `${r.skipped} baris dilewati (NIK atau nomor kamar kosong)`, r.duplicates && `${r.duplicates} NIK ganda digabung`].filter(Boolean);
    setMsg({ ok: true, t: `${r.assigned} peserta dibagi ke kamar` + (extra.length ? `. ${extra.join(', ')}` : '') });
    closeImp();
  };
  const template = async () => { const { downloadTemplateKamar } = await import('@/lib/excel'); downloadTemplateKamar(); };

  const s = q.trim().toLowerCase();
  const list = !d ? [] : d.rooms.filter((r) => !s || [r.nomor, r.nama, r.catatan, ...r.penghuni.map((p) => p.nama)].some((x) => String(x || '').toLowerCase().includes(s)));

  return (
    <>
      <Busy on={loading && !!d} />
      <Title right={<>
        <button className="btn sm w" disabled={!d || busy || !d.assigned} onClick={doExport}>{busy ? 'Menyiapkan...' : 'Ekspor Excel'}</button>
        <button className="btn sm w" disabled={!d} onClick={() => setImp(true)}>Import Excel</button>
        <button className="btn" disabled={!d} onClick={() => setForm({ ...EMPTY })}>Tambah kamar</button>
      </>}>Kamar</Title>
      {!d ? <Loading err={err} cols={4} rows={6} /> : <>
        {err && <div className="err">{err}</div>}
        <div className="card">
          <div className="row">
            <div><h2 style={{ margin: 0 }}>Pembagian kamar</h2><span className={'chip' + (d.enabled ? '' : ' off')}>{d.enabled ? 'Aktif' : 'Nonaktif'}</span></div>
            <button className={'btn ' + (d.enabled ? 'r' : 'g')} onClick={toggle}>{d.enabled ? 'Nonaktifkan' : 'Aktifkan'}</button>
          </div>
          <p className="mute" style={{ marginBottom: 0 }}>{d.enabled
            ? 'Peserta melihat kartu Kamar di tiket mereka: nomor kamar, nama kamar, dan daftar teman sekamar.'
            : 'Belum tampil di tiket peserta. Aktifkan hanya untuk acara yang menginap (villa, resort, hotel). Atur daftar kamar dan penghuninya dulu, lalu aktifkan.'}</p>
        </div>

        <div className="stats">
          <div className="card purple"><div className="stat">{d.rooms.length}</div>Kamar</div>
          <div className="card ok"><div className="stat">{d.assigned}</div>Peserta sudah dapat kamar</div>
          <div className="card yellow"><div className="stat">{Math.max(d.total - d.assigned, 0)}</div>Peserta belum dapat kamar</div>
        </div>

        {d.rooms.length > 0 && <div className="card"><div className="toolbar"><input aria-label="Cari kamar atau penghuni" placeholder="Cari nomor kamar, nama kamar, atau nama penghuni" value={q} onChange={(e) => setQ(e.target.value)} /></div></div>}

        {d.rooms.length === 0 ? <div className="card empty">Belum ada kamar. Klik Tambah kamar, atau Import Excel untuk membuat kamar dan pembagian penghuni sekaligus.</div>
          : list.length === 0 ? <div className="card empty">Tidak ada kamar atau penghuni yang cocok.</div> : (
          <div className={'tw stick' + (loading ? ' busy' : '')}><table className="rt">
            <thead><tr><th>Kamar</th><th>Terisi</th><th>Penghuni</th><th className="act">Aksi</th></tr></thead>
            <tbody>{list.map((r) => {
              const n = r.penghuni.length, full = r.kapasitas && n >= r.kapasitas;
              return (
                <tr key={r.id}>
                  <td className="nm"><b>{r.nomor}</b>{r.nama && <span className="sub">{r.nama}</span>}{r.catatan && <span className="sub">{r.catatan}</span>}</td>
                  <td className="nw" data-label="Terisi"><span className={'chip' + (full ? ' warn' : n ? '' : ' off')}>{n}{r.kapasitas ? ' / ' + r.kapasitas : ''}</span></td>
                  <td data-label="Penghuni">{n === 0 ? <span className="dim">Belum ada penghuni</span> : <span className="kps">{r.penghuni.map((p) => <span className="kp" key={p.id}>{p.nama}</span>)}</span>}</td>
                  <td className="act"><span className="acts">
                    <button className="btn sm b" onClick={() => setPid(r.id)}>Atur penghuni</button>
                    <button className="btn sm y" onClick={() => setForm({ id: r.id, nomor: r.nomor, nama: r.nama || '', kapasitas: r.kapasitas || '', catatan: r.catatan || '' })}>Ubah</button>
                    <button className="btn sm r" onClick={() => del(r)}>Hapus</button>
                  </span></td>
                </tr>);
            })}</tbody></table></div>
        )}
      </>}

      {pid && d && d.rooms.some((r) => r.id === pid) && <Penghuni id={pid} d={d} run={run} onClose={() => setPid(null)} />}

      {form && <Modal title={form.id ? 'Ubah kamar' : 'Tambah kamar'} onClose={() => setForm(null)}>
        <div className="form2">
          <div><label className="lbl" htmlFor="k-no">Nomor kamar</label><input id="k-no" placeholder="101" value={form.nomor} onChange={fset('nomor')} /></div>
          <div><label className="lbl" htmlFor="k-nm">Nama kamar (opsional)</label><input id="k-nm" placeholder="Melati" value={form.nama} onChange={fset('nama')} /></div>
          <div><label className="lbl" htmlFor="k-kp">Kapasitas (opsional)</label><input id="k-kp" type="number" min="1" max="100" placeholder="Kosong = tanpa batas" value={form.kapasitas} onChange={fset('kapasitas')} /></div>
          <div><label className="lbl" htmlFor="k-ct">Keterangan (opsional)</label><input id="k-ct" placeholder="Lantai 2, Gedung B" value={form.catatan} onChange={fset('catatan')} /></div>
        </div>
        <p className="mute">Nomor kamar harus unik. Keterangan ikut tampil di tiket peserta.</p>
        <button className="btn block" onClick={save}>{form.id ? 'Simpan perubahan' : 'Tambah kamar'}</button>
      </Modal>}

      {imp && <Modal title="Import pembagian kamar dari Excel" onClose={closeImp}>
        <p className="mute">Pilih file <b>.xlsx</b> dengan kolom <b>NIK, Nama Peserta, Nomor Kamar, Nama Kamar</b> (satu peserta per baris, judul kolom di baris pertama). Kamar yang belum ada dibuat otomatis. Peserta yang sudah punya kamar dipindahkan ke kamar di file. Kapasitas kamar tetap dihormati.</p>
        <button className="btn sm w" onClick={template}>Unduh template Excel</button>
        <input type="file" accept=".xlsx" onChange={onFile} aria-label="Pilih file Excel" style={{ marginTop: 12 }} />
        {fname && !ferr && <div className="mute">{fname}</div>}
        {ferr && <div className="err">{ferr}</div>}
        {rows.length > 0 && <div className="tw" style={{ maxHeight: 180, overflow: 'auto' }}><table>
          <thead><tr><th>NIK</th><th>Nama Peserta</th><th>Nomor Kamar</th><th>Nama Kamar</th></tr></thead>
          <tbody>{rows.slice(0, 5).map((r, i) => <tr key={i}><td>{r.nik}</td><td>{r.peserta}</td><td>{r.nomor}</td><td>{r.nama}</td></tr>)}</tbody></table></div>}
        <div className="row"><span className="mute">{rows.length} baris siap diimpor</span>
          <button className="btn" disabled={!rows.length} onClick={doImport}>Import {rows.length || ''} baris</button></div>
      </Modal>}
    </>
  );
}

// Jendela atur penghuni: daftar penghuni sekarang (bisa dikeluarkan) dan pencarian peserta untuk dimasukkan
function Penghuni({ id, d, run, onClose }) {
  const { ask } = useUI();
  const room = d.rooms.find((r) => r.id === id);
  const nomorOf = Object.fromEntries(d.rooms.map((r) => [r.id, r.nomor]));
  const [q, setQ] = useState(''), [qq, setQq] = useState(''), [belum, setBelum] = useState(true), [c, setC] = useState(null);
  useEffect(() => { const t = setTimeout(() => setQq(q), 300); return () => clearTimeout(t); }, [q]);
  // d berganti setiap kali ada perubahan (masuk, keluar), jadi daftar calon ikut diperbarui
  useEffect(() => {
    let live = true;
    adm({ action: 'roomCandidates', q: qq, belum, room_id: id }).then((r) => { if (live) setC(r.ok ? r.rows : []); });
    return () => { live = false; };
  }, [qq, belum, id, d]);
  const n = room.penghuni.length, penuh = !!room.kapasitas && n >= room.kapasitas;
  const add = async (e) => {
    if (e.room_id && !(await ask(`Pindahkan ${e.nama} dari kamar ${nomorOf[e.room_id] || '?'} ke kamar ${room.nomor}?`, { title: 'Pindahkan peserta?', okText: 'Ya, pindahkan', danger: false }))) return;
    run({ action: 'assignRoom', room_id: id, employee_ids: [e.id], nama_peserta: e.nama }, `${e.nama} masuk kamar ${room.nomor}`);
  };
  const out = (p) => run({ action: 'unassignRoom', employee_ids: [p.id], nama_peserta: p.nama, nomor_kamar: room.nomor }, `${p.nama} dikeluarkan dari kamar ${room.nomor}`);
  return (
    <Modal title={'Kamar ' + room.nomor + (room.nama ? ' · ' + room.nama : '')} onClose={onClose}>
      <div className="row"><h3 style={{ margin: 0 }}>Penghuni</h3><span className={'chip' + (penuh ? ' warn' : n ? '' : ' off')}>{n}{room.kapasitas ? ' / ' + room.kapasitas : ''}</span></div>
      {n === 0 ? <div className="mute" style={{ margin: '8px 0' }}>Belum ada penghuni. Cari peserta di bawah lalu klik Masukkan.</div>
        : room.penghuni.map((p) => (
          <div className="row mate-row" key={p.id}>
            <span><b>{p.nama}</b><span className="sub">{[p.nik, unit(p)].filter(Boolean).join(' · ')}</span></span>
            <button className="btn sm r" onClick={() => out(p)}>Keluarkan</button>
          </div>))}
      <div className="cut" />
      <h3 style={{ margin: '0 0 6px' }}>Tambah penghuni</h3>
      {penuh && <div className="err">Kamar penuh. Naikkan kapasitas lewat tombol Ubah untuk menambah penghuni.</div>}
      <input aria-label="Cari peserta" placeholder="Cari nama, NIK, divisi, atau cabang" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="gap" style={{ margin: '4px 0 8px' }}>
        <button className={'btn sm ' + (belum ? 'sel' : 'w')} onClick={() => setBelum(true)}>Belum dapat kamar</button>
        <button className={'btn sm ' + (!belum ? 'sel' : 'w')} onClick={() => setBelum(false)}>Semua peserta</button>
      </div>
      {!c ? <div className="mute">Memuat...</div> : c.length === 0 ? <div className="mute">{qq || !belum ? 'Tidak ada peserta yang cocok.' : 'Semua peserta sudah dapat kamar.'}</div> : (
        <div className="mate-list">{c.map((e) => (
          <div className="row mate-row" key={e.id}>
            <span><b>{e.nama}</b><span className="sub">{[e.nik, unit(e)].filter(Boolean).join(' · ')}</span>{e.room_id && <span className="chip warn" style={{ marginTop: 4 }}>Kamar {nomorOf[e.room_id] || '?'}</span>}</span>
            <button className="btn sm g" disabled={penuh} onClick={() => add(e)}>{e.room_id ? 'Pindahkan' : 'Masukkan'}</button>
          </div>))}
        </div>)}
    </Modal>
  );
}
