'use client';
import { usePathname } from 'next/navigation';
import { UIProvider } from './ui';
const NAV = [
  ['/admin', 'Ringkasan'], ['/admin/peserta', 'Peserta'], ['/admin/panitia', 'Panitia'],
  ['/admin/kupon', 'Kupon'], ['/admin/hadiah', 'Hadiah'], ['/admin/pemenang', 'Pemenang'], ['/admin/kamar', 'Kamar'], ['/admin/survey', 'Survey'], ['/admin/history', 'History'], ['/admin/cek-nik', 'Cek NIK'], ['/admin/pengaturan', 'Pengaturan'],
];
export default function Shell({ children }) {
  const path = usePathname();
  return (
    <UIProvider>
    <div className="shell">
      <div className="side-bg" aria-hidden="true" />
      <nav className="side" aria-label="Menu admin">
        <div className="brand">Admin</div>
        {NAV.map(([h, l]) => <a key={h} href={h} className={'nav' + (path === h ? ' on' : '')} aria-current={path === h ? 'page' : undefined}>{l}</a>)}
      </nav>
      <main className="main">{children}</main>
    </div>
    </UIProvider>
  );
}
