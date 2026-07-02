# CHREMA Contracts — CHREMACOIN (CRMC)

[![CI](https://github.com/ChremaCoin/chrema-contracts/actions/workflows/ci.yml/badge.svg)](https://github.com/ChremaCoin/chrema-contracts/actions/workflows/ci.yml)
[![Audit: CertiK](https://img.shields.io/badge/Audit-CertiK-brightgreen)](https://skynet.certik.com/projects/chremacoin)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-blue)](https://docs.soliditylang.org/en/v0.8.20/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

Official smart contract repository for **CHREMACOIN (CRMC)** — a gold-linked RWA token
by the CHREMA project, deployed on **Polygon PoS**.

> 🌐 Website: [chrema.net](https://chrema.net) · 🛡️ CertiK Skynet: [skynet.certik.com/projects/chremacoin](https://skynet.certik.com/projects/chremacoin)

---

## 📌 Deployed Contract (Current)

| Item | Value |
|---|---|
| **Chain** | Polygon PoS (chainId `137`) |
| **Contract address** | [`0x61cA155F1660b0af117Ed00321d1c3EE264ef943`](https://polygonscan.com/token/0x61cA155F1660b0af117Ed00321d1c3EE264ef943) |
| **Token standard** | ERC-20 compatible (BEP-20 interface superset) |
| **Name / Symbol** | `CHREMACOIN` / `CRMC` |
| **Decimals** | `8` |
| **Total supply** | `50,000,000 CRMC` (fixed — **no mint function**) |
| **Compiler** | Solidity `0.8.20`, optimizer enabled (200 runs) <!-- TODO: confirm on Polygonscan --> |
| **Deployment tx** | `TODO: 0x…` <!-- fill from Polygonscan contract creation tx --> |
| **Source verification** | ✅ Verified on Polygonscan |
| **Audit** | ✅ [CertiK audit report](./audit/README.md) (delivered 2026-03-25) |

### Legacy contract (deprecated)

| Item | Value |
|---|---|
| Chain | Ethereum Mainnet |
| Address | [`0x9ac4ee539403e3f101b9ae3620926f2ded0d0b99`](https://etherscan.io/token/0x9ac4ee539403e3f101b9ae3620926f2ded0d0b99) |
| Status | **Deprecated** — replaced 1:1 by the Polygon contract. See [docs/MIGRATION.md](./docs/MIGRATION.md) |

---

## 🔁 Contract Migration (Ethereum → Polygon)

CRMC migrated from the legacy Ethereum contract to a new Polygon contract at a **1:1 ratio**.
The migration resolved audit findings, modernized the codebase from Solidity `0.4.24` to `0.8.20`,
and moved the token to Polygon for lower fees and ecosystem alignment.

Full details, rationale, audit-item mapping, and swap procedure:
**→ [docs/MIGRATION.md](./docs/MIGRATION.md)**

---

## 🗂 Repository Structure

```
chrema-contracts/
├── contracts/
│   └── CHREMACOIN.sol          # v3 — deployed source on Polygon
├── legacy/
│   └── CHREMACOIN_v1_ethereum.sol  # archived Ethereum contract (Solidity 0.4.24, not compiled)
├── test/
│   └── CHREMACOIN.test.js      # 32 tests: transfer/approve/pause/lock/burn/roles/edge cases
├── scripts/
│   ├── deploy.js               # deployment script (Hardhat)
│   └── verify.js               # Polygonscan verification helper
├── deployments/
│   └── polygon-mainnet.md      # deployment record
├── docs/
│   ├── MIGRATION.md            # Ethereum → Polygon 1:1 swap documentation
│   ├── ADMIN_ROLES.md          # owner/supervisor roles, multisig & timelock disclosure
│   └── AUDIT.md                # CertiK findings mapped to deployed code
├── audit/
│   └── README.md               # audit report links
├── .github/workflows/ci.yml    # CI: compile + test + Solhint + Slither
├── hardhat.config.js
├── SECURITY.md
└── LICENSE
```

## 🧩 Token Features

- **Fixed supply** — 50,000,000 CRMC minted at deployment; no `mint` function exists.
- **Burnable** — `burn` / `burnFrom` restricted to supervisor role (audit item CHC-04).
- **Pausable** — owner can pause transfers in emergencies.
- **Vesting locks** — `transferToLockedBalance` supports up to 3-phase time-locked distributions
  (used for team/partner vesting per tokenomics).
- **Wallet lock** — supervisor can freeze a compromised or sanctioned wallet's outgoing transfers.
- **Transparency helpers** — `isSupervisor`, `isWalletLocked`, `hasActiveLock` public views.

Admin capabilities, key management, multisig and timelock status are disclosed in
**→ [docs/ADMIN_ROLES.md](./docs/ADMIN_ROLES.md)**

## 🛡 Security

- CertiK audit: 0 critical / 0 major findings. All medium and minor items resolved or
  acknowledged in v3 — mapping in **[docs/AUDIT.md](./docs/AUDIT.md)**.
- Static analysis (Solhint + Slither) runs on every commit via GitHub Actions.
- Vulnerability disclosure policy: **[SECURITY.md](./SECURITY.md)**

## 🚀 Development

```bash
# Install
npm install

# Compile
npx hardhat compile

# Run tests (32 tests)
npx hardhat test

# Gas report
REPORT_GAS=true npx hardhat test

# Lint
npx solhint 'contracts/**/*.sol'
```

### Deployment

```bash
cp .env.example .env   # fill DEPLOYER_PRIVATE_KEY, POLYGON_RPC_URL, POLYGONSCAN_API_KEY
npx hardhat run scripts/deploy.js --network polygon
npx hardhat run scripts/verify.js --network polygon
```

## 🔗 Links

- Website: https://chrema.net
- CertiK Skynet: https://skynet.certik.com/projects/chremacoin
- Polygonscan: https://polygonscan.com/token/0x61cA155F1660b0af117Ed00321d1c3EE264ef943
- CoinGecko: https://www.coingecko.com/en/coins/chrema-coin

## 📄 License

MIT — see [LICENSE](./LICENSE).
