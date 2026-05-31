/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [{ protocol: 'http', hostname: 'localhost' }],
  },
  // pdfkit uses Node.js built-ins — mark as server-only
  serverExternalPackages: ['pdfkit'],
};

module.exports = nextConfig;
