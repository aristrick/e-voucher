import { db, json, MIGRATE_MSG } from '@/lib/db';
import { hash, check, sign, cookie, same, blocked, miss } from '@/lib/auth';
export const dynamic = 'force-dynamic';
const H = { 'Content-Type': 'application/json' };
const ok = (o, extra = {}) => new Response(JSON.stringify({ ok: true, ...extra }), { headers: { ...H, 'Set-Cookie': cookie(sign(o)) } });
const LOCKED = 'Terlalu banyak percobaan salah. Coba lagi 10 menit lagi atau minta panitia reset.';
const isLocked = (r) => r?.locked_until && new Date(r.locked_until) > new Date();
// 5 kali salah berturut-turut mengunci akun 10 menit
const fail = (table, r) => {
  const c = (r.fail_count || 0) + 1;
  return db.from(table).update(c >= 5 ? { fail_count: 0, locked_until: new Date(Date.now() + 600000).toISOString() } : { fail_count: c }).eq('id', r.id);
};
const good = (table, r) => (r.fail_count || r.locked_until) ? db.from(table).update({ fail_count: 0, locked_until: null }).eq('id', r.id) : null;
// nomor HP disamakan formatnya: 0812..., +62812..., 62812... dianggap sama
const mask = (s) => String(s || '').split(/\s+/).filter(Boolean).map((w) => w[0] + '*'.repeat(Math.max(w.length - 1, 0))).join(' ');
const phone = (v) => { let d = String(v || '').replace(/\D/g, ''); if (d.startsWith('62')) d = '0' + d.slice(2); else if (d && !d.startsWith('0')) d = '0' + d; return d; };

export async function POST(req) {
  if (!process.env.SESSION_SECRET) return json({ error: 'SESSION_SECRET belum diisi di Environment Variables' }, 500);
  let b; try { b = await req.json(); } catch { return json({ error: 'Request tidak valid' }, 400); }
  if (b.action === 'logout') return new Response('{"ok":true}', { headers: { ...H, 'Set-Cookie': cookie('', 0) } });

  if (b.action === 'staff') {
    const u = String(b.username || '').trim().toLowerCase(), p = String(b.password || '');
    if (u === 'admin') {
      const ip = 'admin:' + (req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
      if (blocked(ip)) return json({ error: LOCKED }, 429);
      if (process.env.ADMIN_PIN && same(p, process.env.ADMIN_PIN)) return ok({ t: 'admin' }, { role: 'admin' });
      miss(ip); return json({ error: 'Username atau password salah' }, 401);
    }
    const { data: s, error: se } = await db.from('staff').select('id,pass_hash,aktif,fail_count,locked_until').eq('username', u).maybeSingle();
    if (se) return json({ error: MIGRATE_MSG }, 500);
    if (s && isLocked(s)) return json({ error: LOCKED }, 429);
    if (!s || !s.aktif || !check(p, s.pass_hash)) { if (s) await fail('staff', s); return json({ error: 'Username atau password salah' }, 401); }
    await good('staff', s);
    return ok({ t: 'staff', id: s.id }, { role: 'staff' });
  }

  const nik = String(b.nik || '').trim();
  const { data: e, error: ee } = await db.from('employees').select('id,nama,hp,pass_hash,fail_count,locked_until').eq('nik', nik).maybeSingle();
  if (ee) return json({ error: MIGRATE_MSG }, 500);

  if (b.action === 'lookup') {
    if (!e) return json({ error: 'NIK tidak ditemukan. Cek lagi atau hubungi panitia.' }, 404);
    // saklar admin (settings.name_visible): '0' = nama disensor (A*** S*******), selain itu nama lengkap
    const sv = await db.from('settings').select('value').eq('key', 'name_visible').maybeSingle();
    const full = sv.data?.value !== '0';
    return json({ ok: true, nama: full ? e.nama : mask(e.nama), activated: !!e.pass_hash, hp_required: !!e.hp });
  }
  if (e && isLocked(e)) return json({ error: LOCKED }, 429);

  if (b.action === 'activate') {
    if (!e) return json({ error: 'NIK tidak ditemukan' }, 404);
    if (e.pass_hash) return json({ error: 'Tiket ini sudah diaktifkan. Silakan masuk, atau minta panitia reset password.' }, 409);
    const hp = phone(b.hp);
    if (hp.length < 9 || hp.length > 15) return json({ error: 'Nomor HP tidak valid. Contoh: 081234567890' }, 400);
    if (String(b.password || '').length < 6) return json({ error: 'Password minimal 6 karakter' }, 400);
    // nomor HP yang diisi saat membuat password menjadi acuan untuk login berikutnya
    await db.from('employees').update({ hp, pass_hash: hash(String(b.password)), fail_count: 0, locked_until: null }).eq('id', e.id);
    return ok({ t: 'peserta', id: e.id });
  }

  // setelah mendaftar, peserta cukup mengisi 4 angka terakhir nomor HP (nomor lengkap tetap diterima)
  const dig = String(b.hp || '').replace(/\D/g, '');
  const hpOk = !!e && (!e.hp || (dig.length === 4 ? phone(e.hp).endsWith(dig) : phone(b.hp) === phone(e.hp)));
  if (!e || !hpOk || !check(String(b.password || ''), e.pass_hash)) { if (e) await fail('employees', e); return json({ error: 'NIK, 4 angka terakhir HP, atau password salah' }, 401); }
  await good('employees', e);
  return ok({ t: 'peserta', id: e.id });
}
