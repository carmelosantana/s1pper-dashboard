/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    // Skip prerendering of error pages as workaround for React 19 context issue
    skipMiddlewareUrlNormalize: false,
    skipTrailingSlashRedirect: false,
  },
  // Enable standalone output for Docker
  output: 'standalone',
}

export default nextConfig