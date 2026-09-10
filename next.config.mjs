/** @type {import('next').NextConfig} */
const nextConfig = {
  // In development the Express API runs on :8000; proxy /api there.
  // In production (Vercel) the api/index.js serverless function owns /api.
  async rewrites() {
    if (process.env.NODE_ENV !== "development") return [];
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.API_URL || "http://localhost:8000"}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
