"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount, useReadContract } from "wagmi";
import { giwaSepolia } from "viem/chains";
import { formatEther, formatUnits, type Address } from "viem";
import { Loader2, Hourglass, CheckCheck, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TxLink } from "./tx-result";
import { useL2PublicClient } from "@/lib/op-clients";
import { testTokenAbi } from "@/lib/tokens";
import {
  useOnchainDeposits,
  type OnchainDeposit,
} from "@/hooks/use-onchain-deposits";

export function DepositTracker() {
  const { address } = useAccount();
  const { data, isPending, isFetching, refetch, error } = useOnchainDeposits();

  if (!address) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        Connect your wallet to see your deposits.
      </p>
    );
  }

  if (isPending) {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading deposits from RPC…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-start gap-2 py-4 text-sm text-destructive">
        <span>Failed to fetch deposits: {error.message}</span>
        <Button size="sm" variant="outline" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  const items = data ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {items.length > 0
            ? `${items.length} deposit${items.length > 1 ? "s" : ""} in the last ~14 days.`
            : "No deposits found in the last ~14 days."}
        </span>
        <Button
          size="xs"
          variant="ghost"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={isFetching ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      {items.length === 0 ? null : (
        <div className="flex flex-col">
          {items.map((d, idx) => (
            <div key={d.l1Hash}>
              {idx > 0 ? <Separator className="my-3" /> : null}
              <DepositRow deposit={d} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DepositRow({ deposit }: { deposit: OnchainDeposit }) {
  const publicClientL2 = useL2PublicClient();

  const isErc20 = deposit.kind === "erc20";
  const { data: symbolData } = useReadContract({
    address: isErc20 ? deposit.l2Token : undefined,
    abi: testTokenAbi,
    functionName: "symbol",
    chainId: giwaSepolia.id,
    query: { enabled: isErc20 },
  });
  const { data: decimalsData } = useReadContract({
    address: isErc20 ? deposit.l2Token : undefined,
    abi: testTokenAbi,
    functionName: "decimals",
    chainId: giwaSepolia.id,
    query: { enabled: isErc20 },
  });

  const displayAmount = (() => {
    if (deposit.kind === "eth") return `${formatEther(deposit.amount)} ETH`;
    const decimals = decimalsData ?? 18;
    const symbol = symbolData ?? "TOKEN";
    return `${formatUnits(deposit.amount, decimals)} ${symbol}`;
  })();

  // L2 receipt 존재 여부로 완료 판정. 없으면 pending (retry 재빨리).
  const statusQuery = useQuery({
    queryKey: ["deposit-l2-status", deposit.l2Hash],
    refetchInterval: (query) => (query.state.data === "completed" ? false : 15_000),
    queryFn: async (): Promise<"pending" | "completed"> => {
      try {
        await publicClientL2.getTransactionReceipt({ hash: deposit.l2Hash });
        return "completed";
      } catch {
        return "pending";
      }
    },
  });

  const status = statusQuery.data;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="font-mono text-[10px] uppercase">
            {deposit.kind}
          </Badge>
          <span className="font-mono text-sm">{displayAmount}</span>
        </div>
        <Badge
          variant={status === "completed" ? "default" : "secondary"}
          className="text-[10px]"
        >
          {status === "completed" ? (
            <>
              <CheckCheck className="size-3" />
              Completed
            </>
          ) : (
            <>
              <Hourglass className="size-3" />
              Pending on L2 (~1-3min)
            </>
          )}
        </Badge>
      </div>

      <div className="text-xs text-muted-foreground">
        To{" "}
        <span className="font-mono">
          {deposit.to.slice(0, 6)}…{deposit.to.slice(-4)}
        </span>{" "}
        · L1 block {deposit.blockNumber.toString()}
      </div>

      <div className="flex flex-col gap-1.5">
        <TxLink hash={deposit.l1Hash} chain="l1" label="L1 deposit" />
        <TxLink
          hash={deposit.l2Hash}
          chain="l2"
          label="L2 mint"
          pending={status !== "completed"}
        />
      </div>
    </div>
  );
}
