"use client";

import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * children 을 렌더링하기 전에:
 * - 지갑 연결 여부 확인 (미연결 → ConnectButton)
 * - 현재 chain 이 requiredChainId 와 일치하는지 확인 (불일치 → switch 버튼)
 */
export function WalletGuard({
  requiredChainId,
  requiredChainName,
  children,
}: {
  requiredChainId: number;
  requiredChainName: string;
  children: React.ReactNode;
}) {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: switching } = useSwitchChain();

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <p className="text-sm text-muted-foreground">
          Connect your wallet to continue.
        </p>
        <ConnectButton />
      </div>
    );
  }

  if (chainId !== requiredChainId) {
    return (
      <Alert>
        <AlertCircle className="size-4" />
        <AlertTitle>Wrong network</AlertTitle>
        <AlertDescription className="flex flex-col gap-3">
          <span>
            This action requires <b>{requiredChainName}</b>. You are currently
            on chain id {chainId}.
          </span>
          <Button
            size="sm"
            className="w-fit"
            onClick={() => switchChain({ chainId: requiredChainId })}
            disabled={switching}
          >
            {switching ? "Switching…" : `Switch to ${requiredChainName}`}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return <>{children}</>;
}
