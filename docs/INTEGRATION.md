# MirrorJudge: Integration Guide & API Reference

This document provides a comprehensive integration manual for client applications, frontends, and smart contracts interacting with `MirrorJudge` on GenLayer Studionet.

## Environment & Client SDK Configuration

- **SDK Package**: `genlayer-js@1.1.8`
- **Chain Object**: `chains.studionet` (Chain ID `61999`, RPC `https://studio.genlayer.com/api`)
- **Contract Address**: `0x3991d0817f8FD6B6632b1C2c21d234598CbF4e17`
- **Security Notice**: Never store private keys in application source code or frontend bundles. The client UI should connect via browser wallets (e.g. MetaMask / GenLayer Wallet) where users sign their own transactions.

### Client Initialization Example
```javascript
const { createClient, chains } = require('genlayer-js');

const client = createClient({
  chain: chains.studionet,
  account: userWalletAccount, // connected browser wallet
});
```

---

## Transaction Lifecycle & Receipt Semantics

### Write Success Rule
In GenLayer, write transactions do NOT synchronously return function return values to the caller. A write transaction receipt confirms inclusion and validator consensus:
1. `receipt.status_name === "ACCEPTED"`
2. `receipt.result_name === "MAJORITY_AGREE"`
3. `receipt.consensus_data.leader_receipt[0].execution_result === "SUCCESS"`

**Never treat `ACCEPTED` alone as execution success.** If a user error occurs (e.g., unauthorized caller or exhausted rounds), the transaction may still be recorded as `UNDETERMINED / MAJORITY_DISAGREE` with `execution_result: "ERROR"`.

To obtain results, the frontend or downstream contract must execute a read call (`readContract`) immediately following transaction confirmation.

### Recommended Receipt Polling Parameters
Validator consensus involving LLM passes requires between 15 and 90 seconds depending on committee load and multi-pass complexity. Configure the receipt listener:
```javascript
const receipt = await client.waitForTransactionReceipt({
  hash: txHash,
  retries: 120, // 6 minutes maximum timeout
  interval: 3000, // 3 second polling interval
});
```

---

## Known-Good Transaction Hashes for UI Demo

Developers building user interfaces (such as the upcoming "Second-Opinion Desk") can demo state transitions using these verified live transaction hashes:

| Adjudication Type | Round Outcome | Transaction Hash | Measured Latency |
|---|---|---|---|
| **DECIDED** (Clear-cut) | `DECIDED\|PARTY_1\|STABLE` | `0x3b5460d089fc1f01020ecd62c3c2d44f390a4fd060e4dc01fddbda3ee5725a2c` | `34.66s` |
| **SPLIT** (Balanced) | `DECIDED\|SPLIT\|STABLE` | `0x555917bd7862de14c17e54e9097ed9aa091890c9316c682413e6268055ecba08` | `19.79s` |
| **INSUFFICIENT** (Deterministic) | `INSUFFICIENT\|NONE\|NA` | `0x79e81365d229556cc07bcf3d6d5c18a17072ad1cbf68304964b900bc477be4fa` | `8.31s` |
| **ESCALATION Round 1** | `INSUFFICIENT\|NONE\|NA` | `0x2c2a17baee5271fc930f73b071edcf77b2396c04f4c3faf3c63f67d61f22b4db` | `138.39s` |
| **ESCALATION Round 2** | `DECIDED\|PARTY_1\|STABLE` | `0x658973dea8b9320fc0f4d1485b3433508e17a346600b42af47ec22aca4b923c9` | `53.35s` |

---

## Public Methods & View Reference

### 1. `open_case`
- **Kind**: `write`
- **Caller**: Case opener (automatically assigned as Party 1).
- **Arguments**:
  - `title` (`str`): `"Freelance Milestone 1 Delivery Verification"`
  - `criteria_json` (`str`): `'[{"id": "milestone_delivery", "text": "Which party substantiated full completion of milestone deliverables: PARTY_1 or PARTY_2?", "weight_bp": 6000}, {"id": "spec_compliance", "text": "Which party adhered to specifications and code standards: PARTY_1 or PARTY_2?", "weight_bp": 4000}]'`
  - `aliases1_csv` (`str`): `"Alice, Alice Corp"`
  - `aliases2_csv` (`str`): `"Bob, Bob Dev"`
  - `opposing` (`str`): `"0x5C89713c743edb72EC13eB2e5646C723ccC19500"`
