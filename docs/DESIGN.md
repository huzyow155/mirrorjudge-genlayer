# MirrorJudge: Architecture and Consensus Design

## 1. Executive Problem & Core Thesis

Large language models (LLMs) used as adjudicators exhibit documented cognitive vulnerabilities:
1. **Position / Order Bias**: LLMs disproportionately favor whichever party or option is presented first (or last).
2. **Label Sensitivity**: An LLM judge may systematically favor specific names, titles, or demographic cues.
3. **Consensus Illusion**: A validator committee sharing a single prompt framing can reach strong consensus on a factually erroneous verdict because all models share identical directional biases.

**MirrorJudge** eliminates these failure modes on GenLayer via **Swap-Consistent Adjudication (Mirroring)**:
- Deterministic party anonymization (`[PARTY_1]` and `[PARTY_2]`).
- Dual-pass evaluation: **Canonical Pass** vs. **Mirrored Pass** (party labels swapped, evidence submission order reversed, criteria sequence reversed).
- Restricted LLM role: The LLM does not decide the outcome; it only extracts observations per criterion (`favors: PARTY_1 | PARTY_2 | NEITHER | UNCLEAR`) paired with verbatim quotes ($\ge 12$ chars) checked deterministically by Python code against the untrusted input text.
- Deterministic code computes the verdict based on case-specific basis-point weights ($\sum w_i = 10,000$), margin thresholds (`margin_bp = 1500`), and flip limits (`max_flips = 1`).
- Disagreement beyond tolerance produces `UNSTABLE`, escalating to supplemental evidence rounds rather than enshrining a biased ruling.

---

## 2. Storage Architecture & JSON Schemas

All storage fields are declared strictly as `TreeMap[str, str]` holding canonical JSON strings. No storage assignment occurs in `__init__`, ensuring deployment compatibility with GenLayer Studio.

### `cases: TreeMap[str, str]`
Key: `case_id` (first 12 hex characters of `sha256(opener|title|criteria_json)`).

```json
{
  "schema_version": "1.0",
  "case_id": "d91dad61c5a4",
  "title": "Software Delivery Milestone Verification",
  "opener": "0x78a8c1D9aD21761CED079B542B9aA1602455b936",
  "opposing": "0xF141c99cd74920E4c800E29dA735646627Fcfde9",
  "criteria": [
    {
      "id": "milestone_completion",
      "text": "Which party substantiated satisfactory completion of software deliverables: PARTY_1 or PARTY_2?",
      "weight_bp": 6000
    },
    {
      "id": "contract_compliance",
      "text": "Which party adhered to the agreed specifications and milestone requirements: PARTY_1 or PARTY_2?",
      "weight_bp": 4000
    }
  ],
  "aliases1": ["Alice", "Alice Corp"],
  "aliases2": ["Bob", "Bob Dev"],
  "margin_bp": 1500,
  "max_flips": 1,
  "max_rounds": 3,
  "evidence": [
    {
      "by": "PARTY_1",
      "text": "Alice Corp provided audited system logs..."
    },
    {
      "by": "PARTY_2",
      "text": "Bob Dev explicitly admits in written correspondence..."
    }
  ],
  "rounds": [
    {
      "n": 1,
      "decision": "DECIDED|PARTY_1|STABLE"
    }
  ],
  "status": "JUDGED"
}
```

### Discovery Indexes
- `party_cases: TreeMap[str, str]`: Maps `party_address.lower()` to a JSON list of recent case IDs: `["d91dad61c5a4", ...]`.
- `pair_cases: TreeMap[str, str]`: Maps sorted pair key `min(p1, p2) + ":" + max(p1, p2)` to the latest `case_id`.
- `all_cases: TreeMap[str, str]`: Maps `"ids"` to a JSON array of the latest 100 global case IDs.

---

## 3. Consensus Mechanism & Equivalence Principle

### What Validators Compare
During `judge(case_id)`, validators execute `gl.eq_principle.strict_eq(compute_verdict)`.
The function `compute_verdict()` returns a single discrete canonical string:
- `"DECIDED|PARTY_1|STABLE"`
- `"DECIDED|PARTY_2|STABLE"`
- `"DECIDED|SPLIT|STABLE"`
- `"UNSTABLE|NONE|UNSTABLE"`
- `"INSUFFICIENT|NONE|NA"`

### Why Validators Compare What They Compare
GenLayer validators operate heterogeneous LLM nodes (e.g., DeepSeek-V3, GLM, GPT models) with distinct tokenizers, sampling temperatures, and stylistic patterns.
- If consensus attempted to compare raw LLM responses or verbatim extracted quotes, execution would fail due to trivial syntactic variations (whitespace, punctuation, quote boundaries, synonym choices).
- Conversely, comparing an unvalidated, free-text LLM verdict invites hallucinations and ungrounded bias.
- **The MirrorJudge Solution**:
  1. Each validator node executes the non-deterministic block independently, making two LLM calls (Canonical pass and Mirrored pass).
  2. Each validator runs `_clean_obs` locally: verifying that extracted quotes actually exist as exact normalized substrings ($\ge 12$ chars) inside the anonymized untrusted evidence block. If a quote is hallucinated or ungrounded, the criterion is downgraded to `UNCLEAR` with zero score credit.
  3. Each validator computes party scores via deterministic integer math (`_score`) and applies the case's fixed parameters (`margin_bp`, `max_flips`).
  4. Each validator derives the canonical outcome string (`_round_decision`).
  5. The equivalence principle compares **only** this canonical discrete string across validators.

Because thresholding and grounding are resolved deterministically before consensus comparison, validators agree on the definitive result whenever the evidence is grounded and stable.

---

## 4. Stability Certificate & Consumer Interface

### Stability Certificate (`get_certificate`)
The contract exposes `get_certificate(case_id)` returning:
- Case configuration (`margin_bp`, `max_flips`, `max_rounds`, `criteria`).
- Complete chronological rounds log (`rounds`).
- `current_decision`: Latest round decision string.
- `is_decided`: Boolean flag indicating if consensus has reached stability.
- `outcome`: Machine-readable consumer state (`PARTY_1`, `PARTY_2`, `SPLIT`, `NO_DECISION`, `PENDING`).

### Downstream Consumption (`outcome_for_consumer`)
Third-party smart contracts (such as escrow contracts, insurance policies, or bounty payout handlers) consume the dispute outcome synchronously via `outcome_for_consumer(case_id)`:
- `PARTY_1`: Party 1 cleanly prevailed under both framings.
- `PARTY_2`: Party 2 cleanly prevailed under both framings.
- `SPLIT`: Evidence was balanced within the margin under both framings.
- `PENDING`: Dispute is currently open or undergoing multi-round escalation.
- `NO_DECISION`: The case was finalized or rounds were exhausted while unstable or insufficient.
