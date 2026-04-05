import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@oryzae/shared'],
  turbopack: {},
};

export default nextConfig;
