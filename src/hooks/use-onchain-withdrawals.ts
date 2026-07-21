"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import {
  parseAbiItem,
  parseEventLogs,
  type Address,
  type Hash,
} from "viem";
import { sepolia, giwaSepolia } from "viem/chains";
import { useL1PublicClient, useL2PublicClient } from "@/lib/op-clients";
import { l2StandardBridgeAddress } from "@/lib/tokens";
import {
  getLogsChunked,
  L1_CHUNK_SIZE,
  L2_CHUNK_SIZE,
} from "@/lib/get-logs-chunked";

const L2_TO_L1_MESSAGE_PASSER =
  "0x4200000000000000000000000000000000000016" as const;

const L1_PORTAL_ADDRESS = giwaSepolia.contracts.portal[sepolia.id].address;

const messagePassedEvent = parseAbiItem(
  "event MessagePassed(uint256 indexed nonce, address indexed sender, address indexed target, uint256 value, uint256 gasLimit, bytes data, bytes32 withdrawalHash)",
);

const withdrawalInitiatedEvent = parseAbiItem(
  "event WithdrawalInitiated(address indexed l1Token, address indexed l2Token, address indexed from, address to, uint256 amount, bytes extraData)",
);

const withdrawalProvenEvent = parseAbiItem(
  "event WithdrawalProven(bytes32 indexed withdrawalHash, address indexed from, address indexed to)",
);

const withdrawalFinalizedEvent = parseAbiItem(
  "event WithdrawalFinalized(bytes32 indexed withdrawalHash, bool success)",
);

/** ~6 days on Giwa Sepolia (1s block time) - 7-day challenge period 커버 */
const L2_LOOKBACK_BLOCKS = 500_000n;
/** ~14 days on Sepolia (12s block time) */
const L1_LOOKBACK_BLOCKS = 100_000n;

export type OnchainWithdrawal = {
  l2Hash: Hash;
  withdrawalHash: Hash;
  blockNumber: bigint;
  amount: bigint;
  to: Address;
  kind: "eth" | "erc20";
  l2Token?: Address;
  l1Token?: Address;
  proveHash?: Hash;
  finalizeHash?: Hash;
};

export function useOnchainWithdrawals() {
  const { address } = useAccount();
  const publicClientL1 = useL1PublicClient();
  const publicClientL2 = useL2PublicClient();

  return useQuery({
    queryKey: [
      onchainWithdrawalsQueryKey,
      publicClientL2.chain.id,
      publicClientL1.chain.id,
      address,
    ],
    enabled: !!address,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<OnchainWithdrawal[]> => {
      if (!address) return [];

      const l2Latest = await publicClientL2.getBlockNumber();
      const l2FromBlock =
        l2Latest > L2_LOOKBACK_BLOCKS ? l2Latest - L2_LOOKBACK_BLOCKS : 0n;

      const [messageLogs, erc20Logs] = await Promise.all([
        getLogsChunked(
          (from, to) =>
            publicClientL2.getLogs({
              address: L2_TO_L1_MESSAGE_PASSER,
              event: messagePassedEvent,
              args: { sender: address },
              fromBlock: from,
              toBlock: to,
            }),
          l2FromBlock,
          l2Latest,
          L2_CHUNK_SIZE,
        ),
        getLogsChunked(
          (from, to) =>
            publicClientL2.getLogs({
              address: l2StandardBridgeAddress,
              event: withdrawalInitiatedEvent,
              args: { from: address },
              fromBlock: from,
              toBlock: to,
            }),
          l2FromBlock,
          l2Latest,
          L2_CHUNK_SIZE,
        ),
      ]);

      const map = new Map<Hash, OnchainWithdrawal>();

      for (const log of messageLogs) {
        const { value, target, withdrawalHash } = log.args;
        if (!withdrawalHash || !target) continue;
        map.set(log.transactionHash, {
          l2Hash: log.transactionHash,
          withdrawalHash,
          blockNumber: log.blockNumber,
          amount: value ?? 0n,
          to: target,
          kind: "eth",
        });
      }

      // ERC-20: MessagePassed sender 가 L2StandardBridge 라 위 필터에 안 잡힘.
      // 각 WithdrawalInitiated tx receipt 를 조회해 MessagePassed 를 파싱.
      await Promise.all(
        erc20Logs.map(async (log) => {
          const { l1Token, l2Token, to, amount } = log.args;
          if (!amount || !to || !l1Token || !l2Token) return;

          try {
            const receipt = await publicClientL2.getTransactionReceipt({
              hash: log.transactionHash,
            });
            const parsed = parseEventLogs({
              abi: [messagePassedEvent],
              logs: receipt.logs,
            });
            const msgLog = parsed[0];
            if (!msgLog?.args.withdrawalHash) return;

            map.set(log.transactionHash, {
              l2Hash: log.transactionHash,
              withdrawalHash: msgLog.args.withdrawalHash,
              blockNumber: log.blockNumber,
              amount,
              to,
              kind: "erc20",
              l1Token,
              l2Token,
            });
          } catch (err) {
            console.warn(
              "[onchain-withdrawals] failed to fetch ERC-20 receipt:",
              log.transactionHash,
              err instanceof Error ? err.message : err,
            );
          }
        }),
      );

      const withdrawals = Array.from(map.values());
      const withdrawalHashes = withdrawals.map((w) => w.withdrawalHash);

      if (withdrawalHashes.length > 0) {
        const l1Latest = await publicClientL1.getBlockNumber();
        const l1FromBlock =
          l1Latest > L1_LOOKBACK_BLOCKS ? l1Latest - L1_LOOKBACK_BLOCKS : 0n;

        try {
          const [provenLogs, finalizedLogs] = await Promise.all([
            getLogsChunked(
              (from, to) =>
                publicClientL1.getLogs({
                  address: L1_PORTAL_ADDRESS,
                  event: withdrawalProvenEvent,
                  args: { withdrawalHash: withdrawalHashes },
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
                  address: L1_PORTAL_ADDRESS,
                  event: withdrawalFinalizedEvent,
                  args: { withdrawalHash: withdrawalHashes },
                  fromBlock: from,
                  toBlock: to,
                }),
              l1FromBlock,
              l1Latest,
              L1_CHUNK_SIZE,
            ),
          ]);

          const proveMap = new Map<Hash, Hash>();
          for (const log of provenLogs) {
            if (log.args.withdrawalHash) {
              proveMap.set(log.args.withdrawalHash, log.transactionHash);
            }
          }
          const finalizeMap = new Map<Hash, Hash>();
          for (const log of finalizedLogs) {
            if (log.args.withdrawalHash && log.args.success !== false) {
              finalizeMap.set(log.args.withdrawalHash, log.transactionHash);
            }
          }

          for (const w of withdrawals) {
            w.proveHash = proveMap.get(w.withdrawalHash);
            w.finalizeHash = finalizeMap.get(w.withdrawalHash);
          }
        } catch (err) {
          console.warn(
            "[onchain-withdrawals] L1 event enrichment failed:",
            err instanceof Error ? err.message : err,
          );
        }
      }

      return withdrawals.sort((a, b) =>
        b.blockNumber > a.blockNumber ? 1 : b.blockNumber < a.blockNumber ? -1 : 0,
      );
    },
  });
}

export const onchainWithdrawalsQueryKey = "onchain-withdrawals";
