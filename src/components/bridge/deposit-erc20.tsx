"use client";

import { useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { sepolia } from "viem/chains";
import {
  formatUnits,
  isAddress,
  parseUnits,
  type Address,
  type Hash,
} from "viem";
import { getL2TransactionHashes } from "viem/op-stack";
import { toast } from "sonner";
import { Loader2, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WalletGuard } from "./wallet-guard";
import { TxLink } from "./tx-result";
import {
  useL1WalletClient,
  useL1PublicClient,
  useL2PublicClient,
} from "@/lib/op-clients";
import {
  l1StandardBridgeAbi,
  l1StandardBridgeAddress,
  l1TestTokenAddress,
  l2TestTokenAddress,
  testTokenAbi,
} from "@/lib/tokens";
import { onchainDepositsQueryKey } from "@/hooks/use-onchain-deposits";

const MIN_GAS_LIMIT = 200_000;
const DEFAULT_DECIMALS = 18;

/**
 * L1 → L2 ERC-20 deposit via L1StandardBridge.depositERC20To.
 * Reference: https://docs.giwa.io/get-started/bridging/erc-20
 *
 * 사전에 L1 토큰의 approve(l1StandardBridgeAddress, amount) 가 필요.
 * approve 필요 시 자동으로 먼저 전송.
 */
export function DepositErc20() {
  const { address } = useAccount();
  const publicClientL1 = useL1PublicClient();
  const publicClientL2 = useL2PublicClient();
  const walletClientL1 = useL1WalletClient();
  const queryClient = useQueryClient();

  const [l1Token, setL1Token] = useState<string>(l1TestTokenAddress);
  const [l2Token, setL2Token] = useState<string>(l2TestTokenAddress);
  const [amount, setAmount] = useState("1");
  const [recipient, setRecipient] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [approveHash, setApproveHash] = useState<Hash | undefined>();
  const [depositHash, setDepositHash] = useState<Hash | undefined>();
  const [l2Hash, setL2Hash] = useState<Hash | undefined>();
  const [waitingL2, setWaitingL2] = useState(false);

  // decimals 조회 (default 18, 실패 시 fallback)
  const { data: decimalsData } = useReadContract({
    address: isAddress(l1Token) ? (l1Token as Address) : undefined,
    abi: testTokenAbi,
    functionName: "decimals",
    chainId: sepolia.id,
    query: { enabled: isAddress(l1Token) },
  });
  const decimals = decimalsData ?? DEFAULT_DECIMALS;

  const to = (recipient.trim() || address) as Address | undefined;

  async function submit() {
    if (!walletClientL1 || !publicClientL1 || !publicClientL2) return;
    if (!isAddress(l1Token) || !isAddress(l2Token)) {
      toast.error("Invalid token address");
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
    setApproveHash(undefined);
    setDepositHash(undefined);
    setL2Hash(undefined);
    setWaitingL2(false);

    try {
      // 1) allowance 조회 → 필요 시 approve
      const allowance = (await publicClientL1.readContract({
        address: l1Token as Address,
        abi: testTokenAbi,
        functionName: "allowance",
        args: [walletClientL1.account.address, l1StandardBridgeAddress],
      })) as bigint;

      if (allowance < value) {
        toast.info("Approve required, sending approve tx…");
        const approve = await walletClientL1.writeContract({
          address: l1Token as Address,
          abi: testTokenAbi,
          functionName: "approve",
          args: [l1StandardBridgeAddress, value],
        });
        setApproveHash(approve);
        await publicClientL1.waitForTransactionReceipt({ hash: approve });
        toast.success("Approve confirmed");
      }

      // 2) depositERC20To
      const deposit = await walletClientL1.writeContract({
        address: l1StandardBridgeAddress,
        abi: l1StandardBridgeAbi,
        functionName: "depositERC20To",
        args: [
          l1Token as Address,
          l2Token as Address,
          to,
          value,
          MIN_GAS_LIMIT,
          "0x",
        ],
      });
      setDepositHash(deposit);
      toast.info("L1 deposit sent, waiting for confirmation…");

      const receipt = await publicClientL1.waitForTransactionReceipt({
        hash: deposit,
      });
      const [derivedL2Hash] = getL2TransactionHashes(receipt);
      setL2Hash(derivedL2Hash);
      setWaitingL2(true);
      toast.success(
        `L1 confirmed. Tokens will land on L2 in ~1–3 min. Amount: ${formatUnits(value, decimals)}`,
      );
      queryClient.invalidateQueries({ queryKey: [onchainDepositsQueryKey] });

      publicClientL2
        .waitForTransactionReceipt({ hash: derivedL2Hash })
        .then(() => {
          setWaitingL2(false);
          toast.success("L2 mint confirmed 🎉");
        })
        .catch(() => setWaitingL2(false));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Deposit failed", { description: msg });
    } finally {
      setBusy(false);
    }
  }

  async function claimFaucet() {
    if (!walletClientL1 || !publicClientL1) return;
    if (!isAddress(l1Token)) return;
    setBusy(true);
    try {
      const hash = await walletClientL1.writeContract({
        address: l1Token as Address,
        abi: testTokenAbi,
        functionName: "claimFaucet",
      });
      toast.info("Faucet claim sent, waiting…");
      await publicClientL1.waitForTransactionReceipt({ hash });
      toast.success("Faucet tokens received on L1");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("claimFaucet failed", { description: msg });
    } finally {
      setBusy(false);
    }
  }

  const isTestToken = l1Token.toLowerCase() === l1TestTokenAddress.toLowerCase();

  return (
    <WalletGuard requiredChainId={sepolia.id} requiredChainName="Sepolia">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="deposit-erc20-l1token">L1 token address</Label>
          <Input
            id="deposit-erc20-l1token"
            value={l1Token}
            onChange={(e) => setL1Token(e.target.value)}
            className="font-mono"
            disabled={busy}
            spellCheck={false}
            autoComplete="off"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="deposit-erc20-l2token">L2 token address</Label>
          <Input
            id="deposit-erc20-l2token"
            value={l2Token}
            onChange={(e) => setL2Token(e.target.value)}
            className="font-mono"
            disabled={busy}
            spellCheck={false}
            autoComplete="off"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="deposit-erc20-amount">Amount (decimals: {decimals})</Label>
          <Input
            id="deposit-erc20-amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="font-mono"
            disabled={busy}
            inputMode="decimal"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="deposit-erc20-recipient">
            Recipient on Giwa Sepolia{" "}
            <span className="text-muted-foreground">(default: your address)</span>
          </Label>
          <Input
            id="deposit-erc20-recipient"
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
            "Approve & Deposit to Giwa Sepolia"
          )}
        </Button>

        {isTestToken ? (
          <Button
            variant="outline"
            onClick={claimFaucet}
            disabled={busy}
            className="w-full"
          >
            First time? claimFaucet() on the L1 test token
          </Button>
        ) : null}

        {approveHash || depositHash || l2Hash ? (
          <div className="flex flex-col gap-2">
            <TxLink hash={approveHash} chain="l1" label="L1 approve" />
            <TxLink hash={depositHash} chain="l1" label="L1 deposit" />
            <TxLink hash={l2Hash} chain="l2" label="L2 mint" pending={waitingL2} />
          </div>
        ) : null}
      </div>
    </WalletGuard>
  );
}
