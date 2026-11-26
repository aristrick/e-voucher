import { shapeRects, PX_ORDER, PX_SIZE } from '@/lib/pixel';

// Empat ikon pixel (kotak, segitiga, silang, lingkaran) untuk hiasan pita tiket.
export default function PxIcons({ size = 18 }) {
  return (
    <span className="pxi" aria-hidden="true">
      {PX_ORDER.map((n) => (
        <svg key={n} width={size} height={size} viewBox={`0 0 ${PX_SIZE} ${PX_SIZE}`} shapeRendering="crispEdges">
          {shapeRects(n).map((r, i) => <rect key={i} x={r.x} y={r.y} width={r.w} height="1" fill={r.c} />)}
        </svg>
      ))}
    </span>
  );
}
