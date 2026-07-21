import type { Metadata } from "next";
import { BridgePanel } from "@/components/bridge/bridge-panel";

export const metadata: Metadata = {
  title: "Bridge",
  description:
    "Bridge ETH and ERC-20 between Sepolia (L1) and Giwa Sepolia (L2) with your own wallet. Deposits land in 1–3 minutes; withdrawals follow OP Stack prove + 7-day challenge.",
  alternates: { canonical: "/bridge" },
  openGraph: {
    title: "Giwa Sepolia Bridge",
    description:
      "Sign with your own wallet to move ETH or ERC-20 between Sepolia (L1) and Giwa Sepolia (L2).",
    url: "/bridge",
  },
};

export default function BridgePage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-10 sm:py-14">
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Giwa Sepolia Bridge
        </h1>
        <p className="text-sm text-muted-foreground">
          Sign with your own wallet to move ETH or ERC-20 tokens between{" "}
          <b>Sepolia</b> and <b>Giwa Sepolia</b>. Powered by viem&apos;s{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-[10px]">
            op-stack
          </code>{" "}
          actions.
        </p>
      </header>

      <BridgePanel />

      <footer className="mt-auto flex flex-col gap-1 pt-8 text-xs text-muted-foreground">
        <div>
          L1: Sepolia · L2:{" "}
          <a
            href="https://sepolia-explorer.giwa.io"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            Giwa Sepolia
          </a>
        </div>
        <div>
          Docs:{" "}
          <a
            href="https://docs.giwa.io/get-started/bridging/eth"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            ETH bridging
          </a>{" "}
          ·{" "}
          <a
            href="https://docs.giwa.io/get-started/bridging/erc-20"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            ERC-20 bridging
          </a>
        </div>
      </footer>
    </main>
  );
}
