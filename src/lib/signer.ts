import { privateKeyToAccount } from "viem/accounts";
import type { LocalAccount } from "viem";
import { loadEnv } from "./env";

/**
 * KMS 또는 priv key 기반으로 viem LocalAccount 생성.
 * 서버 사이드에서만 호출. 결과는 요청 간 캐싱 (KMS getPublicKey는 비쌈).
 */
let cachedAccount: LocalAccount | null = null;

export async function getFaucetAccount(): Promise<LocalAccount> {
  if (cachedAccount) return cachedAccount;

  const env = loadEnv();

  if (env.signerMode === "aws-kms") {
    const { KmsSigner, toKmsAccount } = await import("evm-kms-signer");
    const signer = new KmsSigner({
      region: env.awsRegion!,
      keyId: env.kmsKeyId!,
    });
    cachedAccount = await toKmsAccount(signer);
  } else if (env.signerMode === "gcp-kms") {
    const { GcpSigner, toGcpKmsAccount } = await import("evm-kms-signer");
    const signer = new GcpSigner({
      projectId: env.gcpProjectId!,
      locationId: env.gcpLocationId!,
      keyRingId: env.gcpKeyRingId!,
      keyId: env.gcpKeyId!,
      keyVersion: env.gcpKeyVersion!,
      ...(env.gcpKeyFilename ? { keyFilename: env.gcpKeyFilename } : {}),
    });
    cachedAccount = await toGcpKmsAccount(signer);
  } else {
    cachedAccount = privateKeyToAccount(env.faucetPrivateKey!);
  }

  return cachedAccount;
}

/**
 * Faucet 지갑 주소만 필요할 때 사용.
 * KMS 모드에서도 첫 호출 이후 캐싱되므로 저렴.
 */
export async function getFaucetAddress(): Promise<`0x${string}`> {
  const account = await getFaucetAccount();
  return account.address;
}
