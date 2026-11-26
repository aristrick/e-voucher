import { db, json } from '@/lib/db';
import { read } from '@/lib/auth';
import { surveyOpen, cleanAnswers } from '@/lib/survey';
export const dynamic = 'force-dynamic';

// Survey untuk peserta yang sudah login: ambil pertanyaan + jawaban sendiri (get), atau kirim/perbarui jawaban (submit)
export async function POST(req) {
  const s = read(req);
  if (s?.t !== 'peserta') return json({ error: 'Belum login' }, 401);
  let b; try { b = await req.json(); } catch { return json({ error: 'Request tidak valid' }, 400); }
  const [open, q, a] = await Promise.all([
    surveyOpen(),
    db.from('survey_questions').select('id,tipe,teks,wajib,opsi,lainnya,label_min,label_maks').order('urutan').order('id'),
    db.from('survey_responses').select('jawaban').eq('employee_id', s.id).maybeSingle(),
  ]);
  if (q.error || a.error) return json({ error: 'Survey belum siap. Hubungi panitia.' }, 500);
  if (b.action === 'submit') {
    if (!open) return json({ error: 'Survey belum dibuka atau sudah ditutup' }, 400);
    let jawaban; try { jawaban = cleanAnswers(q.data, b.jawaban); } catch (e) { return json({ error: e.message }, 400); }
    const r = await db.from('survey_responses').upsert({ employee_id: s.id, jawaban, updated_at: new Date().toISOString() }, { onConflict: 'employee_id' });
    if (r.error) return json({ error: 'Jawaban gagal disimpan. Coba lagi.' }, 500);
    return json({});
  }
  return json({ open, done: !!a.data, questions: open ? q.data : [], jawaban: open ? a.data?.jawaban || {} : {} });
}
