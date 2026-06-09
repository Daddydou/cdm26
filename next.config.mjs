import withPWA from '@ducanh2912/next-pwa'

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ubnkuwyqclrjckogldlc.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

export default withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  cacheOnFrontEndNav: false,
  aggressiveFrontEndNavCaching: false,
  // Exclut /pick/* et /api/* du cache SW (GET+POST) — RegExp sérialisable sans risque
  extendDefaultRuntimeCaching: true,
  runtimeCaching: [
    {
      urlPattern: /\/pick\//,
      handler: 'NetworkOnly',
    },
    {
      urlPattern: /\/api\//,
      handler: 'NetworkOnly',
    },
  ],
})(nextConfig)
