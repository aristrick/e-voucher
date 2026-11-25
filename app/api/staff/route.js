import { db, role, json } from '@/lib/db';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  const who0 = await role(req);
  if (!who0) return json({ error: 'Belum login' }, 401);
  try {
    const { action, code, coupon_id, booth } = await req.json();

    if (action === 'coupons') {
      const { data, error } = await db.from('coupon_types').select('id,nama').order('urutan').order('id');
      if (error) return json({ error: error.message }, 500);
      return json({ coupons: data || [], role: who0 });
    }

    // QR berisi token; panitia juga boleh mengetik NIK atau kode tiket (dengan atau tanpa strip)
    const c = String(code || '').replace(/[^\w]/g, '');
    if (!c) return json({ ok: false, msg: 'Kode kosong' });

    const { data: e, error: ee } = await db.from('employees')
      .select('id,nama,nik,cabang,checked_in_at').or(`token.eq.${c.toLowerCase()},nik.eq.${c}`).maybeSingle();
    if (ee) return json({ ok: false, msg: ee.message }, 500);
    if (!e) return json({ ok: false, msg: 'Tiket tidak dikenal' });
    const who = { nama: e.nama, nik: e.nik, cabang: e.cabang || '' };

    if (action === 'checkin') {
      if (e.checked_in_at) return json({ ok: false, aksi: 'checkin', ...who, at: e.checked_in_at, msg: 'Sudah check-in sebelumnya' });
      // update bersyarat: kalau dua HP scan bersamaan, hanya satu yang berhasil
      const now = new Date().toISOString();
      const { data: up, error } = await db.from('employees').update({ checked_in_at: now })
        .eq('id', e.id).is('checked_in_at', null).select('id');
      if (error) return json({ ok: false, aksi: 'checkin', ...who, msg: error.message }, 500);
      if (!up?.length) return json({ ok: false, aksi: 'checkin', ...who, msg: 'Sudah check-in sebelumnya' });
      return json({ ok: true, aksi: 'checkin', ...who, at: now, msg: 'Check-in berhasil' });
    }

    if (action !== 'redeem') return json({ ok: false, msg: 'Aksi tidak dikenal' }, 400);
    if (!e.checked_in_at) return json({ ok: false, aksi: 'redeem', ...who, msg: 'Belum check-in di pintu masuk' });
    const cid = Number(coupon_id);
    if (!cid) return json({ ok: false, aksi: 'redeem', ...who, msg: 'Pilih kupon dulu' });
    const { data: cp } = await db.from('coupon_types').select('id,nama').eq('id', cid).maybeSingle();
    if (!cp) return json({ ok: false, aksi: 'redeem', ...who, msg: 'Kupon tidak ditemukan' });

    const { data: ins, error } = await db.from('redemptions').insert({ employee_id: e.id, coupon_type_id: cid, booth: String(booth || '').slice(0, 40) || null }).select('created_at').single();
    if (error) {
      if (error.code === '23505') {
        const { data: old } = await db.from('redemptions').select('created_at').eq('employee_id', e.id).eq('coupon_type_id', cid).maybeSingle();
        return json({ ok: false, aksi: 'redeem', ...who, kupon: cp.nama, at: old?.created_at, msg: `Kupon ${cp.nama} sudah dipakai` });
      }
      return json({ ok: false, aksi: 'redeem', ...who, kupon: cp.nama, msg: error.message });
    }
    return json({ ok: true, aksi: 'redeem', ...who, kupon: cp.nama, at: ins.created_at, msg: `Kupon ${cp.nama} berhasil ditukar` });
  } catch (err) {
    return json({ ok: false, msg: 'Server error: ' + (err?.message || 'tidak diketahui') }, 500);
  }
}
