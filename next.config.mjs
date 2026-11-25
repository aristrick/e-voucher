/** @type {import('next').NextConfig} */
const nextConfig = {
  // Izinkan perangkat lain di jaringan yang sama membuka `npm run dev` lewat IP komputer ini.
  // Tanpa ini, Next.js memblokir file JavaScript dari alamat selain localhost,
  // sehingga halaman macet di tulisan "Memuat...".
  allowedDevOrigins: ['10.16.13.97', '10.16.*.*', '192.168.*.*'],
  experimental: {
    // Matikan cache disk Turbopack saat `npm run dev`: cache inilah yang membuat
    // JavaScript browser versi lama muncul lagi setelah server di-restart.
    turbopackFileSystemCacheForDev: false,
  },
};

export default nextConfig;