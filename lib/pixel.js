// Gambar pixel untuk ikon: kotak, segitiga, silang, lingkaran (gaya tombol konsol).
// Setiap bentuk dibuat dari grid 11x11, lalu diberi garis tepi hitam satu kotak.
export const PX_COLORS = { kotak: '#C77DE0', segitiga: '#5ED08A', silang: '#5B82E0', bulat: '#E5252A' };
export const PX_ORDER = ['kotak', 'segitiga', 'silang', 'bulat'];
const N = 11;
const fillOf = {
  kotak: (x, y) => x >= 1 && x <= 9 && y >= 1 && y <= 9 && !(x >= 3 && x <= 7 && y >= 3 && y <= 7),
  segitiga: (x, y) => {
    if (y < 1 || y > 9) return false;
    const hw = Math.floor(y / 2);
    if (x < 5 - hw || x > 5 + hw) return false;
    return !((x === 5 && y === 6) || (y === 7 && x >= 4 && x <= 6));
  },
  silang: (x, y) => x >= 1 && x <= 9 && y >= 1 && y <= 9 && (Math.abs(x - y) <= 1 || Math.abs(x + y - 10) <= 1),
  bulat: (x, y) => { const d = Math.hypot(x - 5, y - 5); return d >= 2.4 && d <= 4.6; },
};
// Kembalikan daftar kotak [x, y, lebar, warna] per baris, sudah digabung agar tidak ada celah tipis.
export function shapeRects(name) {
  const f = fillOf[name], out = [];
  const isF = (x, y) => x >= 0 && y >= 0 && x < N && y < N && f(x, y);
  for (let y = 0; y < N; y++) {
    let run = null;
    const push = () => { if (run) out.push(run); run = null; };
    for (let x = 0; x < N; x++) {
      const c = isF(x, y) ? PX_COLORS[name] : (isF(x - 1, y) || isF(x + 1, y) || isF(x, y - 1) || isF(x, y + 1)) ? '#000' : null;
      if (c && run && run.c === c) run.w++;
      else { push(); if (c) run = { x, y, w: 1, c }; }
    }
    push();
  }
  return out;
}
export const PX_SIZE = N;
