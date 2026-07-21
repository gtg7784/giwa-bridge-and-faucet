"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { isAddress } from "viem";
import { Copy, CheckCheck, ExternalLink, Loader2, Droplet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

type Balances = {
  address: `0x${string}`;
  l1Balance: string;
  l2Balance: string;
  dripAmountEth: string;
  cooldownHours: number;
};

type FaucetResult = {
  ok: boolean;
  txHash?: `0x${string}`;
  amount?: string;
  to?: `0x${string}`;
  explorerUrl?: string;
  error?: string;
};

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatEthDisplay(value: string) {
  // trim trailing zeros but keep at least 4 decimals for readability
  const [i, d] = value.split(".");
  if (!d) return value;
  const trimmed = d.replace(/0+$/, "");
  if (trimmed.length === 0) return i;
  return `${i}.${trimmed}`;
}

export function FaucetCard() {
  const [balances, setBalances] = useState<Balances | null>(null);
  const [balancesLoading, setBalancesLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [userAddress, setUserAddress] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [lastResult, setLastResult] = useState<FaucetResult | null>(null);

  async function refreshBalances() {
    try {
      const res = await fetch("/api/balances", { cache: "no-store" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as Balances;
      setBalances(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Failed to load balances", { description: msg });
    } finally {
      setBalancesLoading(false);
    }
  }

  useEffect(() => {
    refreshBalances();
  }, []);

  async function copyAddress() {
    if (!balances?.address) return;
    try {
      await navigator.clipboard.writeText(balances.address);
      setCopied(true);
      toast.success("Address copied", {
        description: "Send Sepolia ETH or Giwa Sepolia ETH here to fund the faucet.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed");
    }
  }

  async function requestFaucet() {
    const trimmed = userAddress.trim();
    if (!isAddress(trimmed)) {
      toast.error("Invalid Ethereum address");
      return;
    }
    setRequesting(true);
    setLastResult(null);
    try {
      const res = await fetch("/api/faucet", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: trimmed }),
      });
      const data = (await res.json()) as FaucetResult;
      if (!res.ok || !data.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setLastResult(data);
      toast.success(`Sent ${data.amount} Giwa Sepolia ETH`, {
        description: `to ${shortAddr(data.to!)}`,
      });
      // faucet 잔고 갱신
      refreshBalances();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Faucet request failed", { description: msg });
    } finally {
      setRequesting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Faucet address card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Droplet className="size-4" />
            Faucet Wallet
          </CardTitle>
          <CardDescription>
            Click the address to copy. Send Sepolia ETH or Giwa Sepolia ETH here to
            fund the faucet. Sepolia ETH is bridged to Giwa Sepolia daily at 00:00 KST.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <button
            type="button"
            onClick={copyAddress}
            disabled={!balances?.address}
            className="group inline-flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-left font-mono text-xs transition-all hover:bg-muted disabled:opacity-50"
          >
            <span className="truncate">
              {balances?.address ?? "Loading…"}
            </span>
            {copied ? (
              <CheckCheck className="size-4 shrink-0 text-green-500" />
            ) : (
              <Copy className="size-4 shrink-0 opacity-60 group-hover:opacity-100" />
            )}
          </button>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-mono text-[10px]">
                  L1
                </Badge>
                <span className="text-xs text-muted-foreground">Sepolia</span>
              </div>
              <div className="font-mono text-lg tabular-nums">
                {balancesLoading
                  ? "…"
                  : balances
                    ? `${formatEthDisplay(balances.l1Balance)} ETH`
                    : "-"}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-mono text-[10px]">
                  L2
                </Badge>
                <span className="text-xs text-muted-foreground">Giwa Sepolia</span>
              </div>
              <div className="font-mono text-lg tabular-nums">
                {balancesLoading
                  ? "…"
                  : balances
                    ? `${formatEthDisplay(balances.l2Balance)} ETH`
                    : "-"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Faucet request card */}
      <Card>
        <CardHeader>
          <CardTitle>Request Giwa Sepolia ETH</CardTitle>
          <CardDescription>
            {balances
              ? `Receive ${formatEthDisplay(balances.dripAmountEth)} Giwa Sepolia ETH per address, once every ${balances.cooldownHours} hours.`
              : "Receive Giwa Sepolia ETH per address, once every 24 hours."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="user-address">Your address</Label>
            <div className="flex gap-2">
              <Input
                id="user-address"
                placeholder="0x..."
                value={userAddress}
                onChange={(e) => setUserAddress(e.target.value)}
                disabled={requesting}
                className="font-mono"
                autoComplete="off"
                spellCheck={false}
              />
              <Button
                onClick={requestFaucet}
                disabled={requesting || !userAddress.trim()}
              >
                {requesting ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Sending…
                  </>
                ) : (
                  "Request"
                )}
              </Button>
            </div>
          </div>

          {lastResult?.ok && lastResult.txHash ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-green-500/30 bg-green-500/5 px-3 py-2.5 text-xs">
              <div className="flex flex-col gap-0.5">
                <span className="font-medium text-green-500">
                  Sent {lastResult.amount} ETH
                </span>
                <span className="font-mono text-muted-foreground">
                  {shortAddr(lastResult.txHash)}
                </span>
              </div>
              <a
                href={lastResult.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-green-500 hover:underline"
              >
                Explorer
                <ExternalLink className="size-3" />
              </a>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
