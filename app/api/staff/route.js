import { db, role, json } from '@/lib/db';
export const dynamic = 'force-dynamic';
export async function POST(req) {
  if (!role(req)) return json({ error: 'PIN salah' }, 401);
  const { action, code, coupon_id, booth } = await req.json();
  if (action === 'coupons') return json((await db.from('coupon_types').select('id,nama').order('urutan')).data);
  const c = String(code || '').replace(/[^\w-]/g, '');
  const { data: e } = await db.from('employees').select('id,nama,nik,checked_in_at').or(`token.eq.${c},nik.eq.${c}`).maybeSingle();
  if (!e) return json({ ok: false, msg: 'Tiket tidak dikenal' });
  if (action === 'checkin') {
    if (e.checked_in_at) return json({ ok: false, nama: e.nama, nik: e.nik, msg: 'Sudah check-in sebelumnya' });
    await db.from('employees').update({ checked_in_at: new Date().toISOString() }).eq('id', e.id);
    return json({ ok: true, nama: e.nama, nik: e.nik, msg: 'Check-in berhasil' });
  }
  if (!e.checked_in_at) return json({ ok: false, nama: e.nama, nik: e.nik, msg: 'Belum check-in di pintu masuk' });
  const { error } = await db.from('redemptions').insert({ employee_id: e.id, coupon_type_id: coupon_id, booth: booth || null });
  if (error) return json({ ok: false, nama: e.nama, nik: e.nik, msg: error.code === '23505' ? 'Kupon sudah dipakai' : error.message });
  return json({ ok: true, nama: e.nama, nik: e.nik, msg: 'Kupon berhasil ditukar' });
}
