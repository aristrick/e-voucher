// Import dan ekspor Excel (.xlsx). Hanya dipanggil dari browser.
import { wib } from './client';

const lib = () => import('exceljs').then((m) => m.default || m);
const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const save = (buf, name) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([buf], { type: MIME })); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
};
const style = (ws, cols) => {
  ws.columns = cols.map(([header, key, width]) => ({ header, key, width }));
  const h = ws.getRow(1);
  h.font = { bold: true }; h.alignment = { vertical: 'middle' };
  h.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD84D' } }; c.border = { bottom: { style: 'medium' } }; });
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
};

// Template kosong untuk import: kolom NIK, Nama, Divisi, Cabang
export async function downloadTemplate() {
  const wb = new (await lib()).Workbook(), ws = wb.addWorksheet('Peserta');
  style(ws, [['NIK', 'nik', 18], ['Nama', 'nama', 32], ['Divisi', 'divisi', 24], ['Cabang', 'cabang', 24]]);
  ws.getColumn('nik').numFmt = '@';
  ws.addRow({ nik: '20190342', nama: 'Budi Santoso', divisi: 'Sales', cabang: 'Jakarta Barat' });
  ws.addRow({ nik: '20190343', nama: 'Siti Aminah', divisi: 'Finance', cabang: 'Bekasi' });
  save(await wb.xlsx.writeBuffer(), 'template-peserta.xlsx');
}

// Baca file Excel: kolom NIK, Nama, Divisi, Cabang (judul kolom di baris 1 boleh ada atau tidak; "Devisi" juga dikenali)
export async function readPeserta(file) {
  const wb = new (await lib()).Workbook();
  try { await wb.xlsx.load(await file.arrayBuffer()); } catch { throw new Error('File tidak bisa dibaca. Pakai file Excel berformat .xlsx'); }
  const ws = wb.worksheets[0];
  if (!ws) throw new Error('File Excel kosong');
  const txt = (c) => String(c?.text ?? '').trim();
  const map = {};
  ws.getRow(1).eachCell((c, i) => { const t = txt(c).toLowerCase(); if (t === 'devisi') map.divisi = i; else if (['nik', 'nama', 'divisi', 'cabang'].includes(t)) map[t] = i; });
  const hasHead = !!(map.nik && map.nama);
  const col = hasHead ? { nik: map.nik, nama: map.nama, divisi: map.divisi || 0, cabang: map.cabang || 0 } : { nik: 1, nama: 2, divisi: 3, cabang: 4 };
  const rows = [];
  for (let r = hasHead ? 2 : 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const nik = txt(row.getCell(col.nik)), nama = txt(row.getCell(col.nama));
    if (!nik && !nama) continue;
    rows.push({ nik, nama, divisi: col.divisi ? txt(row.getCell(col.divisi)) : '', cabang: col.cabang ? txt(row.getCell(col.cabang)) : '' });
  }
  return rows;
}

