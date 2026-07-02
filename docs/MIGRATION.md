# CRMC Contract Migration — Ethereum → Polygon (1:1 Swap)

## Summary

| | Legacy (v1) | Current (v3) |
|---|---|---|
| Chain | Ethereum Mainnet | **Polygon PoS** |
| Address | `0x9ac4ee539403e3f101b9ae3620926f2ded0d0b99` | `0x61cA155F1660b0af117Ed00321d1c3EE264ef943` |
| Solidity | `0.4.24` | `0.8.20` |
| Deployed | January 2023 | 2026 <!-- TODO: exact date + tx hash --> |
| Supply | 50,000,000 CRMC (8 decimals) | 50,000,000 CRMC (8 decimals) |
| Swap ratio | — | **1 : 1** |
| Status | **Deprecated** | Active |

## Why we migrated

1. **Audit remediation.** The CertiK audit of the token contract identified findings
   (CHC-01 through CHC-07) that could not all be fixed in-place on an immutable
   contract. The v3 contract resolves or explicitly addresses every item — see
   [AUDIT.md](./AUDIT.md).
2. **Codebase modernization.** Solidity `0.4.24` (2018-era) lacks built-in overflow
   checks, custom errors, and current tooling support. v3 targets `0.8.20`.
3. **Chain economics.** Polygon PoS offers materially lower transaction fees for
   holders and ecosystem applications (P2E, staking, RWA settlement).
4. **Event clarity.** The ambiguous `PrintLog` event was deprecated in favor of
   explicit events (`AvailableComputed`, `WalletLockSet`, `SupervisorSet`) so
   explorers and indexers can interpret contract activity correctly (CHC-07).

## What changed in the code

| Area | v1 (Ethereum) | v3 (Polygon) |
|---|---|---|
| `burnFrom` | Public (any holder with allowance) | **Supervisor-only** (CHC-04) |
| Self-transfer | Allowed | **Blocked** in `transfer` and `transferFrom` (CHC-05) |
| Burn vs. locks | Burn could brick a locked wallet | **Auto-normalizes** lock values after burn (CHC-01) |
| Lock overwrite | Possible to overwrite an active lock | **Rejected** if any lock field is non-zero (CHC-02) |
| Events | `PrintLog(string, uint)` | Explicit semantic events (CHC-07) |
| SafeMath | Library | Native 0.8.x checked arithmetic |
| Ownership | Includes `renounceOwnership` | Removed; transfer-only (prevents accidental orphaning) |

## Swap procedure (holders)

1. Swap is performed at a fixed **1:1 ratio** — 1 legacy CRMC (Ethereum) = 1 new CRMC (Polygon).
2. Exchange balances (Gate.io, LBank, GOPAX) were migrated by the exchanges directly;
   no action was required from exchange custody holders.
3. Self-custody holders followed the swap procedure announced on official channels
   (website + Telegram announcement).
4. The swap deadline was extended to **May 31, 2026** per the official announcement.
   <!-- TODO: confirm final deadline / post-deadline policy for late swappers -->

## Legacy contract policy

- The Ethereum contract remains on-chain (immutable) but is **no longer the canonical CRMC token**.
- No liquidity, listings, or ecosystem integrations reference the legacy address.
- Its source is archived in [`legacy/CHREMACOIN_v1_ethereum.sol`](../legacy/CHREMACOIN_v1_ethereum.sol)
  for transparency and audit-trail purposes. It is excluded from compilation and CI.

## Verification

Anyone can verify the migration integrity:

```bash
# Total supply of new contract equals legacy supply (50,000,000 * 10^8)
cast call 0x61cA155F1660b0af117Ed00321d1c3EE264ef943 "totalSupply()(uint256)" --rpc-url https://polygon-rpc.com
```

Both contracts are source-verified on their respective explorers:
- Legacy: https://etherscan.io/token/0x9ac4ee539403e3f101b9ae3620926f2ded0d0b99#code
- Current: https://polygonscan.com/token/0x61cA155F1660b0af117Ed00321d1c3EE264ef943#code
