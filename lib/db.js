import { createClient } from '@supabase/supabase-js';
import { read } from './auth';

let client;
const get = () => {
  if (!client) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum diisi di Environment Variables');
    }
    client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  }
  return client;
};
export const db = { from: (...a) => get().from(...a), rpc: (...a) => get().rpc(...a) };

// Panitia dicek ke database (cache 20 detik) supaya akun yang dinonaktifkan langsung berhenti bisa scan
const seen = new Map();
export const role = async (req) => {
  const s = read(req);
  if (!s) return null;
  if (s.t === 'admin') return 'admin';
  if (s.t !== 'staff' || !s.id) return null;
  const hit = seen.get(s.id);
  if (hit && hit.exp > Date.now()) return hit.ok ? 'staff' : null;
  const { data } = await db.from('staff').select('aktif').eq('id', s.id).maybeSingle();
  const ok = !!data?.aktif;
  seen.set(s.id, { ok, exp: Date.now() + 20000 });
  return ok ? 'staff' : null;
};
export const json = (d, s = 200) => Response.json(d, { status: s });

export const MIGRATE_MSG = 'Database belum diperbarui. Buka Supabase > SQL Editor, jalankan file migration yang belum dijalankan (v2 sampai v6, terakhir supabase/migration-v6.sql), lalu muat ulang halaman ini.';
