/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Turbopack configuration for development mode only (next dev --turbopack)
  ...(process.env.NODE_ENV === 'development' && {
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
  }),
  // Webpack configuration for production builds
  webpack: (config, { isServer }) => {
    // Add element-tagger loader for production builds if needed
    // Note: This may need to be conditionally enabled only in development
    // to avoid issues in production deployments
    if (process.env.NODE_ENV === 'development') {
      config.module.rules.push({
        test: /\.(tsx|jsx)$/,
        exclude: /node_modules/,
        use: ['@softgenai/element-tagger'],
      });
    }
    return config;
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
