import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default withNextIntl(nextConfig);

// Bindings da Cloudflare só no `next dev`. No build não precisa, e o binding AI
// (remoto) exigiria CLOUDFLARE_API_TOKEN no CI.
if (process.argv.includes("dev")) {
  import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
}
