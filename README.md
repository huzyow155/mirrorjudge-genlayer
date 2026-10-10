# MirrorJudge

> **Swap-Consistent Multi-Criteria Dispute Adjudication on GenLayer Studionet**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GenLayer](https://img.shields.io/badge/GenLayer-Studionet-purple.svg)](https://studio.genlayer.com)

**MirrorJudge** is an Intelligent Contract on GenLayer designed to eliminate order bias and presentation sensitivity in AI-assisted dispute resolution. It implements deterministic anonymization, dual-pass mirroring, code-verified quote grounding, and weighted multi-criteria aggregation to produce verified on-chain **Stability Certificates**.

---

## Current Deployed Addresses (GenLayer Studionet (Preview))

| Role | Contract Address | Deploy Transaction Hash | Explorer Link |
| :--- | :--- | :--- | :--- |
| **MirrorJudge (Intelligent Contract)** | `0x1343C51732FD1002986Ed3f0Bb9D5C2105A6635D` | `0xf32d2573b81b086b226658434d04e2eca4103e9610ea98f4a38f54fd769edbc3` | [Explorer](https://explorer-studio.genlayer.com/address/0x1343C51732FD1002986Ed3f0Bb9D5C2105A6635D) |
| **MirrorJudgeConsumer (Escrow / Downstream)** | `0x4FC86C019ec00Aa911A4D34986e33be2Cd94b837` | `0xd74c65db6cc9256cc6f1221e5003c979c7e11e19dc4a919cc80498f454d302f1` | [Explorer](https://explorer-studio.genlayer.com/address/0x4FC86C019ec00Aa911A4D34986e33be2Cd94b837) |

- **Network**: GenLayer Studionet (Preview) (Chain ID: `61999`, RPC: `https://studio.genlayer.com/api`)
- **Verified Source SHA-256**: `123c0dbe36a376213d20c2e42bda22f82f51be184a42295d98fe36e882ae0594`
- **Source Byte-for-Byte Match**: Confirmed on-chain via `eth_getTransactionByHash` code extraction.

### Superseded Historical Deployments

| Address | Role | Superseded Reason |
| :--- | :--- | :--- |
| `0x3991d0817f8FD6B6632b1C2c21d234598CbF4e17` | MirrorJudge | Pre-hardening deployment lacking strict criterion weight bounds |
| `0x294FFDec366826F8682CFAAEbaf25DcAeBda9317` | Consumer | Pointed to superseded MirrorJudge address |
| `0x30552D40A956d2D753AbAD429c90cB07f65Dabd0` | MirrorJudge | Early prototype (unhardened LLM prompt) |
| `0xd146F4102dCca75dF2977091A3aFd3307D236f78` | MirrorJudgeCore | Milestone 1 core prototype |
| `0x2106760ca2BD2a55be57A8B68373F65afCdc2Fe2` | Probe | Milestone 0 runtime diagnostic |

---

## Verified Demo Cases On-Chain

All cases exist on the current contract address (`0x1343C51732FD1002986Ed3f0Bb9D5C2105A6635D`), are documented in `scripts/deploy/live_evidence.json`, and are inspectable without a wallet:

| Demo | Case ID | Category | Status & Verdict | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Demo A** | `0551168cd4f5` | Software Milestone | `DECIDED\|PARTY_1\|STABLE` | Clear-cut milestone delivery verified via git logs and counterparty admission. |
| **Demo B** | `4e4a3aa372e6` | Commercial Lease | `INSUFFICIENT\|NONE\|NA` | Missing counterparty evidence resolved deterministically without LLM bias. |
| **Demo C** | `8f128188b6c6` | Infrastructure SLA | `DECIDED\|SPLIT\|STABLE` | Symmetrical uptime claims evaluated to a swap-consistent split verdict. |
| **Demo D** | `cbbed41fefc3` | Escrow Addendum | `UNSTABLE\|NONE\|UNSTABLE` | Ambiguous addendum attribution where canonical and mirrored passes diverge. |

### On-Chain Verification of `UNSTABLE` Case (`cbbed41fefc3`)

- **`open_case` Tx**: `0xa3e30f86e5677c7b069b3c42bd2769a6f90e27570cca39c24a2017151e4ff2aa`
- **Party 1 `add_evidence` Tx**: `0x1edb1ec2e78ab87cb4396d5548df6426ea47615f36ac4249f73455c9355b3bae`
- **Party 2 `add_evidence` Tx**: `0xa4605d01bf0f17c5ca6264f75f355d9f4a351343058e69021a28eb94c774f8bd`
- **`judge` Tx**: `0x8472dbad8e0bdc0f3049db16ca509e3b539a5d938b2bff5a389aff2d16e2c3a2` (Accepted by validators, `MAJORITY_AGREE`, `leaderResult: SUCCESS`, `31.89s`)
- **RPC View Call**: `readContract({ address: "0x1343C51732FD1002986Ed3f0Bb9D5C2105A6635D", functionName: "get_certificate", args: ["cbbed41fefc3"] })`
- **Field Read**: `JSON.parse(certificate).current_decision === "UNSTABLE|NONE|UNSTABLE"` and `rounds[0].decision === "UNSTABLE|NONE|UNSTABLE"`

---

## The Problem: The Consensus Illusion in LLM Judges

Large language models are vulnerable to subtle cognitive biases:
1. **Position Bias**: LLMs consistently favor the initial or concluding presented party or statement.
2. **Label Sensitivity**: Disparate party names, titles, or corporate labels warp LLM preferences.
3. **The Consensus Illusion**: When multiple validators run the same prompt template on the same presentation order, their shared directional biases compound into an artificial majority agreement on an unjust outcome.

MirrorJudge addresses this vulnerability: **a verdict is accepted when it survives mirroring**.

---

## Core Mechanism: Dual-Pass Mirroring

```
                     +---------------------------------------+
                     |         Adversarial Evidence          |
                     +---------------------------------------+
                                         |
                       [Deterministic Anonymization]
                        Party 1 -> [PARTY_1]
                        Party 2 -> [PARTY_2]
                                         |
                 +-----------------------+-----------------------+
                 |                                               |
                 v                                               v
        [Pass 1: Canonical]                             [Pass 2: Mirrored]
     - Normal evidence order                         - Reversed evidence order
     - Normal criteria order                         - Reversed criteria order
     - Labels: [P1] vs [P2]                          - Labels: [P2] vs [P1]
                 |                                               |
                 v                                               v
         [LLM Observation]                               [LLM Observation]
       Extracts grounded quotes                        Extracts grounded quotes
                 |                                               |
                 v                                               v
     [Code Grounding Check]                          [Code Grounding Check]
     Len >= 12, in text?                             Len >= 12, in text?
                 |                                               |
                 v                                               v
     [Weighted Criteria Math]                        [Weighted Criteria Math]
      Basis points threshold                          Basis points threshold
                 |                                               |
                 +-----------------------+-----------------------+
                                         |
                       [Equivalence Verification]
                                         |
                +------------------------+------------------------+
                |                                                 |
         [Passes Agree?]                                   [Passes Disagree?]
                |                                                 |
                v                                                 v
         STABLE CERTIFICATE                              UNSTABLE CERTIFICATE
       (Ready for downstream                              (Requires next round
        smart contract escrow)                             or human arbitration)
```

---

## Downstream Consumer Integration

Downstream contracts consume stability certificates through the public `outcome_for_consumer(case_id)` view method:

```python
class EscrowConsumer(gl.Contract):
    judge_address: Address
    escrow_payouts: TreeMap[str, str]

    @gl.public.write
    def execute_payout(self, case_id: str) -> str:
        judge = gl.get_contract_at(self.judge_address)
        outcome = judge.view().outcome_for_consumer(case_id)

        if outcome == "PARTY_1":
            self.escrow_payouts[case_id] = "RELEASED_TO_PARTY_1"
            return "RELEASED_TO_PARTY_1"

        if outcome == "PARTY_2":
            self.escrow_payouts[case_id] = "RELEASED_TO_PARTY_2"
            return "RELEASED_TO_PARTY_2"

        if outcome == "SPLIT":
            self.escrow_payouts[case_id] = "SPLIT_EQUAL"
            return "SPLIT_EQUAL"

        if outcome == "NO_DECISION":
            self.escrow_payouts[case_id] = "ESCALATED_TO_ARBITRATOR"
            return "ESCALATED_TO_ARBITRATOR"
```

A deployed consumer contract is verified on Studionet at [`0x4FC86C019ec00Aa911A4D34986e33be2Cd94b837`](https://explorer-studio.genlayer.com/address/0x4FC86C019ec00Aa911A4D34986e33be2Cd94b837).

---

## Testing & Verification

The contract suite includes 24 unit and integration tests across three layers:

```bash
python -m unittest discover tests
```

- **Layer 1 (Pure Logic & Biased-Judge Probes)**: Anonymization precedence, label swapping, margin boundary tests, quote grounding validation, strict integer criterion weight validation (`1 <= weight_bp <= 10000`, non-boolean, sum == 10000), and the star test proving that order-biased and label-biased judges are flagged as `UNSTABLE`.
- **Layer 2 (Mocked Lifecycle & Discovery)**: Round limits, party permissions, prompt injection resistance, and discovery views.
- **Layer 3 (Consensus Simulation)**: Committee agreement and divergence modeling under heterogeneous LLM responses.

---

## Studionet Deployment & Validation

```bash
# 1. Install dependencies
npm install

# 2. Verify pure ASCII compliance
python scripts/scan_ascii.py

# 3. Verify no secrets
python scripts/scan_secrets.py

# 4. Execute on-chain evidence suite on Studionet
node scripts/deploy/run_live_evidence.js
```

---

## Known Limitations

- **Two-Party Scope**: MirrorJudge is designed for two adversarial parties (Party 1 vs Party 2). Multi-party disputes require pairwise reduction.
- **Evidence-Bound Verification**: The contract verifies that quotes exist within submitted evidence; it does not independently verify physical real-world facts beyond the submitted record.
- **Consensus Latency**: Each round executes two LLM passes per validator. Consensus latency typically ranges from 19 to 53 seconds on Studionet.

---

## Second-Opinion Desk dApp

The official user interface for MirrorJudge is **Second-Opinion Desk** at [https://second-opinion-desk-genlayer.vercel.app](https://second-opinion-desk-genlayer.vercel.app), providing side-by-side framing visualization, interactive evidence submission, and on-chain Stability Certificate inspection.

---

## License

This project is licensed under the [MIT License](LICENSE) - Copyright (c) 2026 huzyow155.
