'use client';
import { useLoad, Loading, Title } from './ui';
import { fmtDateTime, fmtTime, unit } from '@/lib/client';
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
export default function Ringkasan() {
  const { data: d, err, reload } = useLoad({ action: 'overview' }, 10000);
  if (!d) return <><Title>Ringkasan</Title><Loading err={err} kind="cards" /></>;
  return (
    <>
      <Title right={<><span className="live">Otomatis diperbarui</span><button className="btn sm b" onClick={() => reload()}>Segarkan</button></>}>Ringkasan</Title>
      {err && <div className="err">{err}</div>}
      <div className="stats">
        <div className="card purple"><div className="stat">{d.total}</div>Peserta terdaftar</div>
        <div className="card ok"><div className="stat">{d.hadir}</div>Sudah hadir <span className="mute">({pct(d.hadir, d.total)}%)</span></div>
        <div className="card blue"><div className="stat">{d.aktif}</div>Tiket diaktifkan <span className="mute">({pct(d.aktif, d.total)}%)</span></div>
        <div className="card yellow"><div className="stat">{d.winners}</div>Pemenang undian</div>
      </div>
      <div className="cols cols-3">
        <div className="card"><h2>Kehadiran</h2>
          <div className="bar"><i style={{ width: pct(d.hadir, d.total) + '%' }} /></div>
          <div className="mute">{d.hadir} dari {d.total} peserta ({pct(d.hadir, d.total)}%)</div>
          <div className="cut" />
          <h3>Aktivasi tiket</h3>
          <div className="bar"><i style={{ width: pct(d.aktif, d.total) + '%', background: 'var(--blue)' }} /></div>
          <div className="mute">{d.aktif} dari {d.total} peserta ({pct(d.aktif, d.total)}%)</div>
          <div className="cut" />
          <h3>Penukaran kupon</h3>
          {d.coupons.length === 0 && <div className="empty">Belum ada kupon. <a href="/admin/kupon">Tambah kupon</a></div>}
          {d.coupons.map((c) => (
            <div key={c.id} style={{ margin: '10px 0' }}>
              <div className="row"><b>{c.nama}</b><span>{c.used} / {d.hadir}</span></div>
              <div className="bar"><i style={{ width: pct(c.used, d.hadir) + '%' }} /></div>
            </div>
          ))}
          {d.coupons.length > 0 && <div className="mute">Persentase dihitung dari peserta yang sudah hadir.</div>}
        </div>
        <div className="card"><h2>Check-in terbaru</h2>
          {d.recent.length === 0 && <div className="empty">Belum ada yang check-in.</div>}
          <ul className="feed">{d.recent.map((r) => (
            <li key={r.nik}>
              <span className="who"><b>{r.nama}</b><span className="mute">{unit(r) || r.nik}</span></span>
              <span className="chip">{fmtDateTime(r.checked_in_at)}</span>
            </li>))}
          </ul>
        </div>
        <div className="card"><div className="row"><h2 style={{ margin: 0 }}>Aktivitas terbaru</h2><a className="btn sm w" href="/admin/history">Lihat semua</a></div>
          {(!d.activity || d.activity.length === 0) && <div className="empty">Belum ada aktivitas tercatat. Jika sudah ada kegiatan, jalankan <code>migration-v4.sql</code> di Supabase.</div>}
          <ul className="feed">{(d.activity || []).map((a) => (
            <li key={a.id}>
              <span className="who"><b style={a.ok ? undefined : { color: '#b00020' }}>{a.ringkas}</b><span className="mute">{a.actor || '-'}</span></span>
              <span className="chip off nw">{fmtTime(a.created_at)}</span>
            </li>))}
          </ul>
        </div>
      </div>
    </>
  );
}
