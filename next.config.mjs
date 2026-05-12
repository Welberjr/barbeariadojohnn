/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // ESLint warnings won't fail the production build.
    // `npm run lint` still works manually pra catch issues durante dev.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
