# Prior Art Analysis: MirrorJudge vs. Existing GenLayer Systems

## Executive Summary

Before deploying **MirrorJudge**, we conducted an exhaustive investigation into existing GenLayer contracts and repositories to determine whether a swap-consistent dispute adjudication mechanism already exists on GenLayer.

The closest neighbor identified on GenLayer is **`Baster221/blindfold`** (pairwise retroactive public goods funding with swap-consistency). While Blindfold pioneered the concept of metamorphic consensus on GenLayer for ranking grant applicants, its scope, architectural mechanics, and consensus outputs are fundamentally distinct from MirrorJudge.

We also conducted searches across GitHub for:
- `genlayer position bias` (0 contract matches)
- `genlayer swap consistency verdict` (0 contract matches)
- `genlayer stability certificate` (0 contract matches)

We found no contract that implements swap-consistent two-party dispute resolution, deterministic weighted multi-criteria code aggregation, grounded quote verification, bounded escalation of unstable rounds, and on-chain stability certificates.

---

## Architectural Comparison Table

| Dimension | `Baster221/blindfold` | `MirrorJudge` |
|---|---|---|
| **Primary Domain** | Retroactive Public Goods Funding (RetroPGF) | Two-Party Dispute Adjudication / Arbitration |
| **Participants** | 3 to 8 competing project teams + sponsor | Exactly 2 adversarial parties (Party 1 vs Party 2) |
| **Financial Nature** | Holds funds (payable rounds, deposit pool, pro-rata token payouts, claims) | Pure logic contract: holds no funds, no tokens, no escrow |
| **Problem Formulation** | Pairwise tournament: all-pairs round-robin duels $O(n^2)$ | Case dispute: Party 1 vs Party 2 across $K$ customizable criteria ($1 \le K \le 6$) |
| **Scoring Mechanism** | Copeland tournament points (Wins = 2, Ties = 1, Losses = 0) | Basis-point weighted criteria ($\sum w_i = 10,000$), evaluated by deterministic code against a margin threshold (`margin_bp`) |
| **LLM Output Role** | LLM directly outputs a relative preference duel winner | LLM is restricted to per-criterion factual observation (`favors: PARTY_1 \| PARTY_2 \| NEITHER \| UNCLEAR`) with verbatim quote extraction |
| **Evidence Grounding** | Winner's quote checked against winner's submitted report | Code validates verbatim quote ($\ge 12$ chars) against the anonymized evidence block; ungrounded quotes force `UNCLEAR` with zero score credit |
| **Mirroring Transformations** | Swaps project presentation order ($A$ vs $B$ $\leftrightarrow$ $B$ vs $A$) | Canonical pass vs. Mirrored pass: swaps party aliases and labels ($[PARTY\_1] \leftrightarrow [PARTY\_2]$), reverses evidence arrival order, and reverses criteria evaluation sequence |
| **Disagreement Handling** | Collapse disagreement to a neutral duel TIE (1 point each) | Disagreement exceeding `max_flips` or margin yields `UNSTABLE`, escalating to subsequent rounds without forcing an arbitrary winner |
| **Multi-Round Escalation** | Single pass of scheduled duels per tournament | Bounded multi-round lifecycle (up to `max_rounds`); allows parties to submit supplemental evidence upon `UNSTABLE` |
| **Exposed Artifact** | Leaderboard & token award claim allocations | On-chain **Stability Certificate** (`get_certificate`) documenting pass consistency and machine-readable `outcome_for_consumer` (`PARTY_1`, `PARTY_2`, `SPLIT`, `NO_DECISION`, `PENDING`) |

---

## Detailed Technical Distinction

### 1. Retroactive Funding vs. Legal Dispute Resolution
`blindfold` was engineered for retroactive grant distributions where a sponsor deposits GEN and multiple projects submit performance reports. Its pairwise round-robin tournament produces a rank ordering to divide prize pools. 

`MirrorJudge` is designed for dispute resolution (e.g., freelance milestones, service-level agreements, warranty claims, DAO arbitration). It takes two adversarial parties, their evidence submissions, and user-specified legal/contractual criteria.

### 2. LLM Decision vs. Code-Calculated Scoring
In `blindfold`, the LLM determines who "wins" each duel. If the LLM favors Project A in both presentations, Project A wins.

In `MirrorJudge`, the LLM is explicitly forbidden from deciding who wins. Instead, the prompt instructs:
> *"You extract observations for a two-party dispute. Do NOT decide who wins."*

For each criterion, the LLM extracts an observation and a verbatim quote. Deterministic Python code (`_score` and `_round_decision`) calculates the total basis points won by each party and evaluates whether the victory margin exceeds `margin_bp`. The contract logic, not the LLM, renders the ruling.

### 3. Verification of Grounding
`MirrorJudge` requires that whenever an LLM claims evidence favors a party, it must supply a verbatim quote of at least 12 characters that exists within the untrusted evidence block. If the quote is fabricated or cannot be matched via normalized substring search, code overrides the finding to `UNCLEAR`.

### 4. Stability Certificate and Bounded Escalation
If the canonical and mirrored passes yield divergent outcomes (or if the number of flipped criteria exceeds `max_flips`), `MirrorJudge` does not fabricate a tie or compromise. It flags the round as `UNSTABLE`. The case escalates, permitting parties to provide supplemental evidence up to `max_rounds`. Third-party consumer contracts can query `outcome_for_consumer` to inspect whether a dispute has a certified stable resolution or requires escalation.

---

## Conclusion

The core mechanism of `MirrorJudge`—anonymized two-pass mirroring with code-governed weighted criteria aggregation, grounded quote verification, round escalation, and stability certificates—is entirely novel on GenLayer Studionet. No prior contract fulfills this architecture.
