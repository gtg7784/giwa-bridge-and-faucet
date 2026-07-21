"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { parseAbiItem, type Address, type Hash } from "viem";
import { sepolia, giwaSepolia } from "viem/chains";
import { getL2TransactionHashes } from "viem/op-stack";
import { useL1PublicClient } from "@/lib/op-clients";
import { l1StandardBridgeAddress } from "@/lib/tokens";
import { getLogsChunked, L1_CHUNK_SIZE } from "@/lib/get-logs-chunked";

const L1_PORTAL_ADDRESS = giwaSepolia.contracts.portal[sepolia.id].address;

const transactionDepositedEvent = parseAbiItem(
  "event TransactionDeposited(address indexed from, address indexed to, uint256 indexed version, bytes opaqueData)",
);

const erc20DepositInitiatedEvent = parseAbiItem(
  "event ERC20DepositInitiated(address indexed l1Token, address indexed l2Token, address indexed from, address to, uint256 amount, bytes extraData)",
);

const ethDepositInitiatedEvent = parseAbiItem(
  "event ETHDepositInitiated(address indexed from, address indexed to, uint256 amount, bytes extraData)",
);

/** ~14 days on Sepolia (12s block time) */
const L1_LOOKBACK_BLOCKS = 100_000n;

export type OnchainDeposit = {
  l1Hash: Hash;
  /** L1 receipt 로부터 파생 (viem/op-stack) */
  l2Hash: Hash;
  /** L1 block number (정렬용) */
  blockNumber: bigint;
  /** wei (ETH) 또는 base units (ERC-20). ETH direct 는 L1 tx.value 에서 조회. */
  amount: bigint;
  /** L2 recipient */
  to: Address;
  kind: "eth" | "erc20";
  l1Token?: Address;
  l2Token?: Address;
};

/**
 * 현재 연결된 지갑의 L1 → L2 deposits 를 RPC 에서 조회.
 *
 * L1 events:
 * - TransactionDeposited(from == user)   → ETH direct via OptimismPortal.depositTransaction
 * - ETHDepositInitiated(from == user)    → ETH via L1StandardBridge.depositETH
 * - ERC20DepositInitiated(from == user)  → ERC-20 via L1StandardBridge.depositERC20To
 *
 * 각 deposit 마다 L1 receipt 을 조회해 viem/op-stack 의 getL2TransactionHashes 로 L2 tx hash 를 파생.
 * ETH direct 는 event 에 amount 가 없으므로 L1 tx 를 조회해 value 를 가져옴.
 */
export function useOnchainDeposits() {
  const { address } = useAccount();
  const publicClientL1 = useL1PublicClient();

  return useQuery({
    queryKey: [onchainDepositsQueryKey, publicClientL1.chain.id, address],
    enabled: !!address,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<OnchainDeposit[]> => {
      if (!address) return [];

      const l1Latest = await publicClientL1.getBlockNumber();
      const l1FromBlock =
        l1Latest > L1_LOOKBACK_BLOCKS ? l1Latest - L1_LOOKBACK_BLOCKS : 0n;

      const [txDepositedLogs, ethBridgeLogs, erc20BridgeLogs] = await Promise.all([
        getLogsChunked(
          (from, to) =>
            publicClientL1.getLogs({
              address: L1_PORTAL_ADDRESS,
              event: transactionDepositedEvent,
              args: { from: address },
              fromBlock: from,
              toBlock: to,
            }),
          l1FromBlock,
          l1Latest,
          L1_CHUNK_SIZE,
        ),
        getLogsChunked(
          (from, to) =>
            publicClientL1.getLogs({
              address: l1StandardBridgeAddress,
              event: ethDepositInitiatedEvent,
              args: { from: address },
              fromBlock: from,
              toBlock: to,
            }),
          l1FromBlock,
          l1Latest,
          L1_CHUNK_SIZE,
        ),
        getLogsChunked(
          (from, to) =>
            publicClientL1.getLogs({
              address: l1StandardBridgeAddress,
              event: erc20DepositInitiatedEvent,
              args: { from: address },
              fromBlock: from,
              toBlock: to,
            }),
          l1FromBlock,
          l1Latest,
          L1_CHUNK_SIZE,
        ),
      ]);

      const map = new Map<Hash, OnchainDeposit>();

      // 1) ERC-20 via L1StandardBridge — event 에 모든 metadata 있음
      await Promise.all(
        erc20BridgeLogs.map(async (log) => {
          const { l1Token, l2Token, to, amount } = log.args;
          if (!amount || !to || !l1Token || !l2Token) return;
          const l2Hash = await deriveL2Hash(publicClientL1, log.transactionHash);
          if (!l2Hash) return;
          map.set(log.transactionHash, {
            l1Hash: log.transactionHash,
            l2Hash,
            blockNumber: log.blockNumber,
            amount,
            to,
            kind: "erc20",
            l1Token,
            l2Token,
          });
        }),
      );

      // 2) ETH via L1StandardBridge
      await Promise.all(
        ethBridgeLogs.map(async (log) => {
          const { to, amount } = log.args;
          if (!amount || !to) return;
          if (map.has(log.transactionHash)) return;
          const l2Hash = await deriveL2Hash(publicClientL1, log.transactionHash);
          if (!l2Hash) return;
          map.set(log.transactionHash, {
            l1Hash: log.transactionHash,
            l2Hash,
            blockNumber: log.blockNumber,
            amount,
            to,
            kind: "eth",
          });
        }),
      );

      // 3) ETH direct via OptimismPortal (deposit-eth.tsx 가 쓰는 경로)
      // ERC-20 도 TransactionDeposited 를 emit 하지만 from=L1StandardBridge 라 여기 안 잡힘.
      // ETH via L1StandardBridge 도 여기 잡히지 않음 (from=L1StandardBridge 이라).
      await Promise.all(
        txDepositedLogs.map(async (log) => {
          const { to } = log.args;
          if (!to) return;
          if (map.has(log.transactionHash)) return;
          try {
            const tx = await publicClientL1.getTransaction({
              hash: log.transactionHash,
            });
            const l2Hash = await deriveL2Hash(
              publicClientL1,
              log.transactionHash,
            );
            if (!l2Hash) return;
            map.set(log.transactionHash, {
              l1Hash: log.transactionHash,
              l2Hash,
              blockNumber: log.blockNumber,
              amount: tx.value,
              to,
              kind: "eth",
            });
          } catch (err) {
            console.warn(
              "[onchain-deposits] failed to fetch ETH direct tx:",
              log.transactionHash,
              err instanceof Error ? err.message : err,
            );
          }
        }),
      );

      return Array.from(map.values()).sort((a, b) =>
        b.blockNumber > a.blockNumber ? 1 : b.blockNumber < a.blockNumber ? -1 : 0,
      );
    },
  });
}

async function deriveL2Hash(
  publicClientL1: ReturnType<typeof useL1PublicClient>,
  l1TxHash: Hash,
): Promise<Hash | undefined> {
  try {
    const receipt = await publicClientL1.getTransactionReceipt({ hash: l1TxHash });
    const [l2Hash] = getL2TransactionHashes(receipt);
    return l2Hash;
  } catch (err) {
    console.warn(
      "[onchain-deposits] failed to derive L2 hash:",
      l1TxHash,
      err instanceof Error ? err.message : err,
    );
    return undefined;
  }
}

export const onchainDepositsQueryKey = "onchain-deposits";
