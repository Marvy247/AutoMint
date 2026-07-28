# AutoMint — testnet-implementation

**Idle auto-mining dApp on Stellar (Soroban).**
Deploy NFT bots that accrue `$AMT` tokens 24/7. No tapping. Trade bots on a P2P marketplace. Compete on an on-chain leaderboard.

This branch is a **bare scaffold**. The folder structure, configs, and dependency manifests are in place — the actual contract logic and frontend code have been stripped out into `// TODO` placeholders. Every file maps to one or more issues on the [Issues tab](../../issues). Pick an issue, implement just that piece, and open a PR against this branch.

> Looking for the finished reference build? See the `main` branch.

---

## How it works (target behavior)

```
Register  ──► registry.register()
          ──► bot_nft.mint_basic()    (free Basic Bot)
          ──► accrual.start_accrual()

Every second (client-side interpolated):
  pending = (now − last_claim_ts) × total_rate / 3600

Claim     ──► accrual.claim()
          ──► registry.add_points()
          ──► token.mint()            if points ≥ 100

Marketplace:
  list    ──► bot_nft.transfer(seller → marketplace)   escrow
  buy     ──► token.transfer(buyer → seller + fee)
          ──► bot_nft.transfer(marketplace → buyer)
```

## Bot Tiers

| Tier    | Price         | Rate       |
|---------|---------------|------------|
| Basic   | Free          | 1 pt/hr    |
| Bronze  | 500 XLM       | 5 pt/hr    |
| Silver  | 2,000 XLM     | 25 pt/hr   |
| Gold    | 7,500 XLM     | 100 pt/hr  |
| Diamond | 25,000 XLM    | 500 pt/hr  |

100 points = 1 `$AMT` on claim. Marketplace fee: 2.5%.

---

## Repo layout

```
contracts/
  token/        AMT token contract        (Soroban, Rust)
  registry/     usernames + point totals
  bot_nft/      bot ownership + tiers
  accrual/      point accrual math + claims
  marketplace/  P2P escrow trading

frontend/
  src/app/            Next.js App Router pages
  src/components/     UI components
  src/hooks/          React Query hooks (data + mutations)
  src/lib/            stellar.ts (RPC/Freighter), contracts.ts (contract calls)
  src/store/          Zustand wallet store
  src/types/          shared TypeScript types
```

Every `.rs`/`.ts`/`.tsx` file under `contracts/` and `frontend/src/` currently contains only a `// TODO` stub. Config files (`Cargo.toml`, `package.json`, `tsconfig.json`, etc.) are untouched and functional.

---

## Getting started

```bash
# 1. Fork the repo, then clone your fork
git clone https://github.com/<your-username>/AutoMint.git
cd AutoMint
git checkout testnet-implementation

# 2. Rust + Stellar CLI (only needed for contract issues)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32v1-none
cargo install --locked stellar-cli --features opt

# 3. Frontend (only needed for frontend issues)
cd frontend
npm install
cp .env.example .env.local   # fill in contract IDs once deployed
npm run dev                  # http://localhost:3000
```

Install [Freighter](https://freighter.app) wallet and switch it to **Testnet** for frontend work.

## Picking up an issue

1. Browse [open issues](../../issues) — each one names the exact file and function/component to implement, with the expected behavior described.
2. Comment on the issue to get it assigned to you, so no one else duplicates the work.
3. Branch off `testnet-implementation`:
   ```bash
   git checkout -b issue-123-implement-claim testnet-implementation
   ```
4. Implement only what the issue asks for. Don't touch unrelated files — other issues depend on them staying untouched until their own PR lands.
5. Open a PR **against `testnet-implementation`** (not `main`), referencing the issue number (`Closes #123`).

## Tests

```bash
# Contracts (Rust)
cargo test --workspace

# Frontend (Jest + RTL)
cd frontend && npm test
```

No CI is configured on this branch — run tests locally before opening a PR.

## Deploy contracts (once implemented)

```bash
stellar keys generate mykey --network testnet
curl "https://friendbot.stellar.org/?addr=$(stellar keys address mykey)"
./scripts/deploy.sh testnet mykey
```

## Stack

- **Contracts** — Rust, Soroban SDK 21, `wasm32v1-none` target
- **Frontend** — Next.js 14, Tailwind, Zustand, React Query, Framer Motion
- **Wallet** — Freighter (Stellar browser extension), `@stellar/freighter-api` v3
- **Network** — Stellar Testnet, Soroban RPC
