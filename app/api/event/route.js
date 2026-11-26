import { db, json } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { surveyOpen } from '@/lib/survey';
export const dynamic = 'force-dynamic';
// Info publik untuk halaman depan (nama acara dan apa saja yang termasuk dalam tiket)
export async function GET() {
  const [all, c, p, survey] = await Promise.all([
    getSettings(),
    db.from('coupon_types').select('nama').order('urutan').order('id'),
    db.from('prizes').select('id', { count: 'exact', head: true }),
    surveyOpen(),
  ]);
  const { max_prizes_per_employee, ...event } = all;
  return json({ event, benefits: (c.data || []).map((x) => x.nama), doorprize: (p.count || 0) > 0, survey });
}
