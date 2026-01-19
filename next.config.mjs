/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    rules: {
      "*.tsx": {
        loaders: ["@softgenai/element-tagger"],
        as: "*.tsx",
      },
      "*.jsx": {
        loaders: ["@softgenai/element-tagger"],
        as: "*.jsx",
      },
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
