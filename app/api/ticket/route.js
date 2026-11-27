import { db, json } from '@/lib/db';
import { read } from '@/lib/auth';
import { roomFor } from '@/lib/rooms';
export const dynamic = 'force-dynamic';
export async function POST(req) {
  const s = read(req);
  if (s?.t !== 'peserta') return json({ error: 'Belum login' }, 401);
  const { data: e } = await db.from('employees').select('id,nik,nama,cabang,divisi,token,checked_in_at').eq('id', s.id).maybeSingle();
  if (!e) return json({ error: 'Belum login' }, 401);
  const [c, r, w, kamar] = await Promise.all([
    db.from('coupon_types').select('id,nama').order('urutan').order('id'),
    db.from('redemptions').select('coupon_type_id,created_at').eq('employee_id', e.id),
    // claimed_at ada sejak migration-v10; jika belum dijalankan, tiket tetap tampil (hadiah dianggap belum diambil)
    (async () => {
      const q = await db.from('draws').select('id,status,drawn_at,claimed_at,prizes(nama)').eq('employee_id', e.id).order('drawn_at');
      return q.error ? db.from('draws').select('id,status,drawn_at,prizes(nama)').eq('employee_id', e.id).order('drawn_at') : q;
    })(),
    // kamar: hanya terisi bila admin mengaktifkan fitur kamar; tidak pernah membuat tiket gagal
    roomFor(e.id),
  ]);
  const won = (w.data || []).filter((x) => x.status !== 'forfeited' && x.prizes?.nama);
  const done = Object.fromEntries((r.data || []).map((x) => [x.coupon_type_id, x.created_at]));
  return json({
    nama: e.nama, nik: e.nik, cabang: e.cabang, divisi: e.divisi, token: e.token,
    kode: e.token.toUpperCase().replace(/(.{4})(?=.)/g, '$1-'),
    hadir: !!e.checked_in_at, hadir_at: e.checked_in_at,
    coupons: (c.data || []).map((x) => ({ ...x, redeemed_at: done[x.id] || null })),
    win: won.map((x) => x.prizes.nama).join(', ') || null,
    prizes: won.map((x) => ({ id: x.id, nama: x.prizes.nama, claimed_at: x.claimed_at || null })),
    kamar,
  });
}
