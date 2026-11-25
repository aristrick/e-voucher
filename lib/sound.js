// Efek suara dibuat langsung dengan Web Audio (tanpa file mp3), hanya dipanggil dari browser.
// Browser mewajibkan suara dimulai setelah pengguna menyentuh layar, jadi panggil unlock() saat tombol ditekan.
let ctx = null, muted = false, lastTick = 0;
try { muted = localStorage.getItem('mute') === '1'; } catch {}

const ac = () => {
  if (typeof window === 'undefined') return null;
  if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ctx = new C(); }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
};
export const unlock = () => { ac(); };
export const isMuted = () => muted;
export const setMuted = (m) => { muted = !!m; try { localStorage.setItem('mute', m ? '1' : '0'); } catch {} };

// satu nada dengan awal cepat dan akhir meredup (seperti denting lonceng kecil)
function note(a, { f, t = 0, dur = 0.5, vol = 0.2, type = 'sine', f2 }) {
  const o = a.createOscillator(), g = a.createGain(), t0 = a.currentTime + t;
  o.type = type; o.frequency.setValueAtTime(f, t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(a.destination); o.start(t0); o.stop(t0 + dur + 0.05);
}
function noise(a, { t = 0, dur = 0.05, vol = 0.1, f = 2500, q = 1.2, f2 }) {
  const n = Math.max(1, Math.floor(a.sampleRate * dur)), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = a.createBufferSource(), flt = a.createBiquadFilter(), g = a.createGain(), t0 = a.currentTime + t;
  s.buffer = buf; flt.type = 'bandpass'; flt.Q.value = q; flt.frequency.setValueAtTime(f, t0);
  if (f2) flt.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(flt); flt.connect(g); g.connect(a.destination); s.start(t0);
}
const play = (fn) => { if (muted) return; try { const a = ac(); if (a) fn(a); } catch {} };

// Scan berhasil: dua denting tinggi yang naik, mirip bunyi pembayaran Apple Pay
export const success = () => play((a) => {
  note(a, { f: 1568, dur: 0.38, vol: 0.2 }); note(a, { f: 3136, dur: 0.2, vol: 0.05 });
  note(a, { f: 2093, t: 0.1, dur: 0.75, vol: 0.22 }); note(a, { f: 4186, t: 0.1, dur: 0.3, vol: 0.05 });
  note(a, { f: 2637, t: 0.1, dur: 0.55, vol: 0.06 });
});

// Scan gagal: dua nada rendah turun
export const fail = () => play((a) => {
  note(a, { f: 330, dur: 0.18, vol: 0.18, type: 'triangle' });
  note(a, { f: 220, t: 0.16, dur: 0.32, vol: 0.2, type: 'triangle' });
});

// Awal putaran roda: desis angin yang naik
export const spinStart = () => play((a) => {
  noise(a, { dur: 0.9, vol: 0.12, f: 400, f2: 3200, q: 0.8 });
  note(a, { f: 180, f2: 520, dur: 0.6, vol: 0.06, type: 'sawtooth' });
});

// Setiap segmen melewati penunjuk: bunyi "tak" pengait roda. Nada bervariasi sedikit supaya tidak monoton.
export const tick = () => play((a) => {
  const now = performance.now(); if (now - lastTick < 22) return; lastTick = now;
  const v = 1 + (Math.random() - 0.5) * 0.12;
  noise(a, { dur: 0.03, vol: 0.16, f: 2800 * v, q: 2.2 });
  note(a, { f: 760 * v, f2: 420, dur: 0.05, vol: 0.12, type: 'triangle' });
});

// Roda berhenti dan pemenang muncul: fanfare pendek
export const win = () => play((a) => {
  [523, 659, 784, 1047].forEach((f, i) => note(a, { f, t: i * 0.11, dur: 0.35, vol: 0.18, type: 'triangle' }));
  [523, 659, 784, 1047].forEach((f) => note(a, { f, t: 0.5, dur: 1.1, vol: 0.1, type: 'triangle' }));
  [2093, 2637, 3136, 4186].forEach((f, i) => note(a, { f, t: 0.55 + i * 0.07, dur: 0.4, vol: 0.04 }));
});
