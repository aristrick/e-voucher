import { after } from 'next/server';
import { db, role, json, MIGRATE_MSG } from '@/lib/db';
import { hash } from '@/lib/auth';
import { getSettings, DEFAULTS } from '@/lib/settings';
import { actorOf, logAct } from '@/lib/log';
import { SURVEY_MSG, surveyOpen, cleanQuestion } from '@/lib/survey';
export const dynamic = 'force-dynamic';

const must = (r) => {
  if (r.error) {
    if (r.error.code === '23505') throw new Error('Data sudah ada (duplikat)');
    if (/does not exist|schema cache/i.test(r.error.message || '')) throw new Error(MIGRATE_MSG);
    throw new Error(r.error.message || `Gagal membaca database (kode ${r.status || '?'})`);
  }
  return r;
};
// Sama seperti must, tetapi tabel survey yang belum dibuat menampilkan petunjuk migration-v9.sql
const sv = (r) => { if (/does not exist|schema cache/i.test(r.error?.message || '')) throw new Error(SURVEY_MSG); return must(r); };
// Cek sekali apakah migration-v2.sql sudah dijalankan (query HEAD tidak membawa pesan error, jadi dicek lewat SELECT biasa)
let ready = false;
const probe = async () => {
  if (ready) return;
  const [a, b] = await Promise.all([db.from('employees').select('wa_sent_at,fail_count,locked_until,max_hadiah,divisi').limit(1), db.from('settings').select('key').limit(1)]);
  if (a.error || b.error) throw new Error(MIGRATE_MSG);
  ready = true;
};
const head = (t) => db.from(t).select('*', { count: 'exact', head: true });
const n = async (q) => must(await q).count || 0;
const clean = (s) => String(s ?? '').trim();
const like = (s) => clean(s).replace(/[^\p{L}\p{N}\s.\-]/gu, '').slice(0, 60);
const maxH = (v) => {
  if (v === '' || v == null) return null;
  const x = Number(v); if (!Number.isInteger(x) || x < 1 || x > 100) throw new Error('Jatah hadiah harus angka bulat 1 sampai 100, atau kosongkan');
  return x;
};
const iso = () => new Date().toISOString();
const pass = (p) => { if (String(p || '').length < 6) throw new Error('Password minimal 6 karakter'); return hash(String(p)); };

