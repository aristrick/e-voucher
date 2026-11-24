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
export const role = (req) => { const s = read(req); return s && (s.t === 'admin' || s.t === 'staff') ? s.t : null; };
export const json = (d, s = 200) => Response.json(d, { status: s });
