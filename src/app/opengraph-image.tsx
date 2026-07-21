import { ImageResponse } from "next/og";
import { site, siteUrl } from "@/lib/site";

export const alt = site.ogImage.alt;
export const size = {
  width: site.ogImage.width,
  height: site.ogImage.height,
};
export const contentType = "image/png";

export default async function OGImage() {
  const domain = siteUrl.replace(/^https?:\/\//, "");
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background:
            "radial-gradient(circle at 20% 20%, #1a2540 0%, #0a0a0a 60%, #000 100%)",
          color: "#fafafa",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg
            width="72"
            height="72"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#60a5fa"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" />
          </svg>
          <span style={{ fontSize: 32, opacity: 0.85, letterSpacing: -0.5 }}>
            {domain}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: 96,
              fontWeight: 600,
              letterSpacing: -2.5,
              lineHeight: 1,
            }}
          >
            {site.title}
          </div>
          <div
            style={{
              fontSize: 40,
              opacity: 0.6,
              maxWidth: 960,
              lineHeight: 1.25,
            }}
          >
            Community-funded testnet faucet + user-signed L1↔L2 bridge for
            ETH & ERC-20.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 26,
            opacity: 0.55,
          }}
        >
          <span
            style={{
              padding: "6px 14px",
              border: "1px solid #60a5fa60",
              borderRadius: 999,
              color: "#93c5fd",
            }}
          >
            Sepolia · L1
          </span>
          <span>→</span>
          <span
            style={{
              padding: "6px 14px",
              border: "1px solid #60a5fa60",
              borderRadius: 999,
              color: "#93c5fd",
            }}
          >
            Giwa Sepolia · L2
          </span>
        </div>
      </div>
    ),
    size,
  );
}
