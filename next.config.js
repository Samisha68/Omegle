/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.externals.push({
      'utf-8-validate': 'commonjs utf-8-validate',
      'bufferutil': 'commonjs bufferutil',
    });
    return config;
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
        ],
      },
    ];
  },
  env: {
    NEXT_PUBLIC_SIGNALING_SERVER: process.env.NEXT_PUBLIC_SIGNALING_SERVER || 'http://localhost:4000',
  },
  async rewrites() {
    return [
      {
        source: '/api/signaling/:path*',
        destination: 'https://solana-video-chat-signaling.onrender.com/:path*', // Proxy to external API
      },
      {
        source: '/socket.io/:path*',
        destination: 'https://solana-video-chat-signaling.onrender.com/socket.io/:path*', // Proxy socket.io specifically
      },
    ];
  },
};

module.exports = nextConfig; 