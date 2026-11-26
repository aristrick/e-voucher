'use client';
import { useEffect, useState } from 'react';
import { post } from '@/lib/client';
import { useUI } from '@/app/admin/ui';

export default function Survey() {
  const { toast } = useUI();
  const [d, setD] = useState(null), [a, setA] = useState({}), [oth, setOth] = useState({});
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false), [sent, setSent] = useState(false);

  useEffect(() => {
    post('/api/survey', { action: 'get' }).then((r) => {
      if (r.status === 401) { location.href = '/'; return; }
      if (!r.ok) return setErr(r.error);
      // jawaban pilihan yang bukan salah satu opsi berarti diisi lewat "Lainnya"
      const o = {};
      (r.questions || []).forEach((q) => { const v = r.jawaban?.[q.id]; if (q.tipe === 'pilihan' && v != null && !q.opsi.includes(v)) o[q.id] = true; });
      setA(r.jawaban || {}); setOth(o); setSent(!!r.done); setD(r);
    });
  }, []);

  const put = (id, v) => setA((x) => ({ ...x, [id]: v }));
  const pick = (q, v) => { setOth((o) => ({ ...o, [q.id]: false })); put(q.id, v); };
  const other = (q) => { setOth((o) => ({ ...o, [q.id]: true })); put(q.id, q.opsi.includes(a[q.id]) ? '' : a[q.id] ?? ''); };
  const submit = async () => {
    setBusy(true); setErr('');
    const r = await post('/api/survey', { action: 'submit', jawaban: a });
    setBusy(false);
    if (r.status === 401) { location.href = '/'; return; }
    if (!r.ok) return setErr(r.error);
    setSent(true); window.scrollTo({ top: 0, behavior: 'instant' }); toast('ok', 'Terima kasih, jawabanmu tersimpan');
  };

  const back = <p><a href="/">Kembali ke tiket</a></p>;
  if (!d) return <div className="wrap">{err ? <><div className="err">{err}</div>{back}</> : <div className="card" role="status" aria-busy="true" aria-label="Memuat"><span className="sk" style={{ width: '50%', height: 22 }} /><span className="sk" style={{ height: 120, marginTop: 14 }} /></div>}</div>;
  if (!d.open) return <div className="wrap"><div className="card"><h2>Survey belum dibuka</h2><p className="mute">Survey belum dibuka atau sudah ditutup oleh panitia.</p></div>{back}</div>;
  if (sent) return <div className="wrap"><div className="card yellow"><h2>Terima kasih!</h2>Jawabanmu sudah kami terima. Masukanmu sangat berarti untuk acara berikutnya.</div><button className="btn w block" onClick={() => setSent(false)}>Ubah jawaban</button>{back}</div>;

  return (
    <div className="wrap">
      <h2 style={{ marginBottom: 4 }}>Umpan balik acara</h2>
      <p className="mute" style={{ marginTop: 0 }}>Isi singkat saja. Tanda <span style={{ color: '#b00020' }}>*</span> wajib diisi.</p>
      {d.questions.map((q, i) => (
        <div className="card" key={q.id}>
          <b>{i + 1}. {q.teks}</b>{q.wajib && <span style={{ color: '#b00020' }}> *</span>}
          {q.tipe === 'skala' && <>
            <div className="gap" style={{ marginTop: 12, flexWrap: 'nowrap' }}>
              {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" className={'btn ' + (a[q.id] === n ? 'sel' : 'w')} style={{ flex: 1, padding: '10px 0' }} aria-pressed={a[q.id] === n} onClick={() => put(q.id, n)}>{n}</button>)}
            </div>
            {(q.label_min || q.label_maks) && <div className="row mute" style={{ marginTop: 6, flexWrap: 'nowrap' }}><span>{q.label_min}</span><span style={{ textAlign: 'right' }}>{q.label_maks}</span></div>}
          </>}
          {q.tipe === 'teks' && <textarea rows={3} maxLength={2000} aria-label={q.teks} style={{ marginTop: 10 }} value={a[q.id] ?? ''} onChange={(e) => put(q.id, e.target.value)} />}
          {q.tipe === 'pilihan' && <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
            {q.opsi.map((o) => <button key={o} type="button" className={'btn ' + (!oth[q.id] && a[q.id] === o ? 'sel' : 'w')} style={{ textAlign: 'left' }} aria-pressed={!oth[q.id] && a[q.id] === o} onClick={() => pick(q, o)}>{o}</button>)}
            {q.lainnya && <button type="button" className={'btn ' + (oth[q.id] ? 'sel' : 'w')} style={{ textAlign: 'left' }} aria-pressed={!!oth[q.id]} onClick={() => other(q)}>Lainnya</button>}
            {q.lainnya && oth[q.id] && <input autoFocus maxLength={200} placeholder="Tulis jawabanmu" aria-label={q.teks + ' (lainnya)'} style={{ margin: 0 }} value={a[q.id] ?? ''} onChange={(e) => put(q.id, e.target.value)} />}
          </div>}
        </div>
      ))}
      {err && <div className="err">{err}</div>}
      <button className="btn block" disabled={busy} onClick={submit}>{busy ? 'Mengirim...' : d.done ? 'Perbarui jawaban' : 'Kirim survey'}</button>
      {back}
    </div>
  );
}
