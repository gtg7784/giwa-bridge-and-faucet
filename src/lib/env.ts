/**
 * 환경변수 로딩 + 검증.
 * 
 * Signer 모드는 다음 중 하나 (감지 우선순위: AWS > GCP > priv key):
 * - AWS_KMS:     AWS_REGION + KMS_KEY_ID [+ AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY] (evm-kms-signer)
 * - GCP_KMS:     GCP_PROJECT_ID + GCP_LOCATION_ID + GCP_KEYRING_ID + GCP_KEY_ID + GCP_KEY_VERSION
 * - PRIVATE_KEY: FAUCET_PRIVATE_KEY (viem privateKeyToAccount, 개발용)
 */

type SignerMode = "aws-kms" | "gcp-kms" | "private-key";

export type EnvConfig = {
  signerMode: SignerMode;
  // AWS KMS
  awsRegion?: string;
  kmsKeyId?: string;
  // GCP KMS
  gcpProjectId?: string;
  gcpLocationId?: string;
  gcpKeyRingId?: string;
  gcpKeyId?: string;
  gcpKeyVersion?: string;
  gcpKeyFilename?: string;
  // Private key fallback
  faucetPrivateKey?: `0x${string}`;
  // App config
  cronSecret?: string;
  faucetDripAmountEth: string;
  bridgeThresholdEth: string;
  bridgeReserveEth: string;
  l1RpcUrl?: string;
  l2RpcUrl?: string;
};

function requireOne(name: string): string {
  const value = process.env[name];
  if (!value || value.length === 0) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

/**
 * 환경변수 로드. 서버 사이드에서만 호출.
 * SignerMode는 존재하는 env에서 자동 감지.
 */
export function loadEnv(): EnvConfig {
  const hasAwsKms = !!process.env.KMS_KEY_ID;
  const hasGcpKms = !!process.env.GCP_KEY_ID;
  const hasPrivateKey = !!process.env.FAUCET_PRIVATE_KEY;

  let signerMode: SignerMode;
  if (hasAwsKms) {
    signerMode = "aws-kms";
  } else if (hasGcpKms) {
    signerMode = "gcp-kms";
  } else if (hasPrivateKey) {
    signerMode = "private-key";
  } else {
    throw new Error(
      "No signer configured. Set one of: KMS_KEY_ID, GCP_KEY_ID, or FAUCET_PRIVATE_KEY",
    );
  }

  const config: EnvConfig = {
    signerMode,
    faucetDripAmountEth: process.env.FAUCET_DRIP_AMOUNT_ETH ?? "0.005",
    bridgeThresholdEth: process.env.BRIDGE_THRESHOLD_ETH ?? "0.1",
    bridgeReserveEth: process.env.BRIDGE_RESERVE_ETH ?? "0.05",
    cronSecret: process.env.CRON_SECRET,
    l1RpcUrl: process.env.L1_RPC_URL,
    l2RpcUrl: process.env.L2_RPC_URL,
  };

  if (signerMode === "aws-kms") {
    config.awsRegion = requireOne("AWS_REGION");
    config.kmsKeyId = requireOne("KMS_KEY_ID");
  } else if (signerMode === "gcp-kms") {
    config.gcpProjectId = requireOne("GCP_PROJECT_ID");
    config.gcpLocationId = requireOne("GCP_LOCATION_ID");
    config.gcpKeyRingId = requireOne("GCP_KEYRING_ID");
    config.gcpKeyId = requireOne("GCP_KEY_ID");
    config.gcpKeyVersion = process.env.GCP_KEY_VERSION ?? "1";
    config.gcpKeyFilename = process.env.GCP_KEY_FILENAME;
  } else {
    const pk = requireOne("FAUCET_PRIVATE_KEY");
    if (!pk.startsWith("0x") || pk.length !== 66) {
      throw new Error("FAUCET_PRIVATE_KEY must be a 0x-prefixed 32-byte hex string");
    }
    config.faucetPrivateKey = pk as `0x${string}`;
  }

  return config;
}
