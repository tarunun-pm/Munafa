/** @type {import('next').NextConfig} */
const nextConfig = {
  headers: async () => [
    {
      // Serve the service worker with the right scope + no-cache headers
      source: '/sw.js',
      headers: [
        { key: 'Service-Worker-Allowed', value: '/' },
        { key: 'Cache-Control',          value: 'no-cache, no-store, must-revalidate' },
      ],
    },
  ],
}

export default nextConfig
