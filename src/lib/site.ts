/**
 * Site-wide constants used by metadata, OG image, sitemap, robots, manifest.
 *
 * Priority for canonical URL:
 * 1. NEXT_PUBLIC_SITE_URL (user-set, e.g. custom domain in Vercel env)
 * 2. VERCEL_PROJECT_PRODUCTION_URL (Vercel-injected production URL)
 * 3. localhost fallback for dev
 */
function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelProd) return `https://${vercelProd}`;

  return "http://localhost:3000";
}

export const siteUrl = resolveSiteUrl();

export const site = {
  name: "Giwa Sepolia Faucet",
  shortName: "Giwa Faucet",
  title: "Giwa Sepolia Faucet & Bridge",
  description:
    "Community-funded Giwa Sepolia testnet faucet with L1↔L2 bridge. Donate Sepolia ETH, receive Giwa Sepolia ETH on demand, or bridge ETH/ERC-20 with your own wallet.",
  keywords: [
    "Giwa",
    "Giwa Sepolia",
    "Sepolia",
    "faucet",
    "testnet",
    "bridge",
    "L2",
    "Ethereum",
    "OP Stack",
    "rollup",
    "layer 2",
    "ERC-20",
  ],
  locale: "en_US",
  themeColor: "#0a0a0a",
  ogImage: {
    width: 1200,
    height: 630,
    alt: "Giwa Sepolia Faucet & Bridge",
  },
} as const;