// Ekspor: satu kolom per data, tanggal dan jam dipisah, tiap kupon punya kolom sendiri
export async function exportPeserta({ rows, coupons }) {
  const wb = new (await lib()).Workbook(), ws = wb.addWorksheet('Peserta');
  const cols = [['No', 'no', 6], ['NIK', 'nik', 16], ['Nama', 'nama', 30], ['Divisi', 'divisi', 22], ['Cabang', 'cabang', 22], ['No HP', 'hp', 16], ['Akun Aktif', 'aktif', 12],
    ['Status Check-in', 'status', 16], ['Tanggal Check-in', 'cin_tgl', 18], ['Jam Check-in (WIB)', 'cin_jam', 18]];
  coupons.forEach((c) => cols.push([`${c.nama} - Status`, `s${c.id}`, 16], [`${c.nama} - Tanggal`, `t${c.id}`, 18], [`${c.nama} - Jam (WIB)`, `j${c.id}`, 18]));
  cols.push(['Jatah Hadiah', 'jatah', 14], ['Hadiah Dimenangkan', 'hadiah', 30]);
  style(ws, cols);
  ['nik', 'hp'].forEach((k) => { ws.getColumn(k).numFmt = '@'; });
  rows.forEach((e, i) => {
    const c = wib(e.checked_in_at);
    const o = { no: i + 1, nik: String(e.nik), nama: e.nama, divisi: e.divisi || '', cabang: e.cabang || '', hp: e.hp || '', aktif: e.aktif ? 'Ya' : 'Belum',
      status: e.checked_in_at ? 'Sudah check-in' : 'Belum', cin_tgl: c.tgl, cin_jam: c.jam, jatah: e.max_hadiah || '', hadiah: (e.hadiah || []).join(', ') };
    coupons.forEach((k) => { const t = wib(e.redeemed?.[k.id]); o['s' + k.id] = t.tgl ? 'Sudah ditukar' : 'Belum'; o['t' + k.id] = t.tgl; o['j' + k.id] = t.jam; });
    ws.addRow(o);
  });
  save(await wb.xlsx.writeBuffer(), `peserta-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// Ekspor survey: satu baris per peserta yang mengisi, satu kolom per pertanyaan
export async function exportSurvey({ questions, responses }) {
  const wb = new (await lib()).Workbook(), ws = wb.addWorksheet('Survey');
  const cols = [['No', 'no', 6], ['NIK', 'nik', 16], ['Nama', 'nama', 30], ['Divisi', 'divisi', 22], ['Cabang', 'cabang', 22], ['Tanggal Isi', 'tgl', 18], ['Jam Isi (WIB)', 'jam', 16]];
  questions.forEach((q) => cols.push([q.teks, 'q' + q.id, q.tipe === 'teks' ? 48 : 24]));
  style(ws, cols);
  ws.getColumn('nik').numFmt = '@';
  responses.forEach((r, i) => {
    const t = wib(r.at);
    const o = { no: i + 1, nik: String(r.nik || ''), nama: r.nama || '', divisi: r.divisi || '', cabang: r.cabang || '', tgl: t.tgl, jam: t.jam };
    questions.forEach((q) => { o['q' + q.id] = r.jawaban?.[q.id] ?? ''; });
    ws.addRow(o);
  });
  ws.eachRow((row) => row.eachCell((c) => { c.alignment = { vertical: 'top', wrapText: true }; }));
  save(await wb.xlsx.writeBuffer(), `survey-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ---------- pembagian kamar ----------
// Template import kamar: kolom NIK, Nama Peserta, Nomor Kamar, Nama Kamar (satu peserta per baris)
export async function downloadTemplateKamar() {
  const wb = new (await lib()).Workbook(), ws = wb.addWorksheet('Kamar');
  style(ws, [['NIK', 'nik', 18], ['Nama Peserta', 'peserta', 30], ['Nomor Kamar', 'nomor', 16], ['Nama Kamar', 'nama', 26]]);
  ['nik', 'nomor'].forEach((k) => { ws.getColumn(k).numFmt = '@'; });
  ws.addRow({ nik: '20190342', peserta: 'Budi Santoso', nomor: '101', nama: 'Melati' });
  ws.addRow({ nik: '20190343', peserta: 'Siti Aminah', nomor: '101', nama: 'Melati' });
  ws.addRow({ nik: '20190344', peserta: 'Andi Wijaya', nomor: '102', nama: 'Anggrek' });
  save(await wb.xlsx.writeBuffer(), 'template-kamar.xlsx');
}

// Baca file Excel pembagian kamar: kolom NIK, Nama Peserta, Nomor Kamar, Nama Kamar (judul di baris 1 boleh ada atau tidak)
export async function readKamar(file) {
  const wb = new (await lib()).Workbook();
  try { await wb.xlsx.load(await file.arrayBuffer()); } catch { throw new Error('File tidak bisa dibaca. Pakai file Excel berformat .xlsx'); }
  const ws = wb.worksheets[0];
  if (!ws) throw new Error('File Excel kosong');
  const txt = (c) => String(c?.text ?? c?.value ?? '').trim();
  const map = {};
  ws.getRow(1).eachCell((c, i) => {
    const t = txt(c).toLowerCase().replace(/\s+/g, ' ');
    if (t === 'nik') map.nik = i;
    else if (['nomor kamar', 'no kamar', 'no. kamar', 'nomor'].includes(t)) map.nomor = i;
    else if (t === 'nama kamar') map.nama = i;
    else if (['nama peserta', 'nama karyawan', 'nama'].includes(t)) map.peserta = i;
  });
  const hasHead = !!(map.nik && map.nomor);
  const col = hasHead ? { nik: map.nik, peserta: map.peserta || 0, nomor: map.nomor, nama: map.nama || 0 } : { nik: 1, peserta: 2, nomor: 3, nama: 4 };
  const rows = [];
  for (let r = hasHead ? 2 : 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const nik = txt(row.getCell(col.nik)), nomor = txt(row.getCell(col.nomor));
    if (!nik && !nomor) continue;
    rows.push({ nik, peserta: col.peserta ? txt(row.getCell(col.peserta)) : '', nomor, nama: col.nama ? txt(row.getCell(col.nama)) : '' });
  }
  return rows;
}

// Ekspor pembagian kamar: satu baris per penghuni, urut kamar lalu nama; peserta yang belum dapat kamar tidak ikut
export async function exportKamar({ rooms }) {
  const wb = new (await lib()).Workbook(), ws = wb.addWorksheet('Kamar');
  style(ws, [['No', 'no', 6], ['Nomor Kamar', 'nomor', 14], ['Nama Kamar', 'knama', 22], ['Catatan', 'catatan', 24], ['Kapasitas', 'kap', 12], ['NIK', 'nik', 16], ['Nama Peserta', 'nama', 30], ['Divisi', 'divisi', 22], ['Cabang', 'cabang', 22]]);
  ['nik', 'nomor'].forEach((k) => { ws.getColumn(k).numFmt = '@'; });
  let i = 0;
  rooms.forEach((r) => {
    const base = { nomor: String(r.nomor), knama: r.nama || '', catatan: r.catatan || '', kap: r.kapasitas || '' };
    if (!r.penghuni.length) { ws.addRow({ no: ++i, ...base }); return; }
    r.penghuni.forEach((p) => ws.addRow({ no: ++i, ...base, nik: String(p.nik), nama: p.nama, divisi: p.divisi || '', cabang: p.cabang || '' }));
  });
  save(await wb.xlsx.writeBuffer(), `kamar-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