const H = {
  // ---------- ringkasan ----------
  async overview() {
    await probe();
    const [total, hadir, aktif, wa, winners] = await Promise.all([
      n(head('employees')),
      n(head('employees').not('checked_in_at', 'is', null)),
      n(head('employees').not('pass_hash', 'is', null)),
      n(head('employees').not('wa_sent_at', 'is', null)),
      n(head('draws').neq('status', 'forfeited')),
    ]);
    const cps = must(await db.from('coupon_types').select('id,nama').order('urutan').order('id')).data;
    const used = await Promise.all(cps.map((c) => n(head('redemptions').eq('coupon_type_id', c.id))));
    const recent = must(await db.from('employees').select('nama,nik,cabang,divisi,checked_in_at')
      .not('checked_in_at', 'is', null).order('checked_in_at', { ascending: false }).limit(8)).data;
    let activity = [];
    try { const r = await db.from('activity_log').select('id,created_at,actor,kategori,ringkas,ok').order('created_at', { ascending: false }).limit(10); if (!r.error) activity = r.data || []; } catch {}
    return { total, hadir, aktif, wa, winners, coupons: cps.map((c, i) => ({ ...c, used: used[i] })), recent, activity };
  },

  // ---------- peserta ----------
  async employees(b) {
    await probe();
    const size = Math.min(Math.max(Number(b.size) || 20, 5), 100);
    const page = Math.max(Number(b.page) || 1, 1), from = (page - 1) * size;
    let q = db.from('employees').select('id,nik,nama,cabang,divisi,hp,checked_in_at,pass_hash,max_hadiah', { count: 'exact' });
    const s = like(b.q);
    if (s) q = q.or(`nama.ilike.%${s}%,nik.ilike.%${s}%,cabang.ilike.%${s}%,divisi.ilike.%${s}%`);
    if (b.status === 'hadir') q = q.not('checked_in_at', 'is', null);
    if (b.status === 'belum') q = q.is('checked_in_at', null);
    if (b.status === 'aktif') q = q.not('pass_hash', 'is', null);
    if (b.status === 'nonaktif') q = q.is('pass_hash', null);
    const r = must(await q.order('nama').order('nik').range(from, from + size - 1));
    const ids = r.data.map((e) => e.id);
    const red = ids.length ? must(await db.from('redemptions').select('employee_id,coupon_type_id,created_at,coupon_types(nama)').in('employee_id', ids).order('created_at')).data : [];
    const by = {}; red.forEach((x) => { (by[x.employee_id] ||= []).push({ id: x.coupon_type_id, nama: x.coupon_types?.nama, at: x.created_at }); });
    const dr = ids.length ? must(await db.from('draws').select('id,employee_id,status,drawn_at,prizes(nama)').in('employee_id', ids).order('drawn_at')).data : [];
    const un = {}; dr.forEach((x) => { (un[x.employee_id] ||= []).push({ id: x.id, nama: x.prizes?.nama, status: x.status, at: x.drawn_at }); });
    return { rows: r.data.map(({ pass_hash, ...e }) => ({ ...e, aktif: !!pass_hash, kupon: by[e.id] || [], undian: un[e.id] || [] })), total: r.count || 0, page, size };
  },
  async exportEmployees() {
    const coupons = must(await db.from('coupon_types').select('id,nama').order('urutan').order('id')).data;
    const emp = [], red = {}, won = {};
    for (let i = 0; ; i += 1000) {
      const r = must(await db.from('employees').select('id,nik,nama,cabang,divisi,hp,checked_in_at,pass_hash,max_hadiah').order('nama').order('nik').range(i, i + 999)).data;
      emp.push(...r); if (r.length < 1000) break;
    }
    for (let i = 0; ; i += 1000) {
      const r = must(await db.from('redemptions').select('employee_id,coupon_type_id,created_at').order('created_at').range(i, i + 999)).data;
      r.forEach((x) => { (red[x.employee_id] ||= {})[x.coupon_type_id] = x.created_at; }); if (r.length < 1000) break;
    }
    for (let i = 0; ; i += 1000) {
      const r = must(await db.from('draws').select('employee_id,status,prizes(nama)').order('drawn_at').range(i, i + 999)).data;
      r.forEach((x) => { if (x.status !== 'forfeited' && x.prizes?.nama) (won[x.employee_id] ||= []).push(x.prizes.nama); }); if (r.length < 1000) break;
    }
    return { coupons, rows: emp.map(({ id, pass_hash, ...e }) => ({ ...e, aktif: !!pass_hash, redeemed: red[id] || {}, hadiah: won[id] || [] })) };
  },
  async import(b) {
    const list = Array.isArray(b.rows) ? b.rows : [];
    const seen = new Map(); let skipped = 0;
    for (const r of list) {
      const nik = clean(r.nik), nama = clean(r.nama);
      if (!nik || !nama || !/^\w+$/.test(nik)) { skipped++; continue; }
      // nomor HP tidak diimpor: peserta mengisinya sendiri saat membuat password
      seen.set(nik, { nik, nama, cabang: clean(r.cabang) || null, divisi: clean(r.divisi) || null });
    }
    const rows = [...seen.values()];
    for (let i = 0; i < rows.length; i += 500) must(await db.from('employees').upsert(rows.slice(i, i + 500), { onConflict: 'nik' }));
    return { imported: rows.length, skipped, duplicates: list.length - skipped - rows.length };
  },
  async addEmployee(b) {
    const nik = clean(b.nik), nama = clean(b.nama);
    if (!nik || !/^\w+$/.test(nik)) throw new Error('NIK wajib diisi (huruf atau angka, tanpa spasi)');
    if (!nama) throw new Error('Nama wajib diisi');
    must(await db.from('employees').insert({ nik, nama, cabang: clean(b.cabang) || null, divisi: clean(b.divisi) || null, max_hadiah: maxH(b.max_hadiah) }));
    return {};
  },
  async updateEmployee(b) {
    const nik = clean(b.nik), nama = clean(b.nama);
    if (!nik || !/^\w+$/.test(nik)) throw new Error('NIK wajib diisi (huruf atau angka, tanpa spasi)');
    if (!nama) throw new Error('Nama wajib diisi');
    const r = must(await db.from('employees').update({ nik, nama, cabang: clean(b.cabang) || null, divisi: clean(b.divisi) || null, max_hadiah: maxH(b.max_hadiah) }).eq('id', b.id).select('id'));
    if (!r.data.length) throw new Error('Peserta tidak ditemukan');
    return {};
  },
  // check-in manual oleh admin (sama seperti scan panitia, waktunya dicatat)
  async checkinManual(b) {
    const e = must(await db.from('employees').select('id,nama,checked_in_at').eq('nik', clean(b.nik)).maybeSingle()).data;
    if (!e) throw new Error('NIK tidak ditemukan');
    if (e.checked_in_at) throw new Error(`${e.nama} sudah check-in sebelumnya`);
    must(await db.from('employees').update({ checked_in_at: iso() }).eq('id', e.id).is('checked_in_at', null));
    return {};
  },
  // tukar kupon secara manual oleh admin (sama seperti redeem panitia, booth dicatat "Admin (manual)")
  async redeemManual(b) {
    const e = must(await db.from('employees').select('id,nama,checked_in_at').eq('nik', clean(b.nik)).maybeSingle()).data;
    if (!e) throw new Error('NIK tidak ditemukan');
    if (!e.checked_in_at) throw new Error(`${e.nama} belum check-in. Check-in dulu sebelum menukar kupon`);
    const cp = must(await db.from('coupon_types').select('id,nama').eq('id', Number(b.coupon_id)).maybeSingle()).data;
    if (!cp) throw new Error('Kupon tidak ditemukan');
    const r = await db.from('redemptions').insert({ employee_id: e.id, coupon_type_id: cp.id, booth: 'Admin (manual)' });
    if (r.error?.code === '23505') throw new Error(`Kupon ${cp.nama} sudah dipakai ${e.nama}`);
    must(r); return {};
  },
  // koreksi kupon yang salah ditukar: pindahkan catatan penukaran dari kupon A ke kupon B (waktu penukaran tetap)
  async changeKupon(b) {
    const from = Number(b.from_id), to = Number(b.to_id);
    if (!from || !to || from === to) throw new Error('Pilih kupon tujuan yang berbeda');
    const e = must(await db.from('employees').select('id,nama').eq('nik', clean(b.nik)).maybeSingle()).data;
    if (!e) throw new Error('NIK tidak ditemukan');
    const cp = must(await db.from('coupon_types').select('id').eq('id', to).maybeSingle()).data;
    if (!cp) throw new Error('Kupon tujuan tidak ditemukan');
    const r = await db.from('redemptions').update({ coupon_type_id: to }).eq('employee_id', e.id).eq('coupon_type_id', from).select('id');
    if (r.error?.code === '23505') throw new Error(`${e.nama} sudah pernah menukar kupon tujuan itu`);
    must(r);
    if (!r.data.length) throw new Error('Catatan kupon asal tidak ditemukan');
    return {};
  },
  // batalkan check-in peserta (kembali ke status Belum check-in); kupon dan undian yang sudah tercatat tidak ikut dihapus
  async resetCheckin(b) {
    const r = must(await db.from('employees').update({ checked_in_at: null }).eq('nik', clean(b.nik)).not('checked_in_at', 'is', null).select('id'));
    if (!r.data.length) throw new Error('Peserta tidak ditemukan atau belum check-in');
    return {};
  },
  async resetPeserta(b) {
    const r = must(await db.from('employees').update({ pass_hash: null, hp: null, fail_count: 0, locked_until: null }).eq('nik', clean(b.nik)).select('id'));
    if (!r.data.length) throw new Error('NIK tidak ditemukan');
    return {};
  },
  // hapus catatan penukaran kupon peserta (semua kupon, atau satu kupon jika coupon_id diisi)
  async resetKupon(b) {
    const e = must(await db.from('employees').select('id').eq('nik', clean(b.nik)).maybeSingle()).data;
    if (!e) throw new Error('NIK tidak ditemukan');
    let q = db.from('redemptions').delete().eq('employee_id', e.id);
    if (b.coupon_id) q = q.eq('coupon_type_id', Number(b.coupon_id));
    const r = must(await q.select('id'));
    return { removed: r.data.length };
  },
  // hapus catatan undian peserta (semua, atau satu jika draw_id diisi): stok hadiah kembali dan peserta bisa diundi lagi
  async resetUndian(b) {
    const e = must(await db.from('employees').select('id').eq('nik', clean(b.nik)).maybeSingle()).data;
    if (!e) throw new Error('NIK tidak ditemukan');
    let q = db.from('draws').delete().eq('employee_id', e.id);
    if (b.draw_id) q = q.eq('id', String(b.draw_id));
    const r = must(await q.select('id'));
    return { removed: r.data.length };
  },
  async markSent(b) { must(await db.from('employees').update({ wa_sent_at: b.sent === false ? null : iso() }).eq('nik', clean(b.nik))); return {}; },
  // hapus SEMUA peserta (kupon dan undian mereka ikut terhapus); wajib kata konfirmasi HAPUS
  async deleteAllEmployees(b) {
    if (clean(b.confirm) !== 'HAPUS') throw new Error('Ketik HAPUS untuk mengonfirmasi');
    const r = must(await db.from('employees').delete({ count: 'exact' }).not('id', 'is', null));
    return { removed: r.count || 0 };
  },
  async deleteEmployee(b) { must(await db.from('employees').delete().eq('nik', clean(b.nik))); return {}; },

  // ---------- panitia ----------
  async staff() { return { staff: must(await db.from('staff').select('id,username,nama,aktif').order('username')).data }; },
  async addStaff(b) {
    const u = clean(b.username).toLowerCase();
    if (!/^[a-z0-9._-]{3,}$/.test(u)) throw new Error('Username minimal 3 karakter (huruf kecil, angka, titik, strip)');
    if (u === 'admin') throw new Error('Username "admin" sudah dipakai sistem');
    must(await db.from('staff').insert({ username: u, nama: clean(b.nama) || null, pass_hash: pass(b.password) })); return {};
  },
  async toggleStaff(b) { must(await db.from('staff').update({ aktif: !!b.aktif }).eq('id', b.id)); return {}; },
  async resetStaff(b) { must(await db.from('staff').update({ pass_hash: pass(b.password), fail_count: 0, locked_until: null }).eq('id', b.id)); return {}; },
  async deleteStaff(b) { must(await db.from('staff').delete().eq('id', b.id)); return {}; },

  // ---------- kupon ----------
  async coupons() {
    const c = must(await db.from('coupon_types').select('id,nama,urutan').order('urutan').order('id')).data;
    const used = await Promise.all(c.map((x) => n(head('redemptions').eq('coupon_type_id', x.id))));
    return { coupons: c.map((x, i) => ({ ...x, used: used[i] })) };
  },
  async addCoupon(b) {
    const nama = clean(b.nama); if (!nama) throw new Error('Nama kupon wajib diisi');
    const last = must(await db.from('coupon_types').select('urutan').order('urutan', { ascending: false }).limit(1)).data[0];
    must(await db.from('coupon_types').insert({ nama, urutan: (last?.urutan || 0) + 1 })); return {};
  },
  async renameCoupon(b) { const nama = clean(b.nama); if (!nama) throw new Error('Nama kupon wajib diisi'); must(await db.from('coupon_types').update({ nama }).eq('id', b.id)); return {}; },
  async deleteCoupon(b) { must(await db.from('coupon_types').delete().eq('id', b.id)); return {}; },

  // ---------- hadiah & pemenang ----------
  async prizes() {
    const [p, d] = await Promise.all([db.from('prizes').select('id,nama,stok').order('id'), db.from('draws').select('prize_id,status')]);
    must(p); must(d);
    const won = {}; d.data.forEach((x) => { if (x.status !== 'forfeited') won[x.prize_id] = (won[x.prize_id] || 0) + 1; });
    return { prizes: p.data.map((x) => ({ ...x, won: won[x.id] || 0 })) };
  },
  async addPrize(b) {
    const nama = clean(b.nama); if (!nama) throw new Error('Nama hadiah wajib diisi');
    must(await db.from('prizes').insert({ nama, stok: Math.max(Number(b.stok) || 1, 1) })); return {};
  },
  async updatePrize(b) {
    const nama = clean(b.nama); if (!nama) throw new Error('Nama hadiah wajib diisi');
    must(await db.from('prizes').update({ nama, stok: Math.max(Number(b.stok) || 1, 1) }).eq('id', b.id)); return {};
  },
  async deletePrize(b) { must(await db.from('prizes').delete().eq('id', b.id)); return {}; },
  async winners() {
    return { draws: must(await db.from('draws').select('id,status,drawn_at,prizes(nama),employees(nama,nik,cabang,divisi)').order('drawn_at', { ascending: false }).limit(500)).data };
  },
  async forfeit(b) { must(await db.from('draws').update({ status: 'forfeited' }).eq('id', b.draw_id)); return {}; },

  // ---------- layar undian ----------
  async stageInfo() {
    const [prizes, hadir, el, recent] = await Promise.all([
      H.prizes(), n(head('employees').not('checked_in_at', 'is', null)), db.rpc('eligible_count'),
      must(await db.from('draws').select('id,status,prizes(nama),employees(nama,nik)').order('drawn_at', { ascending: false }).limit(8)).data,
    ]);
    if (el.error) throw new Error(MIGRATE_MSG);
    return { prizes: prizes.prizes, eligible: el.data || 0, hadir, recent };
  },
  async draw(b) {
    const pid = Number(b.prize_id);
    const w = await db.rpc('draw_winner', { p_prize: pid });
    if (w.error) throw new Error(/function|does not exist|schema cache/i.test(w.error.message) ? MIGRATE_MSG : w.error.message);
    const win = w.data[0];
    const [dc, dv] = await Promise.all([db.rpc('wheel_candidates', { p_n: 17, p_prize: pid }), db.from('employees').select('divisi').eq('id', win.w_id).maybeSingle()]);
    return {
      winner: { draw_id: win.w_draw, nama: win.w_nama, nik: win.w_nik, cabang: win.w_cabang, divisi: dv.data?.divisi || null },
      decoys: (dc.data || []).filter((x) => x.c_nik !== win.w_nik).map((x) => ({ nama: x.c_nama, nik: x.c_nik })),
    };
  },

  // ---------- survey ----------
  async survey() {
    const questions = sv(await db.from('survey_questions').select('id,tipe,teks,wajib,opsi,lainnya,label_min,label_maks').order('urutan').order('id')).data;
    const rows = [];
    for (let i = 0; ; i += 1000) {
      const r = sv(await db.from('survey_responses').select('id,jawaban,updated_at,employees(nik,nama,cabang,divisi)').order('updated_at').order('id').range(i, i + 999)).data;
      rows.push(...r); if (r.length < 1000) break;
    }
    const [open, total] = await Promise.all([surveyOpen(), n(head('employees'))]);
    return { open, total, questions, responses: rows.map((r) => ({ ...r.employees, jawaban: r.jawaban, at: r.updated_at })) };
  },
  async setSurveyOpen(b) { must(await db.from('settings').upsert({ key: 'survey_open', value: b.open ? '1' : '0' }, { onConflict: 'key' })); return {}; },
  async addSurveyQuestion(b) {
    const q = cleanQuestion(b);
    const last = sv(await db.from('survey_questions').select('urutan').order('urutan', { ascending: false }).limit(1)).data[0];
    sv(await db.from('survey_questions').insert({ ...q, urutan: (last?.urutan || 0) + 1 })); return {};
  },
  async updateSurveyQuestion(b) {
    const r = sv(await db.from('survey_questions').update(cleanQuestion(b)).eq('id', Number(b.id)).select('id'));
    if (!r.data.length) throw new Error('Pertanyaan tidak ditemukan');
    return {};
  },
  async deleteSurveyQuestion(b) { sv(await db.from('survey_questions').delete().eq('id', Number(b.id))); return {}; },

  // ---------- riwayat aktivitas ----------
  async history(b) {
    const size = Math.min(Math.max(Number(b.size) || 30, 10), 100);
    const page = Math.max(Number(b.page) || 1, 1), from = (page - 1) * size;
    let q = db.from('activity_log').select('id,created_at,actor,actor_role,kategori,aksi,ringkas,ok', { count: 'exact' });
    if (b.kategori) q = q.eq('kategori', String(b.kategori));
    if (b.status === 'ok') q = q.eq('ok', true);
    if (b.status === 'gagal') q = q.eq('ok', false);
    const s = like(b.q);
    if (s) q = q.or(`ringkas.ilike.%${s}%,actor.ilike.%${s}%`);
    const r = await q.order('created_at', { ascending: false }).order('id', { ascending: false }).range(from, from + size - 1);
    if (r.error) {
      if (/does not exist|schema cache/i.test(r.error.message || '')) throw new Error('Tabel riwayat belum dibuat. Buka Supabase > SQL Editor, jalankan supabase/migration-v4.sql, lalu muat ulang halaman ini.');
      throw new Error(r.error.message);
    }
    const since = new Date(Date.now() - 864e5).toISOString();
    const day = await db.from('activity_log').select('*', { count: 'exact', head: true }).gte('created_at', since);
    return { rows: r.data, total: r.count || 0, page, size, last24: day.count || 0 };
  },

  // ---------- pengaturan acara ----------
  async getSettings() { return { settings: await getSettings() }; },
  async saveSettings(b) {
    const mp = Number(b.settings?.max_prizes_per_employee || 1);
    if (!Number.isInteger(mp) || mp < 1 || mp > 100) throw new Error('Jatah hadiah per karyawan harus angka bulat 1 sampai 100');
    const rows = Object.keys(DEFAULTS).map((key) => ({ key, value: key === 'max_prizes_per_employee' ? String(mp) : clean(b.settings?.[key]) }));
    must(await db.from('settings').upsert(rows, { onConflict: 'key' })); return {};
  },
};

