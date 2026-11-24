import { db, role, json } from '@/lib/db';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  if (!role(req)) return json({ error: 'Belum login' }, 401);
  try {
    const { action, code, coupon_id, booth } = await req.json();

    if (action === 'coupons') {
      const { data, error } = await db.from('coupon_types').select('id,nama').order('urutan');
      if (error) return json({ error: error.message }, 500);
      return json(data || []);
    }

    const c = String(code || '').replace(/[^\w-]/g, '');
    if (!c) return json({ ok: false, msg: 'Kode kosong' });

    const { data: e, error: ee } = await db.from('employees')
      .select('id,nama,nik,cabang,checked_in_at').or(`token.eq.${c},nik.eq.${c}`).maybeSingle();
    if (ee) return json({ ok: false, msg: ee.message }, 500);
    if (!e) return json({ ok: false, msg: 'Tiket tidak dikenal' });
    const who = { nama: e.nama, nik: e.nik, cabang: e.cabang || '' };

    if (action === 'checkin') {
      if (e.checked_in_at) return json({ ok: false, aksi: 'checkin', ...who, msg: 'Sudah check-in sebelumnya' });
      const { error } = await db.from('employees').update({ checked_in_at: new Date().toISOString() }).eq('id', e.id);
      if (error) return json({ ok: false, aksi: 'checkin', ...who, msg: error.message }, 500);
      return json({ ok: true, aksi: 'checkin', ...who, msg: 'Check-in berhasil' });
    }

    // redeem
    if (!e.checked_in_at) return json({ ok: false, aksi: 'redeem', ...who, msg: 'Belum check-in di pintu masuk' });
    const cid = Number(coupon_id);
    if (!cid) return json({ ok: false, aksi: 'redeem', ...who, msg: 'Pilih kupon dulu' });
    const { data: cp } = await db.from('coupon_types').select('id,nama').eq('id', cid).maybeSingle();
    if (!cp) return json({ ok: false, aksi: 'redeem', ...who, msg: 'Kupon tidak ditemukan' });

    const { error } = await db.from('redemptions').insert({ employee_id: e.id, coupon_type_id: cid, booth: booth || null });
    if (error) {
      return json({ ok: false, aksi: 'redeem', ...who, kupon: cp.nama,
        msg: error.code === '23505' ? `Kupon ${cp.nama} sudah dipakai` : error.message });
    }
    return json({ ok: true, aksi: 'redeem', ...who, kupon: cp.nama, msg: `Kupon ${cp.nama} berhasil ditukar` });
  } catch (err) {
    return json({ ok: false, msg: 'Server error: ' + (err?.message || 'tidak diketahui') }, 500);
  }
}
