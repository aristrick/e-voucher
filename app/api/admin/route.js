import { db, role, json } from '@/lib/db';
import { hash } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export async function POST(req) {
  if (role(req) !== 'admin') return json({ error: 'Khusus admin' }, 401);
  const b = await req.json();
  let r;
  switch (b.action) {
    case 'import': r = await db.from('employees').upsert(b.rows, { onConflict: 'nik' }); break;
    case 'addPrize': r = await db.from('prizes').insert({ nama: b.nama, stok: Number(b.stok) || 1 }); break;
    case 'addCoupon': r = await db.from('coupon_types').insert({ nama: b.nama }); break;
    case 'draw': r = await db.rpc('draw_winner', { p_prize: b.prize_id }); break;
    case 'forfeit': r = await db.from('draws').update({ status: 'forfeited' }).eq('id', b.draw_id); break;
    case 'addStaff':
      if (!b.username || String(b.password || '').length < 6) return json({ error: 'Username wajib dan password minimal 6 karakter' }, 400);
      r = await db.from('staff').insert({ username: String(b.username).trim().toLowerCase(), nama: b.nama, pass_hash: hash(String(b.password)) }); break;
    case 'toggleStaff': r = await db.from('staff').update({ aktif: b.aktif }).eq('id', b.id); break;
    case 'resetPeserta': r = await db.from('employees').update({ pass_hash: null }).eq('nik', String(b.nik || '').trim()); break;
    default: {
      const t = (n, s) => db.from(n).select(s);
      const [e, p, c, d, rd, st] = await Promise.all([
        t('employees', 'nik,nama,hp,checked_in_at').order('nama'),
        t('prizes', '*').order('id'),
        t('coupon_types', '*').order('urutan'),
        t('draws', 'id,status,prizes(nama),employees(nama,nik)').order('drawn_at', { ascending: false }),
        t('redemptions', 'coupon_type_id'),
        t('staff', 'id,username,nama,aktif').order('username'),
      ]);
      return json({ employees: e.data, prizes: p.data, coupons: c.data, draws: d.data, redemptions: rd.data, staff: st.data });
    }
  }
  return r.error ? json({ error: r.error.message }, 400) : json({ data: r.data });
}
