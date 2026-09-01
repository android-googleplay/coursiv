import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["127.0.0.1", "192.168.31.14"],
  async redirects() {
    return [
      {
        source: "/coursiv-media/:path*",
        destination: "https://courseai-73920.web.app/coursiv-media/:path*",
        permanent: true,
      },
    ];
  },
  outputFileTracingIncludes: {
    "/api/worksheets/pdf": [
      "./node_modules/@expo-google-fonts/noto-sans-tc/400Regular/*.ttf",
      "./node_modules/@expo-google-fonts/noto-sans-tc/700Bold/*.ttf",
    ],
  },
};

export default nextConfig;
