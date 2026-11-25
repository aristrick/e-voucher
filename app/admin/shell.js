'use client';
import { usePathname } from 'next/navigation';
import { post } from '@/lib/client';
const NAV = [
  ['/admin', 'Ringkasan'], ['/admin/peserta', 'Peserta'], ['/admin/panitia', 'Panitia'],
  ['/admin/kupon', 'Kupon'], ['/admin/hadiah', 'Hadiah'], ['/admin/pemenang', 'Pemenang'], ['/admin/pengaturan', 'Pengaturan'],
];
export default function Shell({ children }) {
  const path = usePathname();
  const out = async () => { await post('/api/auth', { action: 'logout' }); location.href = '/login'; };
  return (
    <div className="shell">
      <nav className="side" aria-label="Menu admin">
        <div className="brand">Admin</div>
        {NAV.map(([h, l]) => <a key={h} href={h} className={'nav' + (path === h ? ' on' : '')} aria-current={path === h ? 'page' : undefined}>{l}</a>)}
        <div className="sp" style={{ flex: 1 }} />
        <a className="btn sm b" href="/stage" target="_blank" rel="noreferrer">Layar undian</a>
        <a className="btn sm g" href="/staff">Scan</a>
        <button className="btn sm y" onClick={out}>Keluar</button>
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}
