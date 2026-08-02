import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/api/worksheets/pdf": [
      "./node_modules/@expo-google-fonts/noto-sans-tc/400Regular/*.ttf",
      "./node_modules/@expo-google-fonts/noto-sans-tc/700Bold/*.ttf",
    ],
  },
};

export default nextConfig;
