import { db } from './db';
export const DEFAULTS = { event_name: 'Gathering Karyawan', event_date: '', event_venue: '', event_desc: '', max_prizes_per_employee: '1' };
export async function getSettings() {
  const o = { ...DEFAULTS };
  try {
    const { data } = await db.from('settings').select('key,value');
    (data || []).forEach((r) => { if (r.key in DEFAULTS && r.value) o[r.key] = r.value; });
  } catch {}
  return o;
}
