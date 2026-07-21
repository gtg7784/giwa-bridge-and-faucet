#!/usr/bin/env bun
/**
 * cast wallet new 를 실행해 새 EOA를 생성하고 priv key + address 를 콘솔에 출력.
 *
 * 사용:
 *   bun run scripts/create-wallet.ts
 *
 * ⚠️  출력된 priv key 는 절대 커밋하지 말 것.
 *     실전에서는 이 값을 AWS/GCP KMS 에 import 하거나,
 *     Vercel Env(암호화 secret) 로 FAUCET_PRIVATE_KEY 에 저장한 뒤 로컬에서 삭제.
 */
import { spawnSync } from "node:child_process";

function fail(msg: string): never {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

const which = spawnSync("which", ["cast"], { encoding: "utf8" });
if (which.status !== 0 || !which.stdout.trim()) {
  fail(
    "cast (foundry) not found. Install: https://book.getfoundry.sh/getting-started/installation",
  );
}

const result = spawnSync("cast", ["wallet", "new"], { encoding: "utf8" });
if (result.status !== 0) {
  fail(`cast wallet new failed:\n${result.stderr}`);
}

// cast wallet new 출력 형식:
//   Successfully created new keypair.
//   Address:     0x...
//   Private key: 0x...
const out = result.stdout;
const addressMatch = out.match(/Address:\s+(0x[a-fA-F0-9]{40})/);
const pkMatch = out.match(/Private key:\s+(0x[a-fA-F0-9]{64})/);
if (!addressMatch || !pkMatch) {
  fail(`Could not parse cast output:\n${out}`);
}

const address = addressMatch[1];
const privateKey = pkMatch[1];

console.log("");
console.log("════════════════════════════════════════════════════════════════════");
console.log("  🎉 New faucet wallet created");
console.log("════════════════════════════════════════════════════════════════════");
console.log("");
console.log(`  Address:      ${address}`);
console.log(`  Private key:  ${privateKey}`);
console.log("");
console.log("────────────────────────────────────────────────────────────────────");
console.log("  다음 단계 (하나 선택):");
console.log("────────────────────────────────────────────────────────────────────");
console.log("");
console.log("  A) 로컬/개발 (간단, 보안성 낮음):");
console.log("     .env.local 에 다음 추가:");
console.log(`       FAUCET_PRIVATE_KEY=${privateKey}`);
console.log("");
console.log("  B) 프로덕션 (Vercel):");
console.log("     Vercel 대시보드 > Project > Settings > Environment Variables:");
console.log(`       FAUCET_PRIVATE_KEY=${privateKey}   (Encrypted)`);
console.log("");
console.log("  C) AWS KMS (권장, priv key 를 KMS 로 import):");
console.log("     1. AWS KMS 에서 ECC_SECG_P256K1 asymmetric key 생성");
console.log("        (또는 External Key Material import 로 위 priv key 를 import)");
console.log("     2. .env.local / Vercel Env:");
console.log("        AWS_REGION=us-east-1");
console.log("        KMS_KEY_ID=arn:aws:kms:...");
console.log("        AWS_ACCESS_KEY_ID=...   (IAM role 미사용 시)");
console.log("        AWS_SECRET_ACCESS_KEY=...");
console.log("     3. 위 priv key 는 안전한 백업 후 삭제");
console.log("");
console.log("  D) GCP KMS: README.md 참고");
console.log("");
console.log("════════════════════════════════════════════════════════════════════");
console.log("");
