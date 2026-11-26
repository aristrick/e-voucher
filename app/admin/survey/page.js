'use client';
import { useState } from 'react';
import { useLoad, useAct, Modal, Loading, Title, useUI } from '../ui';
import { unit } from '@/lib/client';
import { exportSurvey } from '@/lib/excel';

const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const TIPE = { skala: 'Skala 1-5', teks: 'Jawaban teks', pilihan: 'Pilihan' };
const BLANK = { tipe: 'skala', teks: '', wajib: true, opsi: ['', ''], lainnya: false, label_min: '', label_maks: '' };
const answers = (d, q) => d.responses.map((r) => ({ v: r.jawaban?.[q.id], r })).filter((x) => x.v != null && String(x.v).trim() !== '');

const Row = ({ label, n, of }) => (
  <div style={{ margin: '8px 0' }}>
    <div className="row"><span>{label}</span><span>{n}</span></div>
    <div className="bar"><i style={{ width: pct(n, of) + '%' }} /></div>
  </div>
);

// Hasil satu pertanyaan: skala = rata-rata + sebaran, pilihan = jumlah per opsi, teks = daftar jawaban
function Hasil({ q, d }) {
  const xs = answers(d, q);
  return (
    <div className="card">
      <div className="row"><b>{q.teks}</b><span className="chip off">{xs.length} jawaban</span></div>
      {xs.length === 0 && <div className="mute" style={{ marginTop: 8 }}>Belum ada jawaban.</div>}
      {xs.length > 0 && q.tipe === 'skala' && (() => {
        const v = xs.map((x) => Number(x.v)).filter((x) => x >= 1 && x <= 5);
        return <>
          <div className="stat" style={{ margin: '8px 0 4px' }}>{v.length ? (v.reduce((s, x) => s + x, 0) / v.length).toFixed(2) : '-'}<span className="mute"> / 5</span></div>
          {[5, 4, 3, 2, 1].map((s) => <Row key={s} label={s + (s === 5 && q.label_maks ? ` (${q.label_maks})` : s === 1 && q.label_min ? ` (${q.label_min})` : '')} n={v.filter((x) => x === s).length} of={v.length} />)}
        </>;
      })()}
      {xs.length > 0 && q.tipe === 'pilihan' && (() => {
        const rest = xs.filter((x) => !q.opsi.includes(x.v));
        return <>
          {q.opsi.map((o) => <Row key={o} label={o} n={xs.filter((x) => x.v === o).length} of={xs.length} />)}
          {rest.length > 0 && <>
            <Row label="Lainnya / opsi lama" n={rest.length} of={xs.length} />
            <div className="mute">Jawaban lainnya: {[...new Set(rest.map((x) => x.v))].join(' · ')}</div>
          </>}
        </>;
      })()}
      {xs.length > 0 && q.tipe === 'teks' && (
        <ul className="feed" style={{ maxHeight: 360, overflowY: 'auto', marginTop: 6 }}>
          {xs.map((x, i) => <li key={i}><span className="who"><b style={{ fontWeight: 500 }}>{x.v}</b><span className="mute">{x.r.nama}{unit(x.r) ? ' · ' + unit(x.r) : ''}</span></span></li>)}
        </ul>
      )}
    </div>
  );
}

