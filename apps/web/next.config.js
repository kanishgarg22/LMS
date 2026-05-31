/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [{ protocol: 'http', hostname: 'localhost' }],
  },
  webpack: (config) => {
    // Deduplicate React to prevent styled-jsx / SSR conflicts in monorepo
    config.resolve.alias = {
      ...config.resolve.alias,
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
    };
    return config;
  },
};

module.exports = nextConfig;
