import { db } from './db';

export const SURVEY_MSG = 'Tabel survey belum dibuat. Buka Supabase > SQL Editor, jalankan supabase/migration-v9.sql, lalu muat ulang halaman ini.';
export const TIPE = ['skala', 'teks', 'pilihan'];
const t = (s) => String(s ?? '').trim();

// Survey dibuka atau ditutup oleh admin (baris survey_open di tabel settings). Tidak pernah melempar error.
export const surveyOpen = async () => {
  try { const { data } = await db.from('settings').select('value').eq('key', 'survey_open').maybeSingle(); return data?.value === '1'; } catch { return false; }
};

// Rapikan dan periksa pertanyaan dari admin
export function cleanQuestion(b) {
  const teks = t(b.teks).slice(0, 300);
  if (!teks) throw new Error('Pertanyaan wajib diisi');
  if (!TIPE.includes(b.tipe)) throw new Error('Jenis pertanyaan tidak dikenal');
  const q = { tipe: b.tipe, teks, wajib: b.wajib !== false, opsi: [], lainnya: false, label_min: null, label_maks: null };
  if (b.tipe === 'pilihan') {
    q.opsi = [...new Set((Array.isArray(b.opsi) ? b.opsi : []).map((x) => t(x).slice(0, 100)).filter(Boolean))];
    if (q.opsi.length < 2) throw new Error('Pilihan jawaban minimal 2 opsi');
    q.lainnya = !!b.lainnya;
  }
  if (b.tipe === 'skala') { q.label_min = t(b.label_min).slice(0, 40) || null; q.label_maks = t(b.label_maks).slice(0, 40) || null; }
  return q;
}

// Periksa jawaban peserta terhadap daftar pertanyaan, kembalikan { id_pertanyaan: jawaban } yang bersih
export function cleanAnswers(questions, input) {
  const src = input && typeof input === 'object' ? input : {};
  const out = {};
  for (const q of questions) {
    const v = src[q.id];
    if (v == null || t(v) === '') { if (q.wajib) throw new Error(`Pertanyaan wajib diisi: ${q.teks}`); continue; }
    if (q.tipe === 'skala') {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1 || n > 5) throw new Error(`Jawaban tidak valid: ${q.teks}`);
      out[q.id] = n;
    } else {
      const s = t(v).slice(0, q.tipe === 'teks' ? 2000 : 200);
      if (q.tipe === 'pilihan' && !q.lainnya && !q.opsi.includes(s)) throw new Error(`Pilihan tidak valid: ${q.teks}`);
      out[q.id] = s;
    }
  }
  return out;
}
