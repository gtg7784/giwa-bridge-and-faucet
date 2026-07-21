"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { sepolia, giwaSepolia } from "viem/chains";
import { formatEther, isAddress, parseEther, type Address, type Hash } from "viem";
import { getL2TransactionHashes } from "viem/op-stack";
import { toast } from "sonner";
import { Loader2, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WalletGuard } from "./wallet-guard";
import { TxLink } from "./tx-result";
import { useL1WalletClient, useL2PublicClient, useL1PublicClient } from "@/lib/op-clients";
import { onchainDepositsQueryKey } from "@/hooks/use-onchain-deposits";

/**
 * L1 (Sepolia) → L2 (Giwa Sepolia) ETH deposit.
 * Reference: https://docs.giwa.io/get-started/bridging/eth
 */
export function DepositEth() {
  const { address } = useAccount();
  const publicClientL1 = useL1PublicClient();
  const publicClientL2 = useL2PublicClient();
  const walletClientL1 = useL1WalletClient();
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState("0.001");
  const [recipient, setRecipient] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [l1Hash, setL1Hash] = useState<Hash | undefined>();
  const [l2Hash, setL2Hash] = useState<Hash | undefined>();
  const [waitingL2, setWaitingL2] = useState(false);

  const to = (recipient.trim() || address) as Address | undefined;

  async function submit() {
    if (!walletClientL1 || !publicClientL1 || !publicClientL2 || !to) return;
    if (!isAddress(to)) {
      toast.error("Invalid recipient address");
      return;
    }
    let mint: bigint;
    try {
      mint = parseEther(amount);
      if (mint <= 0n) throw new Error();
    } catch {
      toast.error("Invalid amount");
      return;
    }

    setBusy(true);
    setL1Hash(undefined);
    setL2Hash(undefined);
    setWaitingL2(false);

    try {
      const depositArgs = await publicClientL2.buildDepositTransaction({
        mint,
        to,
      });
      const hash = await walletClientL1.depositTransaction(depositArgs);
      setL1Hash(hash);
      toast.info("L1 deposit sent, waiting for confirmation…");

      const receipt = await publicClientL1.waitForTransactionReceipt({ hash });
      const [derivedL2Hash] = getL2TransactionHashes(receipt);
      setL2Hash(derivedL2Hash);
      setWaitingL2(true);
      toast.success(`L1 confirmed. Deposit will land on L2 in ~1–3 min. Amount: ${formatEther(mint)} ETH`);
      queryClient.invalidateQueries({ queryKey: [onchainDepositsQueryKey] });

      publicClientL2
        .waitForTransactionReceipt({ hash: derivedL2Hash })
        .then(() => {
          setWaitingL2(false);
          toast.success("L2 deposit confirmed 🎉");
        })
        .catch(() => setWaitingL2(false));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Deposit failed", { description: msg });
    } finally {
      setBusy(false);
    }
  }

  return (
    <WalletGuard requiredChainId={sepolia.id} requiredChainName="Sepolia">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="deposit-eth-amount">Amount (ETH)</Label>
          <Input
            id="deposit-eth-amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.001"
            className="font-mono"
            disabled={busy}
            inputMode="decimal"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="deposit-eth-recipient">
            Recipient on {giwaSepolia.name}{" "}
            <span className="text-muted-foreground">(default: your address)</span>
          </Label>
          <Input
            id="deposit-eth-recipient"
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
              Depositing…
            </>
          ) : (
            "Deposit to Giwa Sepolia"
          )}
        </Button>

        {l1Hash || l2Hash ? (
          <div className="flex flex-col gap-2">
            <TxLink hash={l1Hash} chain="l1" label="L1 deposit" />
            <TxLink hash={l2Hash} chain="l2" label="L2 mint" pending={waitingL2} />
          </div>
        ) : null}
      </div>
    </WalletGuard>
  );
}
