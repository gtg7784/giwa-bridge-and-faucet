import { NextResponse } from "next/server";
import { formatEther, isAddress, parseEther } from "viem";
import { getWalletClientL2, publicClientL2 } from "@/lib/viem-clients";
import { loadEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/faucet
 * body: { address: `0x${string}` }
 *
 * Giwa Sepolia ETH를 요청 주소에 소량 전송.
 *
 * 기본 rate limit: address 기준 24h 1회 (in-memory).
 * 프로덕션은 Upstash Redis 등 외부 스토어로 교체 필요.
 */

const cooldownMs = 24 * 60 * 60 * 1000;
const lastRequested = new Map<string, number>();

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as
      | { address?: string }
      | null;
    const raw = body?.address?.trim();

    if (!raw || !isAddress(raw)) {
      return NextResponse.json(
        { error: "Invalid Ethereum address" },
        { status: 400 },
      );
    }
    const address = raw.toLowerCase() as `0x${string}`;

    // rate limit
    const now = Date.now();
    const prev = lastRequested.get(address);
    if (prev && now - prev < cooldownMs) {
      const remainingH = Math.ceil((cooldownMs - (now - prev)) / 3_600_000);
      return NextResponse.json(
        { error: `Rate limited. Try again in ~${remainingH}h.` },
        { status: 429 },
      );
    }

    const env = loadEnv();
    const value = parseEther(env.faucetDripAmountEth);

    // faucet 잔고 확인
    const walletClient = await getWalletClientL2();
    const from = walletClient.account.address;
    const balance = await publicClientL2.getBalance({ address: from });
    if (balance < value) {
      return NextResponse.json(
        {
          error: "Faucet drained. Please wait for the next bridge cycle.",
          faucetBalance: formatEther(balance),
        },
        { status: 503 },
      );
    }

    const hash = await walletClient.sendTransaction({
      to: address,
      value,
    });
    lastRequested.set(address, now);

    return NextResponse.json({
      ok: true,
      txHash: hash,
      amount: env.faucetDripAmountEth,
      to: address,
      explorerUrl: `https://sepolia-explorer.giwa.io/tx/${hash}`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[faucet] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
