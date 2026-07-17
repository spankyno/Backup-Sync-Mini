/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@backuphub/ui",
    "@backuphub/types",
    "@backuphub/shared",
    "@backuphub/config",
    "@backuphub/auth",
  ],
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