export default function Survey() {
  const { ask } = useUI();
  const { data: d, err, reload } = useLoad({ action: 'survey' });
  const { run } = useAct(() => reload(true));
  const [tab, setTab] = useState('hasil'), [ed, setEd] = useState(null);
  if (!d) return <><Title>Survey</Title><Loading err={err} kind="cards" /></>;

  const setOpsi = (fn) => setEd((e) => ({ ...e, opsi: fn(e.opsi) }));
  const save = async () => {
    const r = await run({ action: ed.id ? 'updateSurveyQuestion' : 'addSurveyQuestion', ...ed }, ed.id ? 'Pertanyaan diperbarui' : 'Pertanyaan ditambahkan');
    if (r.ok) setEd(null);
  };
  const toggle = async () => {
    const ok = await ask(d.open ? 'Peserta tidak bisa lagi mengisi atau mengubah jawaban.' : 'Peserta akan melihat tombol Isi survey di tiket mereka.', { title: d.open ? 'Tutup survey?' : 'Buka survey?', okText: d.open ? 'Ya, tutup' : 'Ya, buka', danger: false });
    if (ok) run({ action: 'setSurveyOpen', open: !d.open }, d.open ? 'Survey ditutup' : 'Survey dibuka');
  };
  const edit = (q) => setEd({ id: q.id, tipe: q.tipe, teks: q.teks, wajib: q.wajib, opsi: q.opsi.length ? q.opsi : ['', ''], lainnya: q.lainnya, label_min: q.label_min || '', label_maks: q.label_maks || '' });

  return (
    <>
      <Title right={<><button className="btn sm b" onClick={() => reload()}>Segarkan</button>{tab === 'hasil' && <button className="btn sm g" disabled={!d.responses.length} onClick={() => exportSurvey(d)}>Ekspor Excel</button>}</>}>Survey</Title>
      {err && <div className="err">{err}</div>}
      <div className="card">
        <div className="row">
          <div><h2 style={{ margin: 0 }}>Status survey</h2><span className={'chip' + (d.open ? '' : ' off')}>{d.open ? 'Dibuka' : 'Ditutup'}</span></div>
          <button className={'btn ' + (d.open ? 'r' : 'g')} onClick={toggle}>{d.open ? 'Tutup survey' : 'Buka survey'}</button>
        </div>
        <div className="cut" />
        <div className="row"><span>Sudah mengisi</span><b>{d.responses.length} / {d.total} peserta ({pct(d.responses.length, d.total)}%)</b></div>
        <div className="bar"><i style={{ width: pct(d.responses.length, d.total) + '%' }} /></div>
        {!d.open && <p className="mute" style={{ marginBottom: 0 }}>Survey belum terlihat oleh peserta. Buka setelah acara selesai supaya peserta bisa mengisi lewat tiket mereka.</p>}
      </div>

      <div className="filters" style={{ marginBottom: 16 }}>
        <button className={'btn sm ' + (tab === 'hasil' ? 'sel' : 'w')} onClick={() => setTab('hasil')}>Hasil</button>
        <button className={'btn sm ' + (tab === 'tanya' ? 'sel' : 'w')} onClick={() => setTab('tanya')}>Pertanyaan ({d.questions.length})</button>
      </div>

      {tab === 'hasil' && (d.questions.length === 0 ? <div className="card empty">Belum ada pertanyaan.</div> : d.questions.map((q) => <Hasil key={q.id} q={q} d={d} />))}

      {tab === 'tanya' && <>
        <div style={{ marginBottom: 16 }}><button className="btn" onClick={() => setEd({ ...BLANK })}>Tambah pertanyaan</button></div>
        {d.questions.length === 0 && <div className="card empty">Belum ada pertanyaan.</div>}
        {d.questions.map((q, i) => (
          <div className="card" key={q.id}>
            <div className="row"><b>{i + 1}. {q.teks}</b><span className="gap"><span className="chip off">{TIPE[q.tipe]}</span>{q.wajib && <span className="chip warn">Wajib</span>}</span></div>
            {q.tipe === 'pilihan' && <div className="mute" style={{ marginTop: 6 }}>{q.opsi.join(' · ')}{q.lainnya ? ' · Lainnya (diketik sendiri)' : ''}</div>}
            {q.tipe === 'skala' && (q.label_min || q.label_maks) && <div className="mute" style={{ marginTop: 6 }}>1 = {q.label_min || '-'} · 5 = {q.label_maks || '-'}</div>}
            <div className="acts" style={{ marginTop: 10, justifyContent: 'flex-start' }}>
              <button className="btn sm y" onClick={() => edit(q)}>Ubah</button>
              <button className="btn sm r" onClick={async () => (await ask(`Hapus pertanyaan "${q.teks}"? Jawaban peserta untuk pertanyaan ini tidak akan tampil lagi.`)) && run({ action: 'deleteSurveyQuestion', id: q.id, teks: q.teks }, 'Pertanyaan dihapus')}>Hapus</button>
            </div>
          </div>
        ))}
      </>}

      {ed && <Modal title={ed.id ? 'Ubah pertanyaan' : 'Tambah pertanyaan'} onClose={() => setEd(null)}>
        <label className="lbl" htmlFor="sq">Pertanyaan</label>
        <textarea id="sq" rows={2} maxLength={300} value={ed.teks} onChange={(e) => setEd({ ...ed, teks: e.target.value })} />
        <label className="lbl" htmlFor="st">Jenis jawaban</label>
        <select id="st" value={ed.tipe} onChange={(e) => setEd({ ...ed, tipe: e.target.value })}>{Object.entries(TIPE).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <label className="lbl" style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" style={{ width: 'auto', margin: 0 }} checked={ed.wajib} onChange={(e) => setEd({ ...ed, wajib: e.target.checked })} /> Wajib diisi</label>
        {ed.tipe === 'skala' && <div className="form2">
          <div><label className="lbl" htmlFor="s1">Keterangan angka 1</label><input id="s1" maxLength={40} placeholder="Sangat Tidak Puas" value={ed.label_min} onChange={(e) => setEd({ ...ed, label_min: e.target.value })} /></div>
          <div><label className="lbl" htmlFor="s5">Keterangan angka 5</label><input id="s5" maxLength={40} placeholder="Sangat Puas" value={ed.label_maks} onChange={(e) => setEd({ ...ed, label_maks: e.target.value })} /></div>
        </div>}
        {ed.tipe === 'pilihan' && <>
          <div className="lbl">Pilihan jawaban (minimal 2)</div>
          <div style={{ display: 'grid', gap: 8, margin: '6px 0' }}>
            {ed.opsi.map((o, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input aria-label={'Opsi ' + (i + 1)} maxLength={100} style={{ margin: 0 }} value={o} onChange={(e) => setOpsi((a) => a.map((x, j) => (j === i ? e.target.value : x)))} />
                <button type="button" className="btn sm r" disabled={ed.opsi.length <= 2} onClick={() => setOpsi((a) => a.filter((_, j) => j !== i))}>Hapus</button>
              </div>))}
          </div>
          <button type="button" className="btn sm w" onClick={() => setOpsi((a) => [...a, ''])}>Tambah opsi</button>
          <label className="lbl" style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" style={{ width: 'auto', margin: 0 }} checked={ed.lainnya} onChange={(e) => setEd({ ...ed, lainnya: e.target.checked })} /> Sediakan opsi Lainnya (peserta mengetik sendiri)</label>
        </>}
        {ed.id && <p className="mute">Jawaban yang sudah masuk tidak ikut berubah. Jika nama opsi diganti, jawaban lama dihitung sebagai "Lainnya / opsi lama".</p>}
        <div className="cut" />
        <button className="btn" onClick={save}>Simpan</button>
      </Modal>}
    </>
  );
}