// Catatan riwayat untuk tiap aksi yang mengubah data: [kategori, (body, hasil, konteks) => kalimat]
const nm = (c) => c.emp?.nama || c.nik || 'peserta';
const LOGS = {
  checkinManual: ['checkin', (b, r, c) => `Check-in manual ${nm(c)}`],
  addEmployee: ['peserta', (b) => `Menambah peserta ${clean(b.nama)} (NIK ${clean(b.nik)})`],
  updateEmployee: ['peserta', (b) => `Mengubah data peserta ${clean(b.nama)} (NIK ${clean(b.nik)})`],
  deleteEmployee: ['peserta', (b, r, c) => `Menghapus peserta ${nm(c)}`],
  resetKupon: ['peserta', (b, r, c) => `Reset kupon ${nm(c)}` + (b.kupon_nama ? ` (${String(b.kupon_nama).slice(0, 40)})` : ' (semua kupon)') + `: ${r.removed} catatan dihapus`],
  resetUndian: ['undian', (b, r, c) => `Reset undian ${nm(c)}` + (b.hadiah_nama ? ` (${String(b.hadiah_nama).slice(0, 40)})` : ' (semua undian)') + `: ${r.removed} catatan dihapus`],
  redeemManual: ['redeem', (b, r, c) => `Redeem manual ${String(b.kupon_nama || '').slice(0, 40)} ${nm(c)} (admin)`],
  changeKupon: ['redeem', (b, r, c) => `Ubah kupon ${nm(c)}: ${String(b.dari_nama || '').slice(0, 40)} menjadi ${String(b.ke_nama || '').slice(0, 40)}`],
  resetCheckin: ['checkin', (b, r, c) => `Reset check-in ${nm(c)}`],
  resetPeserta: ['peserta', (b, r, c) => `Reset password peserta ${nm(c)}`],
  import: ['peserta', (b, r) => `Import Excel: ${r.imported} peserta` + (r.skipped ? `, ${r.skipped} dilewati` : '') + (r.duplicates ? `, ${r.duplicates} NIK ganda` : '')],
  deleteAllEmployees: ['peserta', (b, r) => `Menghapus SEMUA peserta (${r.removed} peserta, beserta kupon dan undiannya)`],
  exportEmployees: ['peserta', (b, r) => `Ekspor Excel (${r.rows?.length || 0} peserta)`],
  addStaff: ['panitia', (b) => `Menambah akun panitia ${clean(b.username).toLowerCase()}`],
  toggleStaff: ['panitia', (b, r, c) => `${b.aktif ? 'Mengaktifkan' : 'Menonaktifkan'} panitia ${c.staff?.username || ''}`],
  resetStaff: ['panitia', (b, r, c) => `Mengganti password panitia ${c.staff?.username || ''}`],
  deleteStaff: ['panitia', (b, r, c) => `Menghapus akun panitia ${c.staff?.username || ''}`],
  addCoupon: ['kupon', (b) => `Menambah kupon ${clean(b.nama)}`],
  renameCoupon: ['kupon', (b, r, c) => `Mengubah nama kupon ${c.coupon?.nama || ''} menjadi ${clean(b.nama)}`],
  deleteCoupon: ['kupon', (b, r, c) => `Menghapus kupon ${c.coupon?.nama || ''}`],
  addPrize: ['hadiah', (b) => `Menambah hadiah ${clean(b.nama)} (jumlah ${Math.max(Number(b.stok) || 1, 1)})`],
  updatePrize: ['hadiah', (b) => `Mengubah hadiah ${clean(b.nama)} (jumlah ${Math.max(Number(b.stok) || 1, 1)})`],
  deletePrize: ['hadiah', (b, r, c) => `Menghapus hadiah ${c.prize?.nama || ''}`],
  draw: ['undian', (b, r, c) => `Undian ${c.prize?.nama || 'hadiah'}: pemenang ${r.winner?.nama}`],
  forfeit: ['undian', (b, r, c) => `${c.draw?.employees?.nama || 'Pemenang'} ditandai tidak hadir (${c.draw?.prizes?.nama || 'hadiah'}), stok kembali`],
  saveSettings: ['pengaturan', () => 'Menyimpan pengaturan acara'],
  setSurveyOpen: ['survey', (b) => `${b.open ? 'Membuka' : 'Menutup'} survey acara`],
  addSurveyQuestion: ['survey', (b) => `Menambah pertanyaan survey: ${clean(b.teks).slice(0, 80)}`],
  updateSurveyQuestion: ['survey', (b) => `Mengubah pertanyaan survey: ${clean(b.teks).slice(0, 80)}`],
  deleteSurveyQuestion: ['survey', (b) => `Menghapus pertanyaan survey: ${clean(b.teks).slice(0, 80)}`],
};

