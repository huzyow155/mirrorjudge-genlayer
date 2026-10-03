# On-Chain Verification & Live Evidence Report

## Network & Contract Coordinates

- **Network**: GenLayer Studionet (Preview)
- **Chain ID**: `61999`
- **RPC URL**: `https://studio.genlayer.com/api`
- **Contract Address**: `0x30552D40A956d2D753AbAD429c90cB07f65Dabd0`
- **Explorer URL**: [0x30552D40A956d2D753AbAD429c90cB07f65Dabd0](https://explorer-studio.genlayer.com/address/0x30552D40A956d2D753AbAD429c90cB07f65Dabd0)
- **Consumer Contract Address**: `0x6E295655a39A5f9aDFF8B087497737788aCC8881`
- **Consumer Explorer URL**: [0x6E295655a39A5f9aDFF8B087497737788aCC8881](https://explorer-studio.genlayer.com/address/0x6E295655a39A5f9aDFF8B087497737788aCC8881)
- **Commit Hash**: `b574af4`

---

## Source Code Integrity Verification

The deployed contract code was verified against the local source file `contracts/MirrorJudge.py` using the following exact cryptographic verification procedure:
1. Query deployment transaction `0xb49227544fa1e4ba1631c8b422cf42438f5d355480a14540972509660693d5c7` from Studionet RPC endpoint via `eth_getTransactionByHash`.
2. Extract the base64-encoded deployed source string from `result.data.contract_code`.
3. Base64-decode the raw code buffer into bytes.
4. Compute the SHA-256 digest of the decoded bytes.
5. Compute the SHA-256 digest of the local file `contracts/MirrorJudge.py`.

```
Local Source SHA-256:    1f4c4f1bdf5e58177adc780fafe5bfa22c6f786d6e78e3585062c98c2bacf1ee
Deployed Source SHA-256: 1f4c4f1bdf5e58177adc780fafe5bfa22c6f786d6e78e3585062c98c2bacf1ee
Byte-for-Byte Match:     true
```

---

## Live Case Adjudications

### 1. Case A: Clear-Cut Dispute (`DECIDED|PARTY_1|STABLE`)
- **Case ID**: `ebe94dc89329`
- **Title**: `Freelance Milestone 1 Delivery Verification`
- **Open Transaction**: `0xd12a175fa54892959fc8b46c51b3e58a8c23d1f4e9501bb911ab620480ba9b1e`
- **Party 1 Evidence Tx**: `0xd0bd5ccab86c300e99b33dc65fbeabfeeaa80a335017fbfe41d670f1efe0ceaa`
- **Party 2 Evidence Tx**: `0x074c8863e3791ee40ecdb802749b656b2529abb760f1b6fd4460d88f31a8e419`
- **Judge Transaction**: `0x3b5460d089fc1f01020ecd62c3c2d44f390a4fd060e4dc01fddbda3ee5725a2c`
- **Status**: `ACCEPTED`
- **Consensus Result**: `MAJORITY_AGREE`
- **Leader Execution Result**: `SUCCESS`
- **Measured Consensus Latency**: `34.66s`
- **Round Decision**: `DECIDED|PARTY_1|STABLE`
- **Consumer Settlement Tx**: `0x16e72292f888488997f32ae448a19aac83f3b8d788e1baae620d682d538ebae5`
- **Consumer Settlement Read-Back**: `SETTLED_PARTY_1`
- **Verified Stability Certificate**:
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

### 2. Case B: Insufficient Evidence Dispute (`INSUFFICIENT|NONE|NA`)
- **Case ID**: `fa1c4d0832e1`
- **Title**: `Commercial Lease Cleaning Deposit Dispute`
- **Open Transaction**: `0x185dcc1801f66959ad5e003530f4cfc87e48c07fa4f3d82b3049f462df183e72`
- **Party 1 Evidence Tx**: `0x0499177e80c1720cab8bab080354b5a945bc04ca0fda97221ae246d364136e20`
- **Judge Transaction**: `0x79e81365d229556cc07bcf3d6d5c18a17072ad1cbf68304964b900bc477be4fa`
- **Status**: `ACCEPTED`
- **Consensus Result**: `MAJORITY_AGREE`
- **Leader Execution Result**: `SUCCESS`
- **Measured Latency**: `8.31s`
- **Round Decision**: `INSUFFICIENT|NONE|NA` (resolved deterministically without LLM overhead)
- **Verified Stability Certificate**:
```json
{
  "schema_version": "1.0",
  "case_id": "fa1c4d0832e1",
  "title": "Commercial Lease Cleaning Deposit Dispute",
  "opener": "0xD3cCD6Aba6E9d4b39a81d32D675f77c2E31e8EC6",
  "opposing": "0x5C89713c743edb72EC13eB2e5646C723ccC19500",
  "status": "OPEN",
  "config": {
    "margin_bp": 1500,
    "max_flips": 1,
    "max_rounds": 3,
    "criteria": [
      {
        "id": "premises_restoration",
        "text": "Which party substantiated proper restoration and professional cleaning of premises: PARTY_1 or PARTY_2?",
        "weight_bp": 10000
      }
    ]
  },
  "rounds": [
    {
      "n": 1,
      "decision": "INSUFFICIENT|NONE|NA"
    }
  ],
  "current_decision": "INSUFFICIENT|NONE|NA",
  "is_decided": false,
  "outcome": "PENDING"
}
```

---

### 3. Balanced Performance Dispute (`DECIDED|SPLIT|STABLE`)
- **Case ID**: `8408ccd5e6ef`
- **Title**: `Balanced Shared Performance Dispute`
- **Open Transaction**: `0x7bba2e8482ae562cfff1bafbfe2a237badf44075f9f6c5f5464a2d61301826fa`
- **Judge Transaction**: `0x555917bd7862de14c17e54e9097ed9aa091890c9316c682413e6268055ecba08`
- **Status**: `ACCEPTED`
- **Consensus Result**: `MAJORITY_AGREE`
- **Leader Execution Result**: `SUCCESS`
- **Measured Consensus Latency**: `19.79s`
- **Round Decision**: `DECIDED|SPLIT|STABLE`
- **Verified Outcome**: `SPLIT`

---

### 4. Case C: Multi-Round Escalation Dispute
- **Case ID**: `36449cc60579`
- **Title**: `Cloud Server Infrastructure Uptime SLA Dispute`
- **Open Transaction**: `0xc583ff18d88376ad2cad8d1a17577c56ba289e723dc91535a04eaa747e4bd156`

#### Round 1 (Initial Unsubstantiated Claims)
- **Party 1 Ev1 Tx**: `0xf5ecdbd6c177a8dd8ad1a90498cb6a2e7476f3f69a3d0fc3a43c20ac2896bed3`
- **Party 2 Ev2 Tx**: `0x0365ddcbea2506015bd9729e11edb5ade55b575bc01e8809a859a6b95f196415`
- **Round 1 Judge Tx**: `0x2c2a17baee5271fc930f73b071edcf77b2396c04f4c3faf3c63f67d61f22b4db`
- **Status**: `ACCEPTED`
- **Consensus Result**: `MAJORITY_AGREE`
- **Leader Execution Result**: `SUCCESS`
- **Measured Latency**: `138.39s`
- **Round 1 Decision**: `INSUFFICIENT|NONE|NA` (unsubstantiated claims, outcome `PENDING`)

#### Round 2 (Escalation with Third-Party Audited Logs & Admission)
- **Party 1 Ev3 Tx**: `0xf6f4c60b5eb7eb452b55398947c5d51ca76e140994eb86dccfd3d7274facba44`
- **Party 2 Ev4 Tx**: `0x9721a1dba1d8d6c7f9e530501cd20a5a5938b10061d45e3457512b29735169f2`
- **Round 2 Judge Tx**: `0x658973dea8b9320fc0f4d1485b3433508e17a346600b42af47ec22aca4b923c9`
- **Status**: `ACCEPTED`
- **Consensus Result**: `MAJORITY_AGREE`
- **Leader Execution Result**: `SUCCESS`
- **Measured Latency**: `53.35s`
- **Round 2 Decision**: `DECIDED|PARTY_1|STABLE`
- **Final Status**: `JUDGED`
- **Verified Stability Certificate after Round 2**:
```json
{
  "schema_version": "1.0",
  "case_id": "36449cc60579",
  "title": "Cloud Server Infrastructure Uptime SLA Dispute",
  "opener": "0xC6861907790A1aF476cd14dE87F303Cb1FC1C4Da",
  "opposing": "0x94D0e1739A5489f1708553b14DE016913fCc088A",
  "status": "JUDGED",
  "config": {
    "margin_bp": 1500,
    "max_flips": 1,
    "max_rounds": 3,
    "criteria": [
      {
        "id": "sla_uptime",
        "text": "Which party substantiated superior server uptime and SLA compliance: PARTY_1 or PARTY_2?",
        "weight_bp": 10000
      }
    ]
  },
  "rounds": [
    {
      "n": 1,
      "decision": "INSUFFICIENT|NONE|NA"
    },
    {
      "n": 2,
      "decision": "DECIDED|PARTY_1|STABLE"
    }
  ],
  "current_decision": "DECIDED|PARTY_1|STABLE",
  "is_decided": true,
  "outcome": "PARTY_1"
}
```
