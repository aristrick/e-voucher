import crypto from 'crypto';
const key = () => process.env.SESSION_SECRET || '';
const mac = (b) => crypto.createHmac('sha256', key()).update(b).digest('base64url');
export const hash = (pw) => { const s = crypto.randomBytes(16).toString('hex'); return s + ':' + crypto.scryptSync(pw, s, 32).toString('hex'); };
export const check = (pw, h) => {
  if (!h) return false;
  const [s, x] = h.split(':'); const y = crypto.scryptSync(pw, s, 32).toString('hex');
  return x.length === y.length && crypto.timingSafeEqual(Buffer.from(x), Buffer.from(y));
};
// bandingkan dua teks tanpa bocor lewat waktu respons
export const same = (a, b) => {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
};
export const sign = (o) => { const b = Buffer.from(JSON.stringify({ ...o, exp: Date.now() + 864e5 })).toString('base64url'); return b + '.' + mac(b); };
export const read = (req) => {
  try {
    const c = (req.headers.get('cookie') || '').split('; ').find((x) => x.startsWith('sess='));
    if (!c || !key()) return null;
    const [b, m] = c.slice(5).split('.');
    if (!b || m !== mac(b)) return null;
    const o = JSON.parse(Buffer.from(b, 'base64url').toString());
    return o.exp > Date.now() ? o : null;
  } catch { return null; }
};
// Secure hanya di production supaya login tetap jalan di http://localhost (Safari menolak cookie Secure)
export const cookie = (v, max = 86400) => `sess=${v}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${max}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;

// Pembatas percobaan per instance (cadangan untuk login admin yang tidak punya baris di database)
const hits = new Map();
export const blocked = (k, max = 8, win = 15 * 60 * 1000) => {
  const now = Date.now(); const a = (hits.get(k) || []).filter((t) => now - t < win);
  hits.set(k, a); return a.length >= max;
};
export const miss = (k) => { hits.set(k, [...(hits.get(k) || []), Date.now()]); };
