import { createClient } from '@supabase/supabase-js';
export const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
export const role = (req) => {
  const p = req.headers.get('x-pin');
  if (!p) return null;
  if (p === process.env.ADMIN_PIN) return 'admin';
  if (p === process.env.STAFF_PIN) return 'staff';
  return null;
};
export const json = (d, s = 200) => Response.json(d, { status: s });
