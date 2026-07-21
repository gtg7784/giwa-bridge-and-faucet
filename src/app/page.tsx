import type { Metadata } from "next";
import { FaucetCard } from "@/components/faucet-card";

export const metadata: Metadata = {
  title: "Faucet",
  description:
    "Community-funded Giwa Sepolia faucet. Donate Sepolia ETH — bridged to L2 daily at 00:00 KST — and request a small drip on demand.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Giwa Sepolia Faucet",
    description:
      "Community-funded Giwa Sepolia faucet. Donate Sepolia ETH and request testnet ETH on L2.",
    url: "/",
  },
};

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-10 sm:py-14">
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Giwa Sepolia Faucet
        </h1>
        <p className="text-sm text-muted-foreground">
          Community-funded faucet. Sepolia ETH donated here is bridged to Giwa
          Sepolia daily at{" "}
          <span className="font-medium text-foreground">00:00 KST</span> and
          given out on request.
        </p>
      </header>

      <FaucetCard />

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
          Bridging follows the OP Stack{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-[10px]">
            depositTransaction
          </code>{" "}
          flow via{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-[10px]">viem</code>.
        </div>
      </footer>
    </main>
  );
}
