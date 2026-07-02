# Admin Roles & Key Management Disclosure

This document discloses all privileged capabilities in the deployed CRMC contract
(`0x61cA155F1660b0af117Ed00321d1c3EE264ef943`, Polygon), who holds them, and how
keys are managed. It exists to address the centralization finding (CHC-03) in the
CertiK audit transparently.

## Role model

The contract has two privilege levels:

### 1. Owner (single address)

| Capability | Function | Risk if abused |
|---|---|---|
| Pause / unpause all transfers | `pause()` / `unpause()` | Trading halt |
| Grant / revoke supervisor role | `setSupervisor` / `removeSupervisor` | Expands privileged set |
| Transfer ownership | `transferOwnership` | Hand over control |
| All supervisor capabilities | (owner passes `onlySupervisor`) | See below |

The owner **cannot**: mint tokens (no mint function exists), change balances directly,
modify fees (there are none), or upgrade the contract (not a proxy).

### 2. Supervisor (allowlist of addresses)

| Capability | Function | Purpose |
|---|---|---|
| Burn own tokens | `burn` | Supply reduction per tokenomics |
| Burn with allowance | `burnFrom` | Buyback-and-burn operations |
| Freeze / unfreeze a wallet | `setLockedWalletEntity` / `removeLockedWalletEntity` | Compromise / compliance response |
| Create vesting lock | `transferToLockedBalance` | Team / partner vesting |
| Extend a lock slot | `setLockTime` | Vesting adjustments (extend-only within ordering rules) |
| Read any lock schedule | `getLockedUserInfo` | Operational visibility |

## Current key configuration

<!-- TODO: fill each row with real values before OKX submission -->

| Item | Status |
|---|---|
| Owner address | `TODO: 0x…` |
| Owner key type | `TODO: Gnosis Safe multisig (N-of-M) / hardware wallet / EOA` |
| Multisig signers | `TODO: N of M — role holders (e.g., CEO / CTO / COO), no shared devices` |
| Timelock | `TODO: e.g., "Not currently deployed. Owner functions are operationally gated by multisig approval. Timelock adoption is on the roadmap for QX 2026."` |
| Supervisor addresses | `TODO: 0x… (Foundation ops), 0x… (…)` — enumerable on-chain via `SupervisorSet` events |
| Deployer address | `TODO: 0x…` (ownership transferred to multisig at tx `0x…`) |

> All role changes emit indexed events (`SupervisorSet`, `WalletLockSet`,
> `OwnershipTransferred`), so the full history of privileged configuration is
> independently reconstructable from the chain.

## Operational policy

- Pausing is reserved for security incidents (exploit, exchange breach, bridge failure)
  and is announced on official channels with rationale.
- Wallet freezing (`setLockedWalletEntity`) is used only for confirmed compromised
  wallets or legally compelled compliance actions, and blocks **outgoing transfers only**.
- Vesting locks follow the published tokenomics schedule; lock times can be extended,
  never shortened below the ordering constraints enforced on-chain.
- Burn operations are announced with tx hashes.

## Roadmap toward further decentralization

<!-- TODO: keep only what is actually planned -->
- [ ] Migrate owner to timelock-wrapped multisig
- [ ] Publish supervisor address registry on chrema.net
- [ ] Periodic third-party review of privileged operations
