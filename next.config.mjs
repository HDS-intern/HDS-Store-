import os from 'os'

/** @returns {string[]} Hostnames/IPs allowed to load Next.js dev assets over the LAN */
function getAllowedDevOrigins() {
  const origins = new Set(['localhost', '127.0.0.1', '*'])

  const interfaces = os.networkInterfaces()
  for (const iface of Object.values(interfaces)) {
    if (!iface) continue
    for (const addr of iface) {
      if (addr.family === 'IPv4' && !addr.internal) {
        origins.add(addr.address)
        origins.add(`${addr.address}:3000`)
      }
    }
  }

  origins.add('localhost:3000')
  origins.add('127.0.0.1:3000')

  const extra = (process.env.ALLOWED_DEV_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  for (const host of extra) origins.add(host)

  // Fallback patterns when interface detection misses a subnet
  for (const pattern of [
    '192.168.*.*',
    '10.*.*.*',
    '172.16.*.*',
    '172.17.*.*',
    '172.18.*.*',
    '172.19.*.*',
    '172.2*.*.*',
    '172.30.*.*',
    '172.31.*.*',
  ]) {
    origins.add(pattern)
  }

  return [...origins]
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: getAllowedDevOrigins(),
}

export default nextConfig
