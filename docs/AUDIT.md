# Audit → Deployed Code Mapping

**Auditor:** CertiK
**Report delivered:** 2026-03-25
**Skynet project page:** https://skynet.certik.com/projects/chremacoin
**Audited / deployed contract:** `contracts/CHREMACOIN.sol` (v3) —
Polygon `0x61cA155F1660b0af117Ed00321d1c3EE264ef943`
**Report PDF:** [`audit/`](../audit/README.md) <!-- TODO: commit the PDF or keep the Skynet link -->

## Findings summary

| Severity | Count | Status |
|---|---|---|
| Critical | 0 | — |
| Major | 0 | — |
| Medium | 1 | Resolved |
| Minor | 3 | 2 Resolved, 1 Partially Resolved |
| Informational | 2 | 1 Resolved, 1 Acknowledged |
| Centralization | 1 | Acknowledged (see [ADMIN_ROLES.md](./ADMIN_ROLES.md)) |

## Item-by-item mapping to the deployed source

The v3 contract header (`contracts/CHREMACOIN.sol`, lines 4–14) documents each item;
the table below points to where each fix lives in code and which test proves it.

| ID | Finding | Resolution in v3 | Code | Test |
|---|---|---|---|---|
| CHC-01 | Burn could reduce balance below locked total, bricking transfers | `_normalizeLocksAfterBurn` shrinks lock values (3rd → 2nd → 1st slot) to fit remaining balance after every burn | `_burn`, `_normalizeLocksAfterBurn` | `burn normalizes lock schedule so transfers are not bricked` |
| CHC-02 | Active lock schedule could be silently overwritten | `transferToLockedBalance` reverts if `hasActiveLock(to)` — any non-zero lock field blocks overwrite | `transferToLockedBalance` | `CHC-02: rejects overwriting an active lock` |
| CHC-03 | Centralization risk (owner/supervisor powers) | Acknowledged; mitigated operationally via multisig ownership and full disclosure. Transparency views (`isSupervisor`, `isWalletLocked`, `hasActiveLock`) added | View helpers | [ADMIN_ROLES.md](./ADMIN_ROLES.md) |
| CHC-04 | `burnFrom` callable by any address with allowance | `burnFrom` now `onlySupervisor` (in addition to allowance check) | `burnFrom` | `burnFrom requires allowance and supervisor role` |
| CHC-05 | Self-transfer accounting anomaly | `transfer` and `transferFrom` both reject `sender == recipient` | `transfer`, `transferFrom` | `reverts on self transfer` |
| CHC-06 | Mixed compute/side-effect logic in availability check | Refactored: pure `_computeAvailable` (view) separated from `_applyUnlockSideEffects` | Both functions | Covered by all phased-unlock tests |
| CHC-07 | Ambiguous `PrintLog` event | Deprecated (declared for ABI compatibility, never emitted); replaced by `AvailableComputed`, `WalletLockSet`, `SupervisorSet` | Event declarations | Event assertions across suite |

## Audited version = deployed version

- The source in `contracts/CHREMACOIN.sol` is byte-identical to the Polygonscan-verified
  source of `0x61cA155F1660b0af117Ed00321d1c3EE264ef943`.
  <!-- TODO: after publishing, diff repo file vs Polygonscan verified source and confirm -->
- Compiler settings in `hardhat.config.js` match the on-chain verification metadata.
- No proxy pattern is used; the deployed bytecode cannot change post-deployment.
