import { db } from './db';
import { read } from './auth';

// Nama pelaku untuk riwayat. Panitia dicari dari database (cache 60 detik).
const names = new Map();
export async function actorOf(req) {
  const s = read(req);
  if (!s) return { actor: '-', role: '' };
  if (s.t === 'admin') return { actor: 'Admin', role: 'admin' };
  if (s.t !== 'staff') return { actor: '-', role: s.t || '' };
  const hit = names.get(s.id);
  if (hit && hit.exp > Date.now()) return { actor: hit.name, role: 'staff' };
  let name = 'Panitia';
  try {
    const { data } = await db.from('staff').select('username,nama').eq('id', s.id).maybeSingle();
    if (data) name = data.nama || data.username;
  } catch {}
  names.set(s.id, { name, exp: Date.now() + 60000 });
  return { actor: name, role: 'staff' };
}

// Mencatat aktivitas. Tidak pernah melempar error: kalau tabel belum dibuat, aplikasi tetap jalan.
export async function logAct(who, { kategori, aksi, ringkas, ok = true, detail = null }) {
  try {
    await db.from('activity_log').insert({
      actor: who?.actor || null, actor_role: who?.role || null,
      kategori, aksi, ringkas: String(ringkas || '').slice(0, 300), ok, detail,
    });
  } catch {}
}
