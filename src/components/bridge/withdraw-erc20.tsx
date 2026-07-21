"use client";

import { useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { giwaSepolia } from "viem/chains";
import {
  formatUnits,
  isAddress,
  parseUnits,
  type Address,
  type Hash,
} from "viem";
import { toast } from "sonner";
import { Loader2, ArrowDown, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { WalletGuard } from "./wallet-guard";
import { TxLink } from "./tx-result";
import { useL2PublicClient, useL2WalletClient } from "@/lib/op-clients";
import {
  l2StandardBridgeAbi,
  l2StandardBridgeAddress,
  l2TestTokenAddress,
  testTokenAbi,
} from "@/lib/tokens";
import { onchainWithdrawalsQueryKey } from "@/hooks/use-onchain-withdrawals";

const MIN_GAS_LIMIT = 200_000;
const DEFAULT_DECIMALS = 18;

/**
 * L2 → L1 ERC-20 withdrawal 개시 via L2StandardBridge.withdrawTo.
 * Reference: https://docs.giwa.io/get-started/bridging/erc-20
 *
 * 성공 시 WithdrawalTracker 의 RPC query 를 invalidate 해서 새 withdrawal 이 바로 나타남.
 * Prove/Finalize 는 tracker 에서.
 */
export function WithdrawErc20() {
  const { address } = useAccount();
  const publicClientL2 = useL2PublicClient();
  const walletClientL2 = useL2WalletClient();
  const queryClient = useQueryClient();

  const [l2Token, setL2Token] = useState<string>(l2TestTokenAddress);
  const [amount, setAmount] = useState("0.5");
  const [recipient, setRecipient] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [l2Hash, setL2Hash] = useState<Hash | undefined>();

  const { data: decimalsData } = useReadContract({
    address: isAddress(l2Token) ? (l2Token as Address) : undefined,
    abi: testTokenAbi,
    functionName: "decimals",
    chainId: giwaSepolia.id,
    query: { enabled: isAddress(l2Token) },
  });
  const decimals = decimalsData ?? DEFAULT_DECIMALS;

  const { data: symbolData } = useReadContract({
    address: isAddress(l2Token) ? (l2Token as Address) : undefined,
    abi: testTokenAbi,
    functionName: "symbol",
    chainId: giwaSepolia.id,
    query: { enabled: isAddress(l2Token) },
  });
  const symbol = symbolData ?? "TOKEN";

  const to = (recipient.trim() || address) as Address | undefined;

  async function submit() {
    if (!walletClientL2) return;
    if (!isAddress(l2Token)) {
      toast.error("Invalid L2 token address");
      return;
    }
    if (!to || !isAddress(to)) {
      toast.error("Invalid recipient address");
      return;
    }
    let value: bigint;
    try {
      value = parseUnits(amount, decimals);
      if (value <= 0n) throw new Error();
    } catch {
      toast.error("Invalid amount");
      return;
    }

    setBusy(true);
    setL2Hash(undefined);
    try {
      const hash = await walletClientL2.writeContract({
        address: l2StandardBridgeAddress,
        abi: l2StandardBridgeAbi,
        functionName: "withdrawTo",
        args: [l2Token as Address, to, value, MIN_GAS_LIMIT, "0x"],
      });
      setL2Hash(hash);
      toast.info("L2 withdrawal sent, waiting for L2 confirmation…");

      await publicClientL2.waitForTransactionReceipt({ hash });

      toast.success(
        `Withdrawal initiated. Amount: ${formatUnits(value, decimals)} ${symbol}. It will appear in the tracker below.`,
      );
      queryClient.invalidateQueries({ queryKey: [onchainWithdrawalsQueryKey] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Withdrawal failed", { description: msg });
    } finally {
      setBusy(false);
    }
  }

  return (
    <WalletGuard
      requiredChainId={giwaSepolia.id}
      requiredChainName="Giwa Sepolia"
    >
      <div className="flex flex-col gap-4">
        <Alert>
          <Clock className="size-4" />
          <AlertTitle>Withdrawals take ~7 days</AlertTitle>
          <AlertDescription>
            After initiating, you must return to <b>prove</b> (available in
            ~2h) and later <b>finalize</b> (available after a ~7 day challenge
            period).
          </AlertDescription>
        </Alert>

        <div className="flex flex-col gap-2">
          <Label htmlFor="withdraw-erc20-l2token">L2 token address</Label>
          <Input
            id="withdraw-erc20-l2token"
            value={l2Token}
            onChange={(e) => setL2Token(e.target.value)}
            className="font-mono"
            disabled={busy}
            spellCheck={false}
            autoComplete="off"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="withdraw-erc20-amount">
            Amount ({symbol}, decimals: {decimals})
          </Label>
          <Input
            id="withdraw-erc20-amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="font-mono"
            disabled={busy}
            inputMode="decimal"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="withdraw-erc20-recipient">
            Recipient on Sepolia{" "}
            <span className="text-muted-foreground">(default: your address)</span>
          </Label>
          <Input
            id="withdraw-erc20-recipient"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder={address ?? "0x..."}
            className="font-mono"
            disabled={busy}
            spellCheck={false}
            autoComplete="off"
          />
        </div>

        <div className="flex justify-center py-1 text-muted-foreground">
          <ArrowDown className="size-4" />
        </div>
        <Button onClick={submit} disabled={busy} className="w-full">
          {busy ? (
            <>
              <Loader2 className="animate-spin" />
              Initiating…
            </>
          ) : (
            "Initiate Withdrawal to Sepolia"
          )}
        </Button>

        {l2Hash ? <TxLink hash={l2Hash} chain="l2" label="L2 initiate" /> : null}
      </div>
    </WalletGuard>
  );
}
