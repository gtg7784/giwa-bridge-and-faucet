import { createPublicClient, createWalletClient, http } from "viem";
import type { PublicClient, WalletClient } from "viem";
import { sepolia, giwaSepolia } from "viem/chains";
import {
  publicActionsL1,
  publicActionsL2,
  walletActionsL1,
  walletActionsL2,
} from "viem/op-stack";
import { getFaucetAccount } from "./signer";
import { loadEnv } from "./env";

/**
 * viem clients for L1 (Sepolia) and L2 (Giwa Sepolia).
 *
 * publicClient: 읽기 전용 (getBalance, waitForTransactionReceipt, buildDepositTransaction 등)
 * walletClient: 서명 필요한 트랜잭션 전송 (depositTransaction, sendTransaction 등)
 *
 * L1/L2 확장(op-stack)은 브릿징에 필수: buildDepositTransaction은 publicClientL2에,
 * depositTransaction은 walletClientL1에 존재.
 */

const env = loadEnv();

export const publicClientL1 = createPublicClient({
  chain: sepolia,
  transport: http(env.l1RpcUrl),
}).extend(publicActionsL1());

export const publicClientL2 = createPublicClient({
  chain: giwaSepolia,
  transport: http(env.l2RpcUrl),
}).extend(publicActionsL2());

export type PublicClientL1 = typeof publicClientL1;
export type PublicClientL2 = typeof publicClientL2;

/**
 * Wallet client는 KMS signer 로딩이 async 이므로 factory 함수로 제공.
 * 요청 단위로 호출하되, account 자체는 signer.ts에서 캐싱됨.
 */
export async function getWalletClientL1() {
  const account = await getFaucetAccount();
  return createWalletClient({
    account,
    chain: sepolia,
    transport: http(env.l1RpcUrl),
  }).extend(walletActionsL1());
}

export async function getWalletClientL2() {
  const account = await getFaucetAccount();
  return createWalletClient({
    account,
    chain: giwaSepolia,
    transport: http(env.l2RpcUrl),
  }).extend(walletActionsL2());
}
