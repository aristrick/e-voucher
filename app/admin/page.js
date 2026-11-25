'use client';
import { useLoad, Loading, Title } from './ui';
import { fmtDateTime } from '@/lib/client';
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
export default function Ringkasan() {
  const { data: d, err, reload } = useLoad({ action: 'overview' }, 15000);
  if (!d) return <Loading err={err} />;
  return (
    <>
      <Title right={<button className="btn sm b" onClick={() => reload()}>Segarkan</button>}>Ringkasan</Title>
      {err && <div className="err">{err}</div>}
      <div className="grid" style={{ marginBottom: 16 }}>
        <div className="card purple"><div className="stat">{d.total}</div>Peserta terdaftar</div>
        <div className="card ok"><div className="stat">{d.hadir}</div>Sudah hadir</div>
        <div className="card blue"><div className="stat">{d.aktif}</div>Tiket diaktifkan</div>
        <div className="card yellow"><div className="stat">{d.winners}</div>Pemenang undian</div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}>
        <div className="card"><h2>Kehadiran</h2>
          <div className="bar"><i style={{ width: pct(d.hadir, d.total) + '%' }} /></div>
          <div className="mute">{d.hadir} dari {d.total} peserta ({pct(d.hadir, d.total)}%)</div>
          <div className="cut" />
          <h3>Aktivasi tiket</h3>
          <div className="bar"><i style={{ width: pct(d.aktif, d.total) + '%', background: 'var(--blue)' }} /></div>
          <div className="mute">{d.aktif} dari {d.total} peserta ({pct(d.aktif, d.total)}%)</div>
        </div>
        <div className="card"><h2>Penukaran kupon</h2>
          {d.coupons.length === 0 && <div className="empty">Belum ada kupon. <a href="/admin/kupon">Tambah kupon</a></div>}
          {d.coupons.map((c) => (
            <div key={c.id} style={{ margin: '10px 0' }}>
              <div className="row"><b>{c.nama}</b><span>{c.used} / {d.hadir}</span></div>
              <div className="bar"><i style={{ width: pct(c.used, d.hadir) + '%' }} /></div>
            </div>
          ))}
          <div className="mute">Persentase dihitung dari peserta yang sudah hadir.</div>
        </div>
        <div className="card"><h2>Check-in terbaru</h2>
          {d.recent.length === 0 && <div className="empty">Belum ada yang check-in.</div>}
          {d.recent.map((r) => (
            <div className="row" key={r.nik} style={{ margin: '8px 0' }}>
              <span><b>{r.nama}</b><div className="mute">{r.cabang || r.nik}</div></span><span className="chip">{fmtDateTime(r.checked_in_at)}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
