import { db } from './db';

export const ROOM_MSG = 'Tabel kamar belum dibuat. Buka Supabase > SQL Editor, jalankan supabase/migration-v11.sql, lalu muat ulang halaman ini.';
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
    const [r, m] = await Promise.all([
      db.from('rooms').select('nomor,nama,kapasitas,catatan').eq('id', me.data.room_id).maybeSingle(),
      db.from('employees').select('id,nama,divisi,cabang').eq('room_id', me.data.room_id).order('nama').limit(200),
    ]);
    if (r.error || !r.data) return { dapat: false };
    const all = m.data || [];
    return {
      dapat: true, nomor: r.data.nomor, nama: r.data.nama, catatan: r.data.catatan, kapasitas: r.data.kapasitas, jumlah: all.length,
      teman: all.filter((x) => x.id !== employeeId).map((x) => ({ nama: x.nama, unit: [x.divisi, x.cabang].filter(Boolean).join(' · ') })),
    };
  } catch { return null; }
}
