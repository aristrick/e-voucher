'use client';
import { useState } from 'react';
export default function Login() {
  const [u, setU] = useState(''), [p, setP] = useState(''), [err, setErr] = useState('');
  const go = async () => {
    const r = await fetch('/api/auth', { method: 'POST', body: JSON.stringify({ action: 'staff', username: u, password: p }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return setErr(d.error || 'Gagal masuk');
    location.href = d.role === 'admin' ? '/admin' : '/staff';
  };
  return (
    <div className="wrap"><div className="card"><h1>Login panitia</h1>
      <input placeholder="Username" autoCapitalize="none" value={u} onChange={(e) => setU(e.target.value)} />
      <input type="password" placeholder="Password" value={p} onChange={(e) => setP(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go()} />
      {err && <p>{err}</p>}<button className="btn" onClick={go}>Masuk</button></div>
      <a href="/">Login peserta</a></div>
  );
}
