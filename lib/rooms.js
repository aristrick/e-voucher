import { db } from './db';

export const ROOM_MSG = 'Tabel kamar belum dibuat. Buka Supabase > SQL Editor, jalankan supabase/migration-v11.sql, lalu muat ulang halaman ini.';
export const KEY_MSG = 'Kolom kunci kamar belum dibuat. Buka Supabase > SQL Editor, jalankan supabase/migration-v12.sql, lalu muat ulang halaman ini.';
export const RET_MSG = 'Kolom pengembalian kunci belum dibuat. Buka Supabase > SQL Editor, jalankan supabase/migration-v14.sql, lalu muat ulang halaman ini.';
const t = (s) => String(s ?? '').trim();

// Fitur kamar dinyalakan atau dimatikan admin (baris room_enabled di tabel settings). Tidak pernah melempar error.
// Hasil disimpan 10 detik di memori supaya polling tiket 500 HP tidak membebani database.
let cache = { v: false, exp: 0 };
export const roomEnabled = async () => {
  if (cache.exp > Date.now()) return cache.v;
  let v = false;
  try { const { data } = await db.from('settings').select('value').eq('key', 'room_enabled').maybeSingle(); v = data?.value === '1'; } catch {}
  cache = { v, exp: Date.now() + 10000 };
  return v;
};
export const roomEnabledNow = (v) => { cache = { v, exp: Date.now() + 10000 }; };

// Rapikan dan periksa isian kamar dari admin
export function cleanRoom(b) {
  const nomor = t(b.nomor).slice(0, 20);
  if (!nomor) throw new Error('Nomor kamar wajib diisi');
  let kapasitas = null;
  if (b.kapasitas !== '' && b.kapasitas != null) {
    kapasitas = Number(b.kapasitas);
    if (!Number.isInteger(kapasitas) || kapasitas < 1 || kapasitas > 100) throw new Error('Kapasitas harus angka bulat 1 sampai 100, atau kosongkan');
  }
  return { nomor, nama: t(b.nama).slice(0, 60) || null, kapasitas, catatan: t(b.catatan).slice(0, 120) || null };
}

// Data kamar untuk tiket satu peserta.
//   null                  fitur mati (atau tabel belum ada): tiket tidak menampilkan apa-apa
//   { dapat: false }      fitur aktif tapi peserta belum dibagi kamar
//   { dapat: true, ... }  nomor, nama, catatan, jumlah penghuni, dan daftar teman sekamar (tanpa diri sendiri)
export async function roomFor(employeeId) {
  try {
    if (!(await roomEnabled())) return null;
    const me = await db.from('employees').select('room_id').eq('id', employeeId).maybeSingle();
    if (me.error) return null;
    if (!me.data?.room_id) return { dapat: false };
    const sel = (cols) => db.from('rooms').select(cols).eq('id', me.data.room_id).maybeSingle();
    const [r0, m] = await Promise.all([
      sel('nomor,nama,kapasitas,catatan,key_holder,key_taken_at,key_returned_at'),
      db.from('employees').select('id,nama,divisi,cabang').eq('room_id', me.data.room_id).order('nama').limit(200),
    ]);
    // migration-v14 (pengembalian kunci) atau v12 (kunci kamar) belum dijalankan: tiket tetap tampil, hanya info yang belum ada dilewati
    let r = r0;
    if (r.error) r = await sel('nomor,nama,kapasitas,catatan,key_holder,key_taken_at');
    if (r.error) r = await sel('nomor,nama,kapasitas,catatan');
    if (r.error || !r.data) return { dapat: false };
    const all = m.data || [], hold = all.find((x) => x.id === r.data.key_holder);
    return {
      dapat: true, nomor: r.data.nomor, nama: r.data.nama, catatan: r.data.catatan, kapasitas: r.data.kapasitas, jumlah: all.length,
      kunci: hold && r.data.key_taken_at ? { pemegang: hold.nama, saya: hold.id === employeeId, diambil_at: r.data.key_taken_at || null, dikembalikan_at: r.data.key_returned_at || null } : null,
      teman: all.filter((x) => x.id !== employeeId).map((x) => ({ nama: x.nama, unit: [x.divisi, x.cabang].filter(Boolean).join(' · '), kunci: x.id === r.data.key_holder })),
    };
  } catch { return null; }
}

// Pemegang kunci yang sudah tidak berada di kamar itu (dikeluarkan atau pindah) dikosongkan beserta status kunci, jadi penghuni lain bisa discan pertama. Tidak pernah melempar error.
export async function clearHolders(empIds, exceptRoom) {
  try {
    if (!empIds?.length) return;
    const q = (extra) => { let x = db.from('rooms').update({ key_holder: null, key_taken_at: null, key_taken_by: null, ...extra }).in('key_holder', empIds); if (exceptRoom) x = x.neq('id', Number(exceptRoom)); return x; };
    const r = await q({ key_returned_at: null, key_returned_by: null, key_returned_name: null });
    if (r.error) await q({});   // migration-v14 belum dijalankan
  } catch {}
}
