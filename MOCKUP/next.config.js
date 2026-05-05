const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
        pathname: "/**",
      },
    ],
  },
  allowedDevOrigins: ['192.168.0.119'],
};

module.exports = nextConfig;