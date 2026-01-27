/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  // Use environment variable if set, otherwise default to repository name for GitHub Pages
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '/jubilant-parakeet',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
