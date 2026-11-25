'use client';
import { useState } from 'react';
import { post } from '@/lib/client';
export default function Login() {
  const [u, setU] = useState(''), [p, setP] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true); setErr('');
    const r = await post('/api/auth', { action: 'staff', username: u, password: p });
    if (!r.ok) { setBusy(false); return setErr(r.error || 'Gagal masuk'); }
    location.href = r.role === 'admin' ? '/admin' : '/staff';
  };
  return (
    <div className="wrap"><div className="card"><h1>Login panitia</h1>
      <label className="lbl" htmlFor="u">Username</label>
      <input id="u" autoCapitalize="none" autoComplete="username" value={u} onChange={(e) => setU(e.target.value)} />
      <label className="lbl" htmlFor="p">Password</label>
      <input id="p" type="password" autoComplete="current-password" value={p} onChange={(e) => setP(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go()} />
      {err && <div className="err">{err}</div>}
      <button className="btn block" disabled={busy} onClick={go}>{busy ? 'Masuk...' : 'Masuk'}</button></div>
      <a href="/">Kembali ke halaman tiket</a></div>
  );
}
