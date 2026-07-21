"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount, useChainId, useReadContract, useSwitchChain } from "wagmi";
import { sepolia, giwaSepolia } from "viem/chains";
import { formatEther, formatUnits, type Address, type Hash } from "viem";
import { toast } from "sonner";
import {
  Loader2,
  Shield,
  CheckCheck,
  Hourglass,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TxLink } from "./tx-result";
import {
  useL1PublicClient,
  useL1WalletClient,
  useL2PublicClient,
} from "@/lib/op-clients";
import { testTokenAbi } from "@/lib/tokens";
import {
  onchainWithdrawalsQueryKey,
  useOnchainWithdrawals,
  type OnchainWithdrawal,
} from "@/hooks/use-onchain-withdrawals";

/**
 * 연결된 지갑 주소로 발생한 L2 withdrawal 목록을 RPC 에서 조회.
 * 각 row 는 getWithdrawalStatus 로 실시간 상태 조회 + Prove/Finalize 버튼 노출.
 */
export function WithdrawalTracker() {
  const { address } = useAccount();
  const { data, isPending, isFetching, refetch, error } =
    useOnchainWithdrawals();

  if (!address) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        Connect your wallet to see your withdrawals.
      </p>
    );
  }

  if (isPending) {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading withdrawals from RPC…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-start gap-2 py-4 text-sm text-destructive">
        <span>Failed to fetch withdrawals: {error.message}</span>
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
            ? `${items.length} withdrawal${items.length > 1 ? "s" : ""} in the last ~6 days.`
            : "No withdrawals found in the last ~6 days."}
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
          {items.map((w, idx) => (
            <div key={w.l2Hash}>
              {idx > 0 ? <Separator className="my-3" /> : null}
              <WithdrawalRow withdrawal={w} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type StatusResult = {
  status:
    | "waiting-to-prove"
    | "ready-to-prove"
    | "waiting-to-finalize"
    | "ready-to-finalize"
    | "finalized";
};

function statusLabel(s: StatusResult["status"] | undefined) {
  switch (s) {
    case "waiting-to-prove":
      return { text: "Waiting to prove (~2h)", tone: "muted" as const };
    case "ready-to-prove":
      return { text: "Ready to prove", tone: "action" as const };
    case "waiting-to-finalize":
      return { text: "Waiting to finalize (~7 days)", tone: "muted" as const };
    case "ready-to-finalize":
      return { text: "Ready to finalize", tone: "action" as const };
    case "finalized":
      return { text: "Finalized ✓", tone: "success" as const };
    default:
      return { text: "Checking…", tone: "muted" as const };
  }
}

function WithdrawalRow({ withdrawal }: { withdrawal: OnchainWithdrawal }) {
  const publicClientL1 = useL1PublicClient();
  const publicClientL2 = useL2PublicClient();
  const walletClientL1 = useL1WalletClient();
  const queryClient = useQueryClient();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const [busy, setBusy] = useState<"prove" | "finalize" | null>(null);
  const [optimisticProveHash, setOptimisticProveHash] = useState<Hash | undefined>();
  const [optimisticFinalizeHash, setOptimisticFinalizeHash] = useState<Hash | undefined>();
  const proveHash = withdrawal.proveHash ?? optimisticProveHash;
  const finalizeHash = withdrawal.finalizeHash ?? optimisticFinalizeHash;

  // ERC-20 token metadata (lazy, per-row)
  const isErc20 = withdrawal.kind === "erc20";
  const { data: symbolData } = useReadContract({
    address: isErc20 ? withdrawal.l2Token : undefined,
    abi: testTokenAbi,
    functionName: "symbol",
    chainId: giwaSepolia.id,
    query: { enabled: isErc20 },
  });
  const { data: decimalsData } = useReadContract({
    address: isErc20 ? withdrawal.l2Token : undefined,
    abi: testTokenAbi,
    functionName: "decimals",
    chainId: giwaSepolia.id,
    query: { enabled: isErc20 },
  });

  const displayAmount = (() => {
    if (withdrawal.kind === "eth") return `${formatEther(withdrawal.amount)} ETH`;
    const decimals = decimalsData ?? 18;
    const symbol = symbolData ?? "TOKEN";
    return `${formatUnits(withdrawal.amount, decimals)} ${symbol}`;
  })();

  const statusQuery = useQuery<StatusResult>({
    queryKey: ["withdrawal-status", withdrawal.l2Hash],
    refetchInterval: 60_000,
    queryFn: async () => {
      const receipt = await publicClientL2.getTransactionReceipt({
        hash: withdrawal.l2Hash,
      });
      const status = await publicClientL1.getWithdrawalStatus({
        receipt,
        targetChain: giwaSepolia,
      });
      return { status };
    },
    retry: 1,
  });

  const status = statusQuery.data?.status;
  const info = statusLabel(status);

  async function ensureL1() {
    if (chainId !== sepolia.id) {
      await switchChainAsync({ chainId: sepolia.id });
    }
  }

  async function prove() {
    if (!walletClientL1) return;
    setBusy("prove");
    try {
      await ensureL1();
      const receipt = await publicClientL2.getTransactionReceipt({
        hash: withdrawal.l2Hash,
      });
      const { output, withdrawal: w } = await publicClientL1.waitToProve({
        receipt,
        targetChain: giwaSepolia,
      });
      const proveArgs = await publicClientL2.buildProveWithdrawal({
        output,
        withdrawal: w,
      });
      const proveTxHash = await walletClientL1.proveWithdrawal(proveArgs);
      setOptimisticProveHash(proveTxHash);
      toast.info("Prove tx sent, waiting…");
      await publicClientL1.waitForTransactionReceipt({ hash: proveTxHash });
      toast.success("Proved. Challenge period starts (~7 days).");
      statusQuery.refetch();
      queryClient.invalidateQueries({ queryKey: [onchainWithdrawalsQueryKey] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Prove failed", { description: msg });
    } finally {
      setBusy(null);
    }
  }

  async function finalize() {
    if (!walletClientL1) return;
    setBusy("finalize");
    try {
      await ensureL1();
      const receipt = await publicClientL2.getTransactionReceipt({
        hash: withdrawal.l2Hash,
      });
      const { withdrawal: w } = await publicClientL1.waitToProve({
        receipt,
        targetChain: giwaSepolia,
      });
      const finalizeTxHash = await walletClientL1.finalizeWithdrawal({
        targetChain: giwaSepolia,
        withdrawal: w,
      });
      setOptimisticFinalizeHash(finalizeTxHash);
      toast.info("Finalize tx sent, waiting…");
      await publicClientL1.waitForTransactionReceipt({ hash: finalizeTxHash });
      toast.success("Withdrawal finalized 🎉");
      statusQuery.refetch();
      queryClient.invalidateQueries({ queryKey: [onchainWithdrawalsQueryKey] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Finalize failed", { description: msg });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="font-mono text-[10px] uppercase">
            {withdrawal.kind}
          </Badge>
          <span className="font-mono text-sm">{displayAmount}</span>
        </div>
        <Badge
          variant={info.tone === "muted" ? "secondary" : "default"}
          className="text-[10px]"
        >
          {statusQuery.isPending ? (
            <>
              <Loader2 className="animate-spin" />
              Checking
            </>
          ) : info.tone === "muted" ? (
            <>
              <Hourglass className="size-3" />
              {info.text}
            </>
          ) : info.tone === "success" ? (
            <>
              <CheckCheck className="size-3" />
              {info.text}
            </>
          ) : (
            <>
              <Shield className="size-3" />
              {info.text}
            </>
          )}
        </Badge>
      </div>

      <div className="text-xs text-muted-foreground">
        To{" "}
        <span className="font-mono">
          {withdrawal.to.slice(0, 6)}…{withdrawal.to.slice(-4)}
        </span>{" "}
        · block {withdrawal.blockNumber.toString()}
      </div>

      <div className="flex flex-col gap-1.5">
        <TxLink hash={withdrawal.l2Hash} chain="l2" label="L2 initiate" />
        {proveHash ? (
          <TxLink hash={proveHash} chain="l1" label="L1 prove" />
        ) : null}
        {finalizeHash ? (
          <TxLink hash={finalizeHash} chain="l1" label="L1 finalize" />
        ) : null}
      </div>

      {status === "ready-to-prove" || status === "ready-to-finalize" ? (
        <div className="flex items-center gap-2 pt-1">
          {status === "ready-to-prove" ? (
            <Button size="sm" onClick={prove} disabled={busy !== null}>
              {busy === "prove" ? (
                <>
                  <Loader2 className="animate-spin" />
                  Proving…
                </>
              ) : (
                "Prove"
              )}
            </Button>
          ) : null}
          {status === "ready-to-finalize" ? (
            <Button size="sm" onClick={finalize} disabled={busy !== null}>
              {busy === "finalize" ? (
                <>
                  <Loader2 className="animate-spin" />
                  Finalizing…
                </>
              ) : (
                "Finalize"
              )}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
