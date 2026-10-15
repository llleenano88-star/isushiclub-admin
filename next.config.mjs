/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
  images: { remotePatterns: [{ protocol: "https", hostname: "**.supabase.co" }] },
};
export default nextConfig;
