'use client';
import { useState } from 'react';

// Ikon mata gaya pixel pada kisi 11 x 7. Tiap item: [x, y, lebar]. Satu sel = 3px supaya tegas di layar HP maupun laptop.
const EYE = [[3, 0, 5], [1, 1, 2], [8, 1, 2], [0, 2, 1], [4, 2, 3], [10, 2, 1], [0, 3, 1], [3, 3, 5], [10, 3, 1], [0, 4, 1], [4, 4, 3], [10, 4, 1], [1, 5, 2], [8, 5, 2], [3, 6, 5]];
// Coretan diagonal untuk keadaan "password sedang terlihat" (tekan untuk menyembunyikan)
const SLASH = [[1, 6, 2], [2, 5, 2], [3, 4, 2], [4, 3, 3], [6, 2, 2], [7, 1, 2], [8, 0, 2]];

function Eye({ off }) {
  return (
    <svg viewBox="0 0 11 7" width="33" height="21" shapeRendering="crispEdges" aria-hidden="true" focusable="false">
      {EYE.map(([x, y, w], i) => <rect key={i} x={x} y={y} width={w} height="1" fill="#000" />)}
      {off && SLASH.map(([x, y, w], i) => <rect key={'h' + i} x={x} y={y} width={w} height="1" fill="#fff" stroke="#fff" strokeWidth="1" />)}
      {off && SLASH.map(([x, y, w], i) => <rect key={'s' + i} x={x} y={y} width={w} height="1" fill="#000" />)}
    </svg>
  );
}

// Kolom password dengan tombol lihat/sembunyikan. Semua props lain diteruskan ke <input>.
export default function PwField(props) {
  const [show, setShow] = useState(false);
  return (
    <div className="pw">
      <input {...props} type={show ? 'text' : 'password'} />
      <button type="button" className="pw-eye" onClick={() => setShow((s) => !s)} aria-pressed={show}
        aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'} title={show ? 'Sembunyikan password' : 'Tampilkan password'}>
        <Eye off={show} />
      </button>
    </div>
  );
}
