export const dynamic = 'force-dynamic';
export async function GET() {
  const names = ['SESSION_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ADMIN_PIN'];
  const out = {};
  for (const n of names) out[n] = process.env[n] ? 'ADA (' + process.env[n].length + ' karakter)' : 'KOSONG';
  return Response.json(out);
}
