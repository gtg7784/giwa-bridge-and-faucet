"use client";
import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  metaMaskWallet,
  rabbyWallet,
  rainbowWallet,
  walletConnectWallet,
  injectedWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import { sepolia, giwaSepolia } from "viem/chains";

/**
 * wagmi + RainbowKit config.
 *
 * WalletConnect Project ID 필요: https://cloud.walletconnect.com
 * .env.local 에 NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID 세팅.
 * 미설정 시 dev placeholder 사용 (WalletConnect 지갑들은 안 뜨고, 브라우저 injected 만 사용 가능).
 *
 * getDefaultConfig 대신 connectorsForWallets 를 쓰는 이유:
 * getDefaultConfig 는 Coinbase 의 baseAccount connector 를 포함하는데, 이게 @x402/* optional dep 를
 * 참조해서 build 가 깨진다. 아래 목록은 그 문제 없는 지갑만.
 */

const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ??
  "REPLACE_WITH_WALLETCONNECT_PROJECT_ID";

if (
  typeof window !== "undefined" &&
  projectId === "REPLACE_WITH_WALLETCONNECT_PROJECT_ID"
) {
  console.warn(
    "[wagmi] NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID not set. WalletConnect wallets will not work. Injected wallets (MetaMask, Rabby, ...) still work.",
  );
}

const l1RpcUrl = process.env.NEXT_PUBLIC_L1_RPC_URL;
const l2RpcUrl = process.env.NEXT_PUBLIC_L2_RPC_URL;

const connectors = connectorsForWallets(
  [
    {
      groupName: "Popular",
      wallets: [
        metaMaskWallet,
        rabbyWallet,
        rainbowWallet,
        walletConnectWallet,
        injectedWallet,
      ],
    },
  ],
  { appName: "Giwa Bridge & Faucet", projectId },
);

export const wagmiConfig = createConfig({
  chains: [sepolia, giwaSepolia],
  connectors,
  transports: {
    [sepolia.id]: http(l1RpcUrl),
    [giwaSepolia.id]: http(l2RpcUrl),
  },
  ssr: true, // Next.js App Router
});
