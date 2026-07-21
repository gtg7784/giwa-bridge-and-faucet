"use client";

import { useMemo } from "react";
import { useConnectorClient } from "wagmi";
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  type Client,
  type Transport,
} from "viem";
import { sepolia, giwaSepolia } from "viem/chains";
import {
  publicActionsL1,
  publicActionsL2,
  walletActionsL1,
  walletActionsL2,
} from "viem/op-stack";

/**
 * op-stack 확장이 붙은 viem client 를 제공하는 hook 들.
 *
 * - publicClient : read-only. 매 hook 호출마다 재생성되지 않도록 모듈 top-level 에 singleton 생성.
 *   Chain 이 concrete type 이라 buildDepositTransaction / buildProveWithdrawal /
 *   getWithdrawalStatus / waitToProve / waitToFinalize 등 op-stack action 이 정상 추론됨.
 *
 * - walletClient : 사용자 지갑에 서명 요청 필요. wagmi 의 useConnectorClient 로
 *   raw transport + account 를 얻은 뒤 viem 의 createWalletClient 로 concrete chain 을 지정해 재구성.
 *   이렇게 하면 writeContract / depositTransaction / proveWithdrawal / finalizeWithdrawal /
 *   initiateWithdrawal 의 제네릭이 잘 추론됨.
 */

const l1RpcUrl = process.env.NEXT_PUBLIC_L1_RPC_URL;
const l2RpcUrl = process.env.NEXT_PUBLIC_L2_RPC_URL;

const publicClientL1Singleton = createPublicClient({
  chain: sepolia,
  transport: http(l1RpcUrl),
}).extend(publicActionsL1());

const publicClientL2Singleton = createPublicClient({
  chain: giwaSepolia,
  transport: http(l2RpcUrl),
}).extend(publicActionsL2());

export function useL1PublicClient() {
  return publicClientL1Singleton;
}

export function useL2PublicClient() {
  return publicClientL2Singleton;
}

function connectorToWalletClientL1(client: Client<Transport>) {
  const { account, transport } = client;
  if (!account) return undefined;
  return createWalletClient({
    account,
    chain: sepolia,
    transport: custom(transport),
  }).extend(walletActionsL1());
}

function connectorToWalletClientL2(client: Client<Transport>) {
  const { account, transport } = client;
  if (!account) return undefined;
  return createWalletClient({
    account,
    chain: giwaSepolia,
    transport: custom(transport),
  }).extend(walletActionsL2());
}

export function useL1WalletClient() {
  const { data } = useConnectorClient({ chainId: sepolia.id });
  return useMemo(
    () => (data ? connectorToWalletClientL1(data) : undefined),
    [data],
  );
}

export function useL2WalletClient() {
  const { data } = useConnectorClient({ chainId: giwaSepolia.id });
  return useMemo(
    () => (data ? connectorToWalletClientL2(data) : undefined),
    [data],
  );
}
