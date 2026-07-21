"use client";

import { ExternalLink, CheckCircle2, Loader2 } from "lucide-react";
import type { Hash } from "viem";

/**
 * L1/L2 트랜잭션 결과 링크 blob.
 */
export function TxLink({
  hash,
  chain,
  label,
  pending,
}: {
  hash: Hash | undefined;
  chain: "l1" | "l2";
  label: string;
  pending?: boolean;
}) {
  if (!hash && !pending) return null;
  const url = hash
    ? chain === "l1"
      ? `https://sepolia.etherscan.io/tx/${hash}`
      : `https://sepolia-explorer.giwa.io/tx/${hash}`
    : undefined;
  const short = hash ? `${hash.slice(0, 10)}…${hash.slice(-8)}` : "pending";

  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
      <div className="flex items-center gap-2">
        {pending ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <CheckCircle2 className="size-3.5 shrink-0 text-green-500" />
        )}
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{short}</span>
      </div>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          Explorer
          <ExternalLink className="size-3" />
        </a>
      ) : null}
    </div>
  );
}
