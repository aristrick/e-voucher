'use client';
import { useState } from 'react';

// Hujan confetti sekitar 6 detik; tidak menghalangi sentuhan, disembunyikan jika perangkat meminta animasi dikurangi
const COLORS = ['#FF6B9D', '#FFD84D', '#5CC8FF', '#A66CFF', '#C8E64A', '#FF5A4D'];
export default function Confetti({ n = 70 }) {
  const [p] = useState(() => Array.from({ length: n }, (_, i) => {
    const round = false, size = 8 + Math.floor(Math.random() * 3) * 4;
    return { left: Math.random() * 100, w: size, h: i % 3 === 0 ? size : size / 2, round, c: COLORS[i % COLORS.length],
      delay: Math.random() * 1.2, dur: 2.8 + Math.random() * 2.2, dx: (Math.random() - 0.5) * 160, rot: Math.random() * 360 };
  }));
  return (
    <div className="confetti" aria-hidden="true">
      {p.map((x, i) => <i key={i} style={{ left: x.left + '%', width: x.w, height: x.h, background: x.c, borderRadius: 0, imageRendering: 'pixelated', animationDelay: x.delay + 's', animationDuration: x.dur + 's', '--dx': x.dx + 'px', '--r': x.rot + 'deg' }} />)}
    </div>
  );
}
