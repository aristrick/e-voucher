import { db, json } from '@/lib/db';
import { read } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export async function POST(req) {
  const s = read(req);
  if (s?.t !== 'peserta') return json({ error: 'Belum login' }, 401);
  const { data: e } = await db.from('employees').select('id,nik,nama,cabang,token,checked_in_at').eq('id', s.id).maybeSingle();
  if (!e) return json({ error: 'Belum login' }, 401);
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
