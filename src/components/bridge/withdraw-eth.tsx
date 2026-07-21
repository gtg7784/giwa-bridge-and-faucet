"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { giwaSepolia } from "viem/chains";
import { formatEther, isAddress, parseEther, type Address, type Hash } from "viem";
import { toast } from "sonner";
import { Loader2, ArrowDown, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { WalletGuard } from "./wallet-guard";
import { TxLink } from "./tx-result";
import { useL1PublicClient, useL2PublicClient, useL2WalletClient } from "@/lib/op-clients";
import { onchainWithdrawalsQueryKey } from "@/hooks/use-onchain-withdrawals";

/**
 * L2 → L1 ETH withdrawal 개시.
 * 성공 시 WithdrawalTracker 의 RPC query 를 invalidate 해서 새 withdrawal 이 바로 나타남.
 * Prove/Finalize 는 tracker 에서 진행.
 * Reference: https://docs.giwa.io/get-started/bridging/eth
 */
export function WithdrawEth() {
  const { address } = useAccount();
  const publicClientL1 = useL1PublicClient();
  const publicClientL2 = useL2PublicClient();
  const walletClientL2 = useL2WalletClient();
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState("0.0001");
  const [recipient, setRecipient] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [l2Hash, setL2Hash] = useState<Hash | undefined>();

  const to = (recipient.trim() || address) as Address | undefined;

  async function submit() {
    if (!walletClientL2 || !to) return;
    if (!isAddress(to)) {
      toast.error("Invalid recipient address");
      return;
    }
    let value: bigint;
    try {
      value = parseEther(amount);
      if (value <= 0n) throw new Error();
    } catch {
      toast.error("Invalid amount");
      return;
    }

    setBusy(true);
    setL2Hash(undefined);
    try {
      const withdrawalArgs = await publicClientL1.buildInitiateWithdrawal({
        to,
        value,
      });
      const hash = await walletClientL2.initiateWithdrawal(withdrawalArgs);
      setL2Hash(hash);
      toast.info("L2 withdrawal sent, waiting for L2 confirmation…");

      await publicClientL2.waitForTransactionReceipt({ hash });

      toast.success(
        `Withdrawal initiated. Amount: ${formatEther(value)} ETH. It will appear in the tracker below.`,
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
    <WalletGuard requiredChainId={giwaSepolia.id} requiredChainName="Giwa Sepolia">
      <div className="flex flex-col gap-4">
        <Alert>
          <Clock className="size-4" />
          <AlertTitle>Withdrawals take ~7 days</AlertTitle>
          <AlertDescription>
            After initiating, you must return to <b>prove</b> (available in
            ~2h) and later <b>finalize</b> (available after a ~7 day challenge
            period). Both steps are tracked below.
          </AlertDescription>
        </Alert>

        <div className="flex flex-col gap-2">
          <Label htmlFor="withdraw-eth-amount">Amount (ETH)</Label>
          <Input
            id="withdraw-eth-amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0001"
            className="font-mono"
            disabled={busy}
            inputMode="decimal"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="withdraw-eth-recipient">
            Recipient on Sepolia{" "}
            <span className="text-muted-foreground">(default: your address)</span>
          </Label>
          <Input
            id="withdraw-eth-recipient"
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
