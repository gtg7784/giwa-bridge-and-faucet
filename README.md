# Giwa Sepolia Faucet, Bridge & Auto-Bridger

Community-funded [Giwa Sepolia](https://sepolia-explorer.giwa.io) faucet **and**
self-serve L1↔L2 bridge, in a single Next.js app.

**Home (`/`) — Faucet**
- **Faucet address** displayed on the homepage. Click to copy.
- Anyone can donate Sepolia ETH **or** Giwa Sepolia ETH to that address.
- **Daily at 00:00 KST**, a Vercel Cron job checks the L1 (Sepolia) balance.
  If it is above `BRIDGE_THRESHOLD_ETH`, the surplus (minus a reserve) is
  bridged L1→L2 via the standard OP Stack `depositTransaction` flow.
- Users request a small drip of Giwa Sepolia ETH from the UI (0.005 ETH per
  address per 24h).

**`/bridge` — User bridge**
- Users connect their **own** wallet (via RainbowKit) and move ETH or ERC-20
  tokens between Sepolia and Giwa Sepolia.
- Deposit (L1 → L2): single tx for ETH, approve + deposit for ERC-20.
- Withdraw (L2 → L1): 3-step flow (initiate → prove ~2h → finalize ~7 days).
  The user's active withdrawals are queried directly from RPC events
  (`L2ToL1MessagePasser.MessagePassed` + `L2StandardBridge.WithdrawalInitiated`),
  filtered by the connected wallet's address. **No local state** — works across
  devices and survives cache clears. Live status per row via
  `getWithdrawalStatus`.

Stack: **Next.js 16 (App Router) + Tailwind v4 + shadcn/ui + viem (op-stack) + wagmi + RainbowKit + evm-kms-signer**, deployed on **Vercel**.

---

## Setup

### 1. Install & scaffold

```bash
bun install
```

### 2. Create the faucet wallet

Uses [`cast wallet new`](https://book.getfoundry.sh/reference/cast/cast-wallet-new) (Foundry required).

```bash
bun run create-wallet
```

The output shows the **address** and **private key** exactly once. Back it up
safely, then pick **one** of the signer options below.

### 3. Configure a signer

Copy `.env.example` to `.env.local` and fill in **one** of these sections. The
app auto-detects which mode to use in the order **AWS KMS → GCP KMS → Private key**.

#### Option A — Private key (simplest, dev-friendly)

```bash
FAUCET_PRIVATE_KEY=0x...
```

Fine for local testing and small-scale production if you trust Vercel's
encrypted env storage.

#### Option B — AWS KMS (recommended for production)

1. Create an **asymmetric ECC_SECG_P256K1** key (Sign & verify) in AWS KMS.
   - Either generate a new key inside KMS and use its address as the faucet, **or**
   - use the *Import external key material* flow to store the private key from step 2.
2. Attach an IAM policy granting `kms:GetPublicKey` and `kms:Sign` on that key.
3. Set env vars:
   ```bash
   AWS_REGION=us-east-1
   KMS_KEY_ID=arn:aws:kms:us-east-1:123456789012:key/xxxx
   # Only if you're not using IAM roles / EKS Pod Identity:
   AWS_ACCESS_KEY_ID=...
   AWS_SECRET_ACCESS_KEY=...
   ```
4. Once verified, **delete** the local plaintext private key.

#### Option C — GCP KMS

Create an **Elliptic Curve P-256 (secp256k1)** asymmetric signing key. Grant
`roles/cloudkms.cryptoKeySignerVerifier` to the service account. Then:

```bash
GCP_PROJECT_ID=...
GCP_LOCATION_ID=global
GCP_KEYRING_ID=...
GCP_KEY_ID=...
GCP_KEY_VERSION=1
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

### 4. Run locally

```bash
bun run dev
```

Open http://localhost:3000. If the balances load, the signer works.

### 5. Deploy to Vercel

```bash
vercel deploy
```

Set the same env vars in **Vercel → Project → Settings → Environment Variables**
(as *Encrypted*). Also set `CRON_SECRET` — Vercel automatically sends it as
`Authorization: Bearer $CRON_SECRET` on cron requests. The route rejects
mismatched headers.

The cron is declared in [`vercel.json`](./vercel.json):

```json
{
  "crons": [{ "path": "/api/cron/bridge", "schedule": "0 15 * * *" }]
}
```

`0 15 * * *` UTC = **00:00 KST**.

---

## App config

All optional, defaults shown:

| Env                                    | Default | Purpose                                                                   |
| -------------------------------------- | ------- | ------------------------------------------------------------------------- |
| `FAUCET_DRIP_AMOUNT_ETH`               | `0.005` | Amount sent per faucet request (per address per 24h)                      |
| `BRIDGE_THRESHOLD_ETH`                 | `0.1`   | Cron only bridges when L1 balance is at least this                        |
| `BRIDGE_RESERVE_ETH`                   | `0.05`  | Kept on L1 as gas buffer; bridged = balance − reserve                     |
| `L1_RPC_URL`                           | (viem)  | Server-side Sepolia RPC (Alchemy/Infura recommended)                      |
| `L2_RPC_URL`                           | (viem)  | Server-side Giwa Sepolia RPC                                              |
| `NEXT_PUBLIC_L1_RPC_URL`               | (viem)  | Client-side Sepolia RPC (exposed to browser; use public RPC)              |
| `NEXT_PUBLIC_L2_RPC_URL`               | (viem)  | Client-side Giwa Sepolia RPC                                              |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | (none)  | [WalletConnect Cloud](https://cloud.walletconnect.com) project ID.        |
| `CRON_SECRET`                          | (none)  | Required for prod; blocks unauthorized cron invocations                   |

> Without `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`, only injected wallets
> (MetaMask, Rabby, Coinbase Wallet extension, ...) work in the bridge UI.
> WalletConnect-based mobile wallets need this ID.

---

## Routes

### Pages

| Path       | Purpose                                                          |
| ---------- | ---------------------------------------------------------------- |
| `/`        | Faucet homepage (donation address + request drip)                |
| `/bridge`  | User-signed L1↔L2 bridge (ETH + ERC-20, deposit + withdraw)      |

### API

| Method | Path                | Purpose                                                  |
| ------ | ------------------- | -------------------------------------------------------- |
| GET    | `/api/balances`     | Faucet address + L1/L2 balances + drip amount + cooldown |
| POST   | `/api/faucet`       | Send drip. Body: `{ "address": "0x..." }`. 24h cooldown. |
| GET    | `/api/cron/bridge`  | Vercel Cron endpoint. L1→L2 bridging.                    |

Manual cron test:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://your-domain.vercel.app/api/cron/bridge
```

---

## Notes

- **Rate limit is in-memory** in `/api/faucet`. Serverless instances don't
  share state, so the practical limit is per-instance. Swap in Upstash Redis
  or Vercel KV for a real global limit.
- The bridge flow follows the reference in `viem/op-stack`:
  - **Deposit ETH**: `publicClientL2.buildDepositTransaction()` →
    `walletClientL1.depositTransaction()` → `getL2TransactionHashes(receipt)`.
  - **Deposit ERC-20**: `approve()` on the L1 token →
    `L1StandardBridge.depositERC20To()`.
  - **Withdraw ETH**: `publicClientL1.buildInitiateWithdrawal()` →
    `walletClientL2.initiateWithdrawal()` → wait ~2h →
    `publicClientL1.waitToProve()` → `publicClientL2.buildProveWithdrawal()` →
    `walletClientL1.proveWithdrawal()` → wait ~7 days →
    `walletClientL1.finalizeWithdrawal()`.
  - **Withdraw ERC-20**: `L2StandardBridge.withdrawTo()` → same prove/finalize
    flow as ETH.
- **Withdrawals are discovered from L2 RPC events** (last ~500k blocks ≈ 6 days on
  Giwa @ 1s block time — a bit more than one full 7-day challenge period).
  Queried via `getLogs` on `L2ToL1MessagePasser.MessagePassed`
  (`sender == user`) for direct ETH withdrawals and `L2StandardBridge.WithdrawalInitiated`
  (`from == user`) for ERC-20 withdrawals, then deduped by L2 tx hash.
  Falls back to chunked queries if the RPC rejects the full range.
  Live status via `getWithdrawalStatus` polled every 60s per row.
- L1→L2 finality on Giwa Sepolia is ~1–3 minutes. The cron endpoint returns as
  soon as the L1 receipt lands; L2 processing continues in the background.
- The cron endpoint sets `maxDuration = 300` seconds. This matches the Vercel
  **Pro** cron limit, which is enough for the L1 receipt wait in most cases.

## Security

- Private keys are **never** logged or returned by any endpoint.
- Faucet address only is exposed via `/api/balances`.
- With KMS mode the key never leaves the KMS boundary — signing happens inside AWS/GCP.
- `.env*` is gitignored.
