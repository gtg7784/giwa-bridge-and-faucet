import { NextResponse } from "next/server";
import { formatEther, parseEther } from "viem";
import { getL2TransactionHashes } from "viem/op-stack";
import {
  getWalletClientL1,
  publicClientL1,
  publicClientL2,
} from "@/lib/viem-clients";
import { getFaucetAddress } from "@/lib/signer";
import { loadEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 최대 5분 (Vercel Pro 이상 필요할 수 있음)

/**
 * GET /api/cron/bridge
 *
 * Vercel Cron 이 매일 KST 00:00 (UTC 15:00) 에 호출.
 * L1 (Sepolia) 잔고가 threshold 이상이면 L2 (Giwa Sepolia) 로 브릿징.
 *
 * 인증: Vercel Cron 은 자동으로 `Authorization: Bearer $CRON_SECRET` 헤더를 붙임.
 * 로컬/외부에서 호출할 때도 같은 헤더 필요.
 */
export async function GET(req: Request) {
  const env = loadEnv();

  // Vercel Cron 인증
  if (env.cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${env.cronSecret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    const address = await getFaucetAddress();
    const l1Balance = await publicClientL1.getBalance({ address });

    const threshold = parseEther(env.bridgeThresholdEth);
    const reserve = parseEther(env.bridgeReserveEth);

    if (l1Balance < threshold) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "L1 balance below threshold",
        l1Balance: formatEther(l1Balance),
        threshold: env.bridgeThresholdEth,
        address,
      });
    }

    // reserve 만큼은 gas 를 위해 남기고 나머지를 브릿징
    if (l1Balance <= reserve) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "L1 balance <= reserve",
        l1Balance: formatEther(l1Balance),
        reserve: env.bridgeReserveEth,
        address,
      });
    }
    const amount = l1Balance - reserve;

    // L2 deposit transaction 파라미터 build
    const depositArgs = await publicClientL2.buildDepositTransaction({
      mint: amount,
      to: address,
    });

    // L1 에서 deposit 트랜잭션 전송
    const walletClientL1 = await getWalletClientL1();
    const depositHash = await walletClientL1.depositTransaction(depositArgs);
    console.log(`[cron/bridge] deposit tx on L1: ${depositHash}`);

    // L1 receipt 대기
    const depositReceipt = await publicClientL1.waitForTransactionReceipt({
      hash: depositHash,
    });

    // 대응하는 L2 tx hash 계산
    const [l2Hash] = getL2TransactionHashes(depositReceipt);
    console.log(`[cron/bridge] corresponding L2 tx: ${l2Hash}`);

    return NextResponse.json({
      ok: true,
      bridged: true,
      amount: formatEther(amount),
      from: address,
      l1TxHash: depositHash,
      l2TxHash: l2Hash,
      l1ExplorerUrl: `https://sepolia.etherscan.io/tx/${depositHash}`,
      l2ExplorerUrl: `https://sepolia-explorer.giwa.io/tx/${l2Hash}`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[cron/bridge] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
