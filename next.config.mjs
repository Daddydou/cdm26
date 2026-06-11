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
      // Page d'accueil — dynamique et dépendante de la session, jamais en cache
      urlPattern: /^\/(\?.*)?$/,
      handler: 'NetworkOnly',
    },
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
