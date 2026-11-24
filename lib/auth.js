import crypto from 'crypto';
const key = () => process.env.SESSION_SECRET || '';
const mac = (b) => crypto.createHmac('sha256', key()).update(b).digest('base64url');
export const hash = (pw) => { const s = crypto.randomBytes(16).toString('hex'); return s + ':' + crypto.scryptSync(pw, s, 32).toString('hex'); };
export const check = (pw, h) => {
  if (!h) return false;
  const [s, x] = h.split(':'); const y = crypto.scryptSync(pw, s, 32).toString('hex');
  return x.length === y.length && crypto.timingSafeEqual(Buffer.from(x), Buffer.from(y));
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
export const cookie = (v, max = 86400) => `sess=${v}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${max}`;
