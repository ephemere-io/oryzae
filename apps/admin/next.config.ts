import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@oryzae/server'],
  turbopack: {},
};

export default nextConfig;