- **Possible User Errors**:
  - `bad title length`
  - `bad criteria json`
  - `1..6 criteria`
  - `bad criterion id`
  - `weights must sum to 10000`
  - `empty aliases`
  - `duplicate alias`
  - `duplicate alias across parties`
  - `invalid opposing address`
  - `opener cannot be opposing party`
  - `case already exists`
- **Measured Latency**: ~3 to 6 seconds.

---

### 2. `add_evidence`
- **Kind**: `write`
- **Caller**: Parties only (Opener or Opposing).
- **Arguments**:
  - `case_id` (`str`): `"ebe94dc89329"`
  - `text` (`str`): `"Alice Corp submitted audited git repository logs and test suites proving Alice completed all software deliverables with zero critical defects."`
- **Possible User Errors**:
  - `case not found`
  - `case is finalized`
  - `case already decided`
  - `not a party to the case`
  - `evidence text must be 1..1200 chars`
  - `over-limit evidence: max 3 per party`
- **Measured Latency**: ~3 to 6 seconds.

---

### 3. `judge`
- **Kind**: `write` (Validator Consensus)
- **Caller**: Any account (keeper, party, or observer).
- **Arguments**:
  - `case_id` (`str`): `"ebe94dc89329"`
- **Behaviors**:
  - If either party lacks evidence: returns `INSUFFICIENT|NONE|NA` deterministically without LLM calls.
  - If both parties provided evidence: runs dual-pass mirroring (canonical & mirrored) with code-grounded quote extraction and weighted criteria scoring.
- **Possible User Errors**:
  - `case not found`
  - `case is finalized`
  - `case already decided`
  - `rounds exhausted`
- **Measured Latency**:
  - Deterministic insufficient run: `8.31s`
  - Consensus judging run: `19.79s` to `53.35s` (up to `138s` under heavy node traffic).

---

### 4. `finalize`
- **Kind**: `write`
- **Caller**: Either Party 1 or Party 2.
- **Arguments**:
  - `case_id` (`str`): `"ebe94dc89329"`
- **Possible User Errors**:
  - `case not found`
  - `only a party can finalize`
- **Measured Latency**: ~3 to 5 seconds.

---

### 5. `get_certificate`
- **Kind**: `view`
- **Arguments**: `case_id` (`str`)
- **Return Type**: `str` (JSON)
- **Live Read-Back Example**:
```json
{
  "schema_version": "1.0",
  "case_id": "ebe94dc89329",
  "title": "Freelance Milestone 1 Delivery Verification",
  "opener": "0xD3cCD6Aba6E9d4b39a81d32D675f77c2E31e8EC6",
  "opposing": "0x5C89713c743edb72EC13eB2e5646C723ccC19500",
  "status": "JUDGED",
  "config": {
    "margin_bp": 1500,
    "max_flips": 1,
    "max_rounds": 3,
    "criteria": [
      {
        "id": "milestone_delivery",
        "text": "Which party substantiated full completion of milestone deliverables: PARTY_1 or PARTY_2?",
        "weight_bp": 6000
      },
      {
        "id": "spec_compliance",
        "text": "Which party adhered to specifications and code standards: PARTY_1 or PARTY_2?",
        "weight_bp": 4000
      }
    ]
  },
  "rounds": [
    {
      "n": 1,
      "decision": "DECIDED|PARTY_1|STABLE"
    }
  ],
  "current_decision": "DECIDED|PARTY_1|STABLE",
  "is_decided": true,
  "outcome": "PARTY_1"
}
```

---

### 6. `outcome_for_consumer`
- **Kind**: `view`
- **Arguments**: `case_id` (`str`)
- **Return Type**: `str` (`"PARTY_1" | "PARTY_2" | "SPLIT" | "NO_DECISION" | "PENDING"`)
- **Live Read-Back Example**: `"PARTY_1"`

---

### 7. Discovery Views
Frontends do not need to recompute hash IDs. Use these bounded discovery views:
- `get_cases_by_party(party: str, limit: int = 20) -> str`: Returns JSON list of case IDs where `party` is opener or opposing.
  - Example: `["ebe94dc89329", "fa1c4d0832e1"]`
- `get_latest_case_for_pair(party_a: str, party_b: str) -> str`: Returns the latest `case_id` opened between the two parties, regardless of argument ordering.
- `list_cases(offset: int = 0, limit: int = 20) -> str`: Returns a paginated list of up to `limit` global case IDs.
