import { db, json } from '@/lib/db';
import { hash, check, sign, cookie } from '@/lib/auth';
export const dynamic = 'force-dynamic';
const H = { 'Content-Type': 'application/json' };
const ok = (o, extra = {}) => new Response(JSON.stringify({ ok: true, ...extra }), { headers: { ...H, 'Set-Cookie': cookie(sign(o)) } });
export async function POST(req) {
  if (!process.env.SESSION_SECRET) return json({ error: 'SESSION_SECRET belum diisi di Environment Variables' }, 500);
  const b = await req.json();
  if (b.action === 'logout') return new Response('{"ok":true}', { headers: { ...H, 'Set-Cookie': cookie('', 0) } });
  if (b.action === 'staff') {
    const u = String(b.username || '').trim().toLowerCase(), p = String(b.password || '');
    if (u === 'admin' && process.env.ADMIN_PIN && p === process.env.ADMIN_PIN) return ok({ t: 'admin' }, { role: 'admin' });
    const { data: s } = await db.from('staff').select('id,pass_hash,aktif').eq('username', u).maybeSingle();
    if (!s || !s.aktif || !check(p, s.pass_hash)) return json({ error: 'Username atau password salah' }, 401);
    return ok({ t: 'staff', id: s.id }, { role: 'staff' });
  }
  const nik = String(b.nik || '').trim();
  const { data: e } = await db.from('employees').select('id,hp,pass_hash').eq('nik', nik).maybeSingle();
  if (b.action === 'activate') {
    if (!e) return json({ error: 'NIK tidak ditemukan' }, 404);
    if (e.pass_hash) return json({ error: 'Akun sudah aktif. Silakan masuk, atau minta panitia reset password.' }, 409);
    const last4 = String(e.hp || '').replace(/\D/g, '').slice(-4);
    if (!b.hp4 || last4 !== String(b.hp4).trim()) return json({ error: '4 digit terakhir HP tidak cocok' }, 403);
    if (String(b.password || '').length < 6) return json({ error: 'Password minimal 6 karakter' }, 400);
    await db.from('employees').update({ pass_hash: hash(String(b.password)) }).eq('id', e.id);
    return ok({ t: 'peserta', id: e.id });
  }
  if (!e || !check(String(b.password || ''), e.pass_hash)) return json({ error: 'NIK atau password salah' }, 401);
  return ok({ t: 'peserta', id: e.id });
}
