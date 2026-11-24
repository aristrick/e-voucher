import { db, json } from '@/lib/db';
export const dynamic = 'force-dynamic';
export async function POST(req) {
  const { token, nik, pin } = await req.json();
  let q = db.from('employees').select('id,nik,nama,cabang,hp,token,checked_in_at');
  q = token ? q.eq('token', String(token)) : q.eq('nik', String(nik || '').trim());
  const { data: e } = await q.maybeSingle();
  if (!e) return json({ error: 'Data tidak ditemukan' }, 404);
  const last4 = String(e.hp || '').replace(/\D/g, '').slice(-4);
  if (!token && (!pin || last4 !== String(pin).trim())) return json({ error: 'NIK atau 4 digit HP salah' }, 403);
  const [c, r, w] = await Promise.all([
    db.from('coupon_types').select('id,nama').order('urutan'),
    db.from('redemptions').select('coupon_type_id,created_at').eq('employee_id', e.id),
    db.from('draws').select('status,prizes(nama)').eq('employee_id', e.id).maybeSingle(),
  ]);
  const done = Object.fromEntries((r.data || []).map((x) => [x.coupon_type_id, x.created_at]));
  return json({
    nama: e.nama, nik: e.nik, cabang: e.cabang, token: e.token, hadir: !!e.checked_in_at,
    coupons: (c.data || []).map((x) => ({ ...x, redeemed_at: done[x.id] || null })),
    win: w.data && w.data.status !== 'forfeited' ? w.data.prizes?.nama : null,
  });
}
