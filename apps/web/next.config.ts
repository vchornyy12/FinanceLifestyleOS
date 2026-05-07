import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // pdf-parse + pdfjs-dist are large CJS modules that crash the Lambda when
  // bundled by Next.js. Mark them external so they load from node_modules at runtime.
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist'],
  turbopack: {
    root: path.resolve(__dirname, "../.."),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/**",
      },
    ],
  },
};

export default nextConfig;
