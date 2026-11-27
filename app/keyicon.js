// Ikon kunci pixel (dipakai di tiket peserta, halaman admin Kamar, dan layar scan). Warna mengikuti teks sekitarnya.
const G = ['.XXX........', 'X...X.......', 'X...XXXXXXXX', 'X...X..X.X.X', '.XXX........'];
const D = G.flatMap((row, y) => [...row].map((c, x) => (c === 'X' ? `M${x} ${y}h1v1h-1z` : ''))).join('');
export default function KeyIcon({ size = 16, label }) {
  return (
    <svg className="keyi" viewBox="0 0 12 5" width={Math.round(size * 2.4)} height={size} shapeRendering="crispEdges" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : 'true'}>
      <path d={D} fill="currentColor" />
    </svg>
  );
}