// Ambil nama yang dibutuhkan untuk kalimat riwayat sebelum aksi menghapus atau mengubahnya
const context = async (b) => {
  const c = { nik: clean(b.nik) };
  try {
    const t = [];
    if (b.nik) t.push(db.from('employees').select('nama').eq('nik', clean(b.nik)).maybeSingle().then((r) => { c.emp = r.data; }));
    if (b.action === 'draw' || b.action === 'deletePrize') t.push(db.from('prizes').select('nama').eq('id', Number(b.prize_id || b.id)).maybeSingle().then((r) => { c.prize = r.data; }));
    if (b.action === 'forfeit') t.push(db.from('draws').select('prizes(nama),employees(nama)').eq('id', b.draw_id).maybeSingle().then((r) => { c.draw = r.data; }));
    if (b.action === 'renameCoupon' || b.action === 'deleteCoupon') t.push(db.from('coupon_types').select('nama').eq('id', b.id).maybeSingle().then((r) => { c.coupon = r.data; }));
    if (/Staff$/.test(b.action)) t.push(db.from('staff').select('username').eq('id', b.id).maybeSingle().then((r) => { c.staff = r.data; }));
    await Promise.all(t);
  } catch {}
  return c;
};

export async function POST(req) {
  if ((await role(req)) !== 'admin') return json({ error: 'Khusus admin' }, 401);
  let b; try { b = await req.json(); } catch { return json({ error: 'Request tidak valid' }, 400); }
  const h = Object.hasOwn(H, b.action) ? H[b.action] : null;
  if (!h) return json({ error: 'Aksi tidak dikenal' }, 400);
  const lg = Object.hasOwn(LOGS, b.action) ? LOGS[b.action] : null;
  const ctx = lg ? await context(b) : null;
  try {
    const res = await h(b);
    if (lg) { const ringkas = lg[1](b, res, ctx); after(async () => { await logAct(await actorOf(req), { kategori: lg[0], aksi: b.action, ringkas }); }); }
    return json(res);
  } catch (e) { return json({ error: e.message || 'Server error' }, 400); }
}
