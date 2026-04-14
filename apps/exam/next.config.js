/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    esmExternals: true,
  },
  transpilePackages: ['@cp949/web-image-util'],
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
