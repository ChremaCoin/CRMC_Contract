# Security Policy

## Supported contract

| Contract | Chain | Address | Status |
|---|---|---|---|
| CHREMACOIN v3 | Polygon PoS | `0x61cA155F1660b0af117Ed00321d1c3EE264ef943` | ✅ Active |
| CHREMACOIN v1 | Ethereum | `0x9ac4ee539403e3f101b9ae3620926f2ded0d0b99` | ⚠️ Deprecated — issues affecting holder funds are still in scope |

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

- Email: `security@chrema.net` <!-- TODO: confirm mailbox exists and is monitored -->
- Alternatively, report via the CertiK Skynet bug bounty channel:
  https://skynet.certik.com/projects/chremacoin

Please include:

1. A description of the vulnerability and its impact
2. Steps to reproduce (PoC transaction on a fork is ideal)
3. Affected contract address / function
4. Your contact for follow-up

## Our commitment

- Acknowledgement within **48 hours**
- Triage and severity assessment within **7 days**
- We will not pursue legal action against good-faith researchers who
  follow this policy, avoid privacy violations, and do not exploit
  the issue beyond what is needed to demonstrate it
- Credit given in the disclosure (unless anonymity is requested)

## Scope

**In scope:** the token contract logic, privileged-role abuse paths,
lock/vesting accounting, pause bypasses, burn accounting.

**Out of scope:** issues requiring a compromised owner/supervisor key,
gas-price griefing, third-party exchange systems, the chrema.net website
(report website issues to the same email, handled separately).

## Emergency response

The contract includes an owner-gated `pause()` capability. In the event of a
confirmed active exploit, transfers may be paused while a remediation plan is
announced on official channels. See [docs/ADMIN_ROLES.md](./docs/ADMIN_ROLES.md).
