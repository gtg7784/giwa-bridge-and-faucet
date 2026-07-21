import { NextResponse } from "next/server";
import { formatEther } from "viem";
import { publicClientL1, publicClientL2 } from "@/lib/viem-clients";
import { getFaucetAddress } from "@/lib/signer";
import { loadEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/balances
 *
 * Faucet 지갑의 L1 (Sepolia) / L2 (Giwa Sepolia) 잔고 + 요청 정책 (drip amount, cooldown) 조회.
 * 홈 페이지에서 표시 용도.
 */
export async function GET() {
  try {
    const env = loadEnv();
    const address = await getFaucetAddress();
    const [l1, l2] = await Promise.all([
      publicClientL1.getBalance({ address }),
      publicClientL2.getBalance({ address }),
    ]);
    return NextResponse.json({
      address,
      l1Balance: formatEther(l1),
      l2Balance: formatEther(l2),
      l1BalanceWei: l1.toString(),
      l2BalanceWei: l2.toString(),
      dripAmountEth: env.faucetDripAmountEth,
      cooldownHours: 24,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[balances] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
