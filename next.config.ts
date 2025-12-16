import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "placeholders.io", // ✅ Add this line
      }
    ]
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  allowedDevOrigins: ["*"],
  async headers() {
    return [
      {
        // Apply to all routes
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
          // 🚨 CRITICAL: Allow iframe embedding from specific domains
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://web.totalum.app https://totalum-frontend-test.web.app http://localhost:8100",
          },
          // Don't set X-Frame-Options as CSP frame-ancestors takes precedence
        ],
      },
    ];
  },
};

export default nextConfig;

// added by create cloudflare to enable calling `getCloudflareContext()` in `next dev`
// conditionally initialize based on environment variable
if (process.env.DISABLE_OPENNEXT !== 'true') {
  try {
    const { initOpenNextCloudflareForDev } = require("@opennextjs/cloudflare");
    initOpenNextCloudflareForDev();
  } catch (error) {
    console.warn("OpenNext Cloudflare dev initialization failed:", error instanceof Error ? error.message : String(error));
    console.warn("Falling back to standard Next.js development mode");
  }
}
