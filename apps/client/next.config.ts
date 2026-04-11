import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@oryzae/shared', '@oryzae/server'],
  turbopack: {},
};

export default nextConfig;
