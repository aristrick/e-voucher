'use client';
import { useLoad, useAct, Loading, Title } from '../ui';
import { fmtDateTime } from '@/lib/client';
export default function Pemenang() {
  const { data: d, err, reload } = useLoad({ action: 'winners' }, 15000);
  const { run, Msg } = useAct(() => reload(true));
  return (
    <>
      <Title right={<button className="btn sm b" onClick={() => reload()}>Segarkan</button>}>Pemenang</Title>
      <Msg />
      {!d ? <Loading err={err} /> : d.draws.length === 0 ? <div className="card empty">Belum ada undian. Mulai dari <a href="/stage" target="_blank" rel="noreferrer">layar undian</a>.</div> : (
        <div className="tw"><table>
          <thead><tr><th>Pemenang</th><th>NIK</th><th>Cabang</th><th>Hadiah</th><th>Waktu</th><th>Status</th><th></th></tr></thead>
          <tbody>{d.draws.map((x) => (
            <tr key={x.id} style={x.status === 'forfeited' ? { opacity: .55 } : undefined}>
              <td><b>{x.employees?.nama}</b></td><td>{x.employees?.nik}</td><td>{x.employees?.cabang || '-'}</td><td>{x.prizes?.nama}</td><td>{fmtDateTime(x.drawn_at)}</td>
              <td><span className={'chip' + (x.status === 'forfeited' ? ' no' : '')}>{x.status === 'forfeited' ? 'Tidak hadir' : 'Menang'}</span></td>
              <td>{x.status !== 'forfeited' && <button className="btn sm y" onClick={() => confirm(`Tandai ${x.employees?.nama} tidak hadir? Stok hadiah kembali dan bisa diundi ulang.`) && run({ action: 'forfeit', draw_id: x.id }, 'Ditandai tidak hadir')}>Tidak hadir</button>}</td>
            </tr>))}
          </tbody></table></div>
      )}
    </>
  );
}
