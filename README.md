# MirrorJudge

> **Swap-Consistent Multi-Criteria Dispute Adjudication on GenLayer Studionet**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GenLayer](https://img.shields.io/badge/GenLayer-Studionet-purple.svg)](https://studio.genlayer.com)

**MirrorJudge** is an Intelligent Contract on GenLayer designed to eliminate order bias and presentation sensitivity in AI-assisted dispute resolution. It implements deterministic anonymization, dual-pass mirroring, code-verified quote grounding, and weighted multi-criteria aggregation to produce verified on-chain **Stability Certificates**.

- **Deployed Contract Address**: [`0x30552D40A956d2D753AbAD429c90cB07f65Dabd0`](https://explorer-studio.genlayer.com/address/0x30552D40A956d2D753AbAD429c90cB07f65Dabd0)
- **Downstream Consumer Contract**: [`0x6E295655a39A5f9aDFF8B087497737788aCC8881`](https://explorer-studio.genlayer.com/address/0x6E295655a39A5f9aDFF8B087497737788aCC8881)
- **Network**: GenLayer Studionet (Chain ID: `61999`, Status: Preview)

---

## The Problem: The Consensus Illusion in LLM Judges

Large language models are vulnerable to subtle cognitive biases:
1. **Position Bias**: LLMs consistently favor the first or last presented party or statement.
2. **Label Sensitivity**: Disparate party names, titles, or corporate labels warp LLM preferences.
3. **The Consensus Illusion**: When multiple validators run the same prompt template on the same presentation order, their shared directional biases compound into an artificial majority agreement on an unjust outcome.

MirrorJudge addresses this vulnerability: **a verdict is accepted only if it survives mirroring**.

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
       Extracts quotes only                            Extracts quotes only
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
                   Do Pass 1 and Pass 2 Agree?
                   Flips <= max_flips? Margin >= margin_bp?
                                         |
                    +--------------------+--------------------+
                    |                                         |
                    v                                         v
         DECIDED|PARTY_1|STABLE                    UNSTABLE|NONE|UNSTABLE
         (Consensus Reached)                       (Escalates to Next Round)
```

1. **Party Anonymization**: All aliases for Party 1 and Party 2 are replaced case-insensitively with `[PARTY_1]` and `[PARTY_2]`, longest aliases first.
2. **Dual-Pass Framing**:
   - **Canonical Pass**: Original presentation order.
   - **Mirrored Pass**: Evidence submission order is reversed, criteria sequence is reversed, and party labels are swapped (`[PARTY_1]` $\leftrightarrow$ `[PARTY_2]`).
3. **No Free-Text Decisions**: The LLM is strictly instructed: *"Do NOT decide who wins"*. It only extracts discrete observations per criterion (`favors: PARTY_1 | PARTY_2 | NEITHER | UNCLEAR`) accompanied by a verbatim quote.
4. **Code-Enforced Grounding**: Python code verifies that quotes are $\ge 12$ characters and exist as normalized substrings in the untrusted evidence block. Unverified quotes are forced to `UNCLEAR`.
5. **Deterministic Aggregation**: Python code calculates party scores from basis points ($\sum w_i = 10,000$).
6. **Stability Verification**:
   - If both passes agree within `max_flips` and exceed `margin_bp`, the round yields `DECIDED|...|STABLE`.
   - If the passes disagree beyond tolerance, the dispute is marked `UNSTABLE`, triggering bounded multi-round escalation (up to `max_rounds`).

---

## Consensus Architecture

| Pipeline Stage | Non-Deterministic Block | What Validators Compare | Rationale |
|---|---|---|---|
| **Pass Execution** | 2 LLM calls per validator node (Canonical + Mirrored) | Nothing (internal to validator execution) | Prevents network latency and raw text variance across LLM providers from breaking consensus. |
| **Observation Extraction** | Model returns JSON observations and verbatim quotes | Nothing (internal to validator execution) | Minor variations in quote boundaries, whitespace, or synonyms are normalized locally by code. |
| **Grounding & Scoring** | Deterministic Python substring search and integer scoring | Nothing (internal to validator execution) | Untrusted text is verified locally; fabricated quotes are overridden to `UNCLEAR` with zero score credit. |
| **Equivalence Principle** | None (computed from pass outputs) | Canonical discrete decision string: `"DECIDED\|PARTY_1\|STABLE"`, `"DECIDED\|SPLIT\|STABLE"`, `"UNSTABLE\|NONE\|UNSTABLE"`, or `"INSUFFICIENT\|NONE\|NA"` | All validators must independently reach the exact same discrete stability determination. |

---

## Storage Architecture & Schema

All persistent state is stored in `TreeMap[str, str]` containing canonical JSON strings (`schema_version: "1.0"`):

- `cases: TreeMap[str, str]`: Case record indexed by `case_id` (12 hex characters of `sha256(opener|title|criteria_json)`).
- `party_cases: TreeMap[str, str]`: Index mapping party address to recent dispute IDs.
- `pair_cases: TreeMap[str, str]`: Index mapping canonical party pairs (`min:max`) to the latest dispute ID.
- `all_cases: TreeMap[str, str]`: Paginated index of global dispute IDs.

---

## Public Interface

### Write Methods
- `open_case(title, criteria_json, aliases1_csv, aliases2_csv, opposing) -> str`: Opens a dispute with 1..6 weighted criteria summing to 10,000 basis points.
- `add_evidence(case_id, text) -> None`: Parties only; up to 3 evidence submissions per party ($\le 1200$ chars each).
- `judge(case_id) -> str`: Consensus write method. Anyone can call. Evaluates evidence under dual-pass mirroring.
- `finalize(case_id) -> None`: Parties only; freezes the case.

### View Methods
- `get_case(case_id: str) -> str`: Returns full case JSON.
- `get_certificate(case_id: str) -> str`: Returns the on-chain Stability Certificate with configuration, rounds log, and outcome.
- `outcome_for_consumer(case_id: str) -> str`: Returns machine-readable outcome: `"PARTY_1"`, `"PARTY_2"`, `"SPLIT"`, `"NO_DECISION"`, or `"PENDING"`.
- `get_cases_by_party(party: str, limit: int) -> str`: Discovery view for party dispute history.
- `get_latest_case_for_pair(party_a: str, party_b: str) -> str`: Symmetric discovery lookup for a pair of parties.
- `list_cases(offset: int, limit: int) -> str`: Paginated global case discovery.

---

## Downstream Integration Example

Third-party contracts (such as escrow desks, bounties, or insurance agreements) consume MirrorJudge outcomes synchronously:

```python
# v0.2.16
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *

class EscrowConsumer(gl.Contract):
    judge_address: Address
    escrow_payouts: TreeMap[str, str]

    def __init__(self, judge_address_str: str):
        self.judge_address = Address(judge_address_str)

    @gl.public.write
    def release_escrow(self, case_id: str) -> str:
        judge = gl.get_contract_at(self.judge_address)
        outcome = judge.view().outcome_for_consumer(case_id)

        if outcome == "PENDING":
            raise gl.vm.UserError("dispute is still pending")

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

A live deployed consumer contract is verified on Studionet at [`0x6E295655a39A5f9aDFF8B087497737788aCC8881`](https://explorer-studio.genlayer.com/address/0x6E295655a39A5f9aDFF8B087497737788aCC8881).

---

## Testing & Verification

The contract suite includes 17 unit and integration tests across three layers:

```bash
python -m unittest discover tests
```

- **Layer 1 (Pure Logic & Biased-Judge Probes)**: Anonymization precedence, label swapping, margin boundary tests, quote grounding validation, and the star test proving that order-biased and label-biased judges are flagged as `UNSTABLE`.
- **Layer 2 (Mocked Lifecycle & Discovery)**: Round limits, party permissions, prompt injection resistance, and discovery views.
- **Layer 3 (Consensus Simulation)**: Committee agreement and divergence modeling under heterogeneous LLM responses.

---

## Studionet Deployment Steps

```bash
# 1. Install dependencies
npm install

# 2. Verify pure ASCII compliance
python scripts/scan_ascii.py contracts/MirrorJudge.py

# 3. Verify no secrets
python scripts/scan_secrets.py

# 4. Deploy and validate live on Studionet
node scripts/deploy/run_live_evidence.js
```

---

## Known Limitations

- **Two Parties Only**: MirrorJudge is designed for two adversarial parties (Party 1 vs Party 2). Multi-party disputes require pairwise reduction.
- **Evidence-Bound Verification**: The contract verifies that quotes exist within submitted evidence; it does not independently verify physical real-world facts beyond the submitted record.
- **Consensus Latency**: Each round executes two LLM passes per validator. Consensus latency typically ranges from 19 to 53 seconds on Studionet.

---

## Future Roadmap: Second-Opinion Desk

A dedicated user interface called **Second-Opinion Desk** is planned as a separate repository. It will provide side-by-side framing visualization, interactive evidence submission, and real-time Stability Certificate inspection on top of this deployed contract address.

---

## License

This project is licensed under the [MIT License](LICENSE) - Copyright (c) 2026 huzyow155.
