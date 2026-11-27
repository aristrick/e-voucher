import { after } from 'next/server';
import { db, role, json } from '@/lib/db';
import { actorOf, logAct } from '@/lib/log';
import { roomEnabled } from '@/lib/rooms';
export const dynamic = 'force-dynamic';

// Dibuat secepat mungkin: scan berhasil hanya butuh 1 kali ke database (check-in) atau 2 kali (redeem).
// Pencatatan riwayat berjalan SETELAH respons dikirim, jadi tidak menambah waktu tunggu panitia.
async function handle(req, b) {
  const who0 = await role(req);
  if (!who0) return [json({ error: 'Belum login' }, 401)];
  try {
    const { action, code, coupon_id, booth } = b;

    if (action === 'coupons') {
      const { data, error } = await db.from('coupon_types').select('id,nama').order('urutan').order('id');
      if (error) return [json({ error: error.message }, 500)];
      return [json({ coupons: data || [], role: who0 })];
    }

    // QR berisi token; panitia juga boleh mengetik NIK atau kode tiket (dengan atau tanpa strip)
    const c = String(code || '').replace(/[^\w]/g, '');
    if (!c) return [json({ ok: false, msg: 'Kode kosong' })];
    const match = `token.eq.${c.toLowerCase()},nik.eq.${c}`;
    const R = (d, s) => [json(d, s), d];

    if (action === 'checkin') {
      // jalur cepat: satu update bersyarat (hanya berhasil jika belum check-in), langsung mengembalikan data peserta
      const now = new Date().toISOString();
      const up = await db.from('employees').update({ checked_in_at: now }).or(match).is('checked_in_at', null).select('nama,nik,cabang,divisi');
      if (up.error) return R({ ok: false, aksi: 'checkin', msg: up.error.message }, 500);
      if (up.data?.length === 1) {
        const e = up.data[0];
        return R({ ok: true, aksi: 'checkin', nama: e.nama, nik: e.nik, cabang: e.cabang || '', divisi: e.divisi || '', at: now, msg: 'Check-in berhasil' });
      }
      // tidak ada baris yang berubah: tiket tidak dikenal atau sudah check-in
      const { data: e } = await db.from('employees').select('nama,nik,cabang,divisi,checked_in_at').or(match).maybeSingle();
      if (!e) return R({ ok: false, msg: 'Tiket tidak dikenal' });
      return R({ ok: false, aksi: 'checkin', nama: e.nama, nik: e.nik, cabang: e.cabang || '', divisi: e.divisi || '', at: e.checked_in_at, msg: 'Sudah check-in sebelumnya' });
    }

    if (action === 'prize') {
      // serahkan hadiah undian: semua hadiah peserta yang belum diambil ditandai sekaligus dalam SATU update bersyarat,
      // jadi dua panitia yang memindai QR yang sama bersamaan tidak bisa menyerahkan hadiah dua kali
      const pe = await db.from('employees').select('id,nama,nik,cabang,divisi').or(match).maybeSingle();
      if (pe.error) return R({ ok: false, aksi: 'prize', msg: pe.error.message }, 500);
      const e = pe.data;
      if (!e) return R({ ok: false, msg: 'Tiket tidak dikenal' });
      const who = { nama: e.nama, nik: e.nik, cabang: e.cabang || '', divisi: e.divisi || '' };
      const now = new Date().toISOString();
      const up = await db.from('draws').update({ claimed_at: now, claimed_by: String(booth || '').slice(0, 40) || null })
        .eq('employee_id', e.id).neq('status', 'forfeited').is('claimed_at', null).select('prizes(nama)');
      if (up.error) {
        const m = /claimed_at|claimed_by|schema cache|column/i.test(up.error.message) ? 'Database belum diperbarui. Jalankan supabase/migration-v10.sql di Supabase SQL Editor.' : up.error.message;
        return R({ ok: false, aksi: 'prize', ...who, msg: m }, 500);
      }
      if (up.data?.length) {
        const hadiah = up.data.map((x) => x.prizes?.nama).filter(Boolean);
        return R({ ok: true, aksi: 'prize', ...who, hadiah, at: now, msg: hadiah.length > 1 ? 'Serahkan semua hadiah ini' : 'Serahkan hadiah ini' });
      }
      const { data: all } = await db.from('draws').select('claimed_at,prizes(nama)').eq('employee_id', e.id).neq('status', 'forfeited').order('claimed_at');
      if (!all?.length) return R({ ok: false, aksi: 'prize', ...who, msg: 'Peserta ini belum memenangkan hadiah' });
      return R({ ok: false, aksi: 'prize', ...who, hadiah: all.map((x) => x.prizes?.nama).filter(Boolean), at: all[all.length - 1].claimed_at, msg: 'Hadiah sudah diambil sebelumnya' });
    }

    if (action === 'key') {
      // serah kunci kamar: peserta harus sudah check-in. Penghuni yang PERTAMA discan di kamar itu otomatis menjadi pemegang kunci, tanpa ditandai lebih dulu.
      // Setelah itu penghuni lain di kamar yang sama ditolak. Penandaan memakai satu update bersyarat (hanya berhasil selama
      // kamar belum punya pemegang kunci), jadi dua panitia yang memindai dua penghuni sekamar bersamaan tidak bisa menyerahkan kunci dua kali.
      const pe = await db.from('employees').select('id,nama,nik,cabang,divisi,room_id,checked_in_at').or(match).maybeSingle();
      if (pe.error) return R({ ok: false, aksi: 'key', msg: /room_id/i.test(pe.error.message) ? 'Database belum diperbarui. Jalankan supabase/migration-v11.sql dan migration-v12.sql di Supabase SQL Editor.' : pe.error.message }, 500);
      const e = pe.data;
      if (!e) return R({ ok: false, msg: 'Tiket tidak dikenal' });
      const who = { nama: e.nama, nik: e.nik, cabang: e.cabang || '', divisi: e.divisi || '' };
      if (!e.checked_in_at) return R({ ok: false, aksi: 'key', ...who, msg: 'Belum check-in di pintu masuk' });
      if (!(await roomEnabled())) return R({ ok: false, aksi: 'key', ...who, msg: 'Fitur pembagian kamar belum diaktifkan admin' });
      if (!e.room_id) return R({ ok: false, aksi: 'key', ...who, msg: 'Peserta ini belum dibagi kamar' });
      const rr = await db.from('rooms').select('id,nomor,nama,key_holder,key_taken_at').eq('id', e.room_id).maybeSingle();
      if (rr.error) return R({ ok: false, aksi: 'key', ...who, msg: 'Database belum diperbarui. Jalankan supabase/migration-v12.sql di Supabase SQL Editor.' }, 500);
      const room = rr.data;
      if (!room) return R({ ok: false, aksi: 'key', ...who, msg: 'Kamar peserta tidak ditemukan' });
      const kamar = room.nomor + (room.nama ? ' · ' + room.nama : '');
      // kunci kamar ini sudah diserahkan (ke peserta ini atau penghuni lain)
      const sudah = async (at) => {
        if (room.key_holder === e.id) return R({ ok: false, aksi: 'key', ...who, kamar, at, msg: `Kunci kamar ${room.nomor} sudah diambil sebelumnya oleh ${e.nama}` });
        const h = room.key_holder ? await db.from('employees').select('nama').eq('id', room.key_holder).maybeSingle() : { data: null };
        return R({ ok: false, aksi: 'key', ...who, kamar, at, msg: `Kunci kamar ${room.nomor} sudah dibawa oleh ${h.data?.nama || 'penghuni lain'}` });
      };
      if (room.key_holder) return sudah(room.key_taken_at);
      const now = new Date().toISOString();
      const up = await db.from('rooms').update({ key_holder: e.id, key_taken_at: now, key_taken_by: String(booth || '').slice(0, 40) || null })
        .eq('id', room.id).is('key_holder', null).select('id');
      if (up.error) return R({ ok: false, aksi: 'key', ...who, kamar, msg: up.error.message }, 500);
      if (!up.data?.length) {
        // kalah cepat dari scan lain di kamar yang sama: baca ulang siapa pemenangnya
        const { data: again } = await db.from('rooms').select('key_holder,key_taken_at').eq('id', room.id).maybeSingle();
        room.key_holder = again?.key_holder || null;
        return sudah(again?.key_taken_at);
      }
      return R({ ok: true, aksi: 'key', ...who, kamar, at: now, msg: `Serahkan kunci kamar ${room.nomor}. ${e.nama} jadi pembawa kunci` });
    }

    if (action !== 'redeem') return [json({ ok: false, msg: 'Aksi tidak dikenal' }, 400)];
    const cid = Number(coupon_id);
    // peserta dan kupon dicari bersamaan, bukan berurutan
    const [pe, pc] = await Promise.all([
      db.from('employees').select('id,nama,nik,cabang,divisi,checked_in_at').or(match).maybeSingle(),
      cid ? db.from('coupon_types').select('id,nama').eq('id', cid).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    if (pe.error) return R({ ok: false, msg: pe.error.message }, 500);
    const e = pe.data;
    if (!e) return R({ ok: false, msg: 'Tiket tidak dikenal' });
    const who = { nama: e.nama, nik: e.nik, cabang: e.cabang || '', divisi: e.divisi || '' };
    if (!e.checked_in_at) return R({ ok: false, aksi: 'redeem', ...who, msg: 'Belum check-in di pintu masuk' });
    if (!cid) return R({ ok: false, aksi: 'redeem', ...who, msg: 'Pilih kupon dulu' });
    const cp = pc.data;
    if (!cp) return R({ ok: false, aksi: 'redeem', ...who, msg: 'Kupon tidak ditemukan' });

    const { data: ins, error } = await db.from('redemptions').insert({ employee_id: e.id, coupon_type_id: cid, booth: String(booth || '').slice(0, 40) || null }).select('created_at').single();
    if (error) {
      if (error.code === '23505') {
        const { data: old } = await db.from('redemptions').select('created_at').eq('employee_id', e.id).eq('coupon_type_id', cid).maybeSingle();
        return R({ ok: false, aksi: 'redeem', ...who, kupon: cp.nama, at: old?.created_at, msg: `Kupon ${cp.nama} sudah dipakai` });
      }
      return R({ ok: false, aksi: 'redeem', ...who, kupon: cp.nama, msg: error.message });
    }
    return R({ ok: true, aksi: 'redeem', ...who, kupon: cp.nama, at: ins.created_at, msg: `Kupon ${cp.nama} berhasil ditukar` });
  } catch (err) {
    return [json({ ok: false, msg: 'Server error: ' + (err?.message || 'tidak diketahui') }, 500)];
  }
}

export async function POST(req) {
  let b; try { b = await req.json(); } catch { return json({ ok: false, msg: 'Request tidak valid' }, 400); }
  const [res, d] = await handle(req, b);
  if (d && (b.action === 'checkin' || b.action === 'redeem' || b.action === 'prize' || b.action === 'key')) {
    const booth = String(b.booth || '').slice(0, 40);
    after(async () => {
      const what = b.action === 'checkin' ? 'Check-in' : b.action === 'prize' ? 'Serah hadiah' : b.action === 'key' ? 'Serah kunci' + (d.kamar ? ' kamar ' + d.kamar : '') : 'Redeem' + (d.kupon ? ' ' + d.kupon : '');
      const hd = b.action === 'prize' && d.hadiah?.length ? ' ' + d.hadiah.join(', ') : '';
      const ringkas = d.ok
        ? `${what}${hd} ke ${d.nama}` + (b.action !== 'checkin' && booth ? ` (booth ${booth})` : '')
        : `${what} gagal${d.nama ? ' · ' + d.nama : ''}: ${d.msg || 'tidak diketahui'}`;
      await logAct(await actorOf(req), { kategori: b.action === 'prize' ? 'hadiah' : b.action === 'key' ? 'kamar' : b.action, aksi: b.action, ringkas, ok: !!d.ok, detail: { nik: d.nik || null, kupon: d.kupon || null, hadiah: d.hadiah || null, booth: booth || null } });
    });
  }
  return res;
}
