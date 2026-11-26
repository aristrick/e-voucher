'use client';
import { useState } from 'react';

// Ikon mata gaya pixel (kotak-kotak, sesuai tema). [x, y, lebar] per baris pada kisi 13 x 7.
const EYE = [[3, 0, 7], [1, 1, 2], [10, 1, 2], [0, 2, 1], [12, 2, 1], [5, 2, 3], [0, 3, 1], [12, 3, 1], [4, 3, 5], [0, 4, 1], [12, 4, 1], [5, 4, 3], [1, 5, 2], [10, 5, 2], [3, 6, 7]];
const SLASH = [[1, 6, 2], [3, 5, 2], [5, 4, 1], [6, 3, 2], [8, 2, 1], [9, 1, 2], [11, 0, 2]];

function Eye({ off }) {
  return (
    <svg viewBox="0 0 13 7" width="26" height="14" shapeRendering="crispEdges" aria-hidden="true" focusable="false">
      {EYE.map(([x, y, w], i) => <rect key={i} x={x} y={y} width={w} height="1" fill="#000" />)}
      {off && SLASH.map(([x, y, w], i) => <rect key={'s' + i} x={x} y={y} width={w} height="1" fill="#E5252A" />)}
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
