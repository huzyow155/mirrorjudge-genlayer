# On-Chain Verification & Live Evidence Report

## Network & Contract Coordinates

- **Network**: GenLayer Studionet (Preview)
- **Chain ID**: `61999`
- **RPC URL**: `https://studio.genlayer.com/api`
- **Contract Address**: `0x3991d0817f8FD6B6632b1C2c21d234598CbF4e17`
- **Explorer URL**: [0x3991d0817f8FD6B6632b1C2c21d234598CbF4e17](https://explorer-studio.genlayer.com/address/0x3991d0817f8FD6B6632b1C2c21d234598CbF4e17)
- **Consumer Contract Address**: `0x294FFDec366826F8682CFAAEbaf25DcAeBda9317`
- **Consumer Explorer URL**: [0x294FFDec366826F8682CFAAEbaf25DcAeBda9317](https://explorer-studio.genlayer.com/address/0x294FFDec366826F8682CFAAEbaf25DcAeBda9317)
- **Commit Hash**: `148ca55`

---

## Source Code Integrity Verification

The deployed contract code was verified against the local source file `contracts/MirrorJudge.py` using the following exact cryptographic verification procedure:
1. Query deployment transaction `0x8e6a7c865bd92a00c1c518325347d164842467e881079cbff68958cda1e474bd` from Studionet RPC endpoint via `eth_getTransactionByHash`.
2. Extract the base64-encoded deployed source string from `result.data.contract_code`.
3. Base64-decode the raw code buffer into bytes.
4. Compute the SHA-256 digest of the decoded bytes.
5. Compute the SHA-256 digest of the local file `contracts/MirrorJudge.py`.

```
Local Source SHA-256:    a1bb39e06e6768505c818ab426d5fbd0b95a03b1c45e2e937ab6ad3074da63d8
Deployed Source SHA-256: a1bb39e06e6768505c818ab426d5fbd0b95a03b1c45e2e937ab6ad3074da63d8
Byte-for-Byte Match:     true
```

---

## Live Case Adjudications

### 1. Case A: Clear-Cut Dispute (`DECIDED|PARTY_1|STABLE`)
- **Case ID**: `99f9b7444e2a`
- **Title**: `Freelance Milestone 1 Delivery Verification`
- **Open Transaction**: `0xdfee9bbeaa57f035d74fe4fd844df0d42316ee559eabd3b46c387ef5344c0d11`
- **Party 1 Evidence Tx**: `0x8b4fb8b0a73bf5d940c2a73638500e3e39a8307641c98f8480500a926771ca20`
- **Party 2 Evidence Tx**: `0x98306c7fcaa1629d9a4d142041b7be2325faa747d7bca559d98aec5cf78eff31`
- **Judge Transaction**: `0x054201e007c6138ccd1d0a45071e5044ee74acce0d877ba1c3ada3ea4a99bf06`
- **Status**: `ACCEPTED`
- **Consensus Result**: `MAJORITY_AGREE`
- **Leader Execution Result**: `SUCCESS`
- **Measured Consensus Latency**: `58.01s`
- **Round Decision**: `DECIDED|PARTY_1|STABLE`
- **Consumer Settlement Tx**: `0x871bb93171ae3881eed12217c81e7c7655fc5de5ada6e3b273992b691bf264e1`
- **Consumer Settlement Read-Back**: `SETTLED_PARTY_1`
- **Verified Stability Certificate**:
```json
{
  "schema_version": "1.0",
  "case_id": "99f9b7444e2a",
  "title": "Freelance Milestone 1 Delivery Verification",
  "opener": "0xf77fd09910D52B3A3AAFe52E4c3938C2d69a8B78",
  "opposing": "0x2d35C23688A1138B0CE142748e47f234db1FB569",
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
- **Case ID**: `affb287df9cb`
- **Title**: `Commercial Lease Cleaning Deposit Dispute`
- **Open Transaction**: `0x119031c8f81504733729ccca79d063606ef812a4f03457f881e3efc4bb480af3`
- **Party 1 Evidence Tx**: `0x31013a00a997a4ce056cd6328311dc10547b1aaa0c4d2e0dec5d1a5f7043ac66`
- **Judge Transaction**: `0x8fdae96264290cb3acbc850e5efcbad40f62bcb81b2444da5a94673b24b0348c`
- **Status**: `ACCEPTED`
- **Consensus Result**: `MAJORITY_AGREE`
- **Leader Execution Result**: `SUCCESS`
- **Measured Latency**: `5.06s`
- **Round Decision**: `INSUFFICIENT|NONE|NA` (resolved deterministically without LLM overhead)
- **Verified Stability Certificate**:
```json
{
  "schema_version": "1.0",
  "case_id": "affb287df9cb",
  "title": "Commercial Lease Cleaning Deposit Dispute",
  "opener": "0xf77fd09910D52B3A3AAFe52E4c3938C2d69a8B78",
  "opposing": "0x2d35C23688A1138B0CE142748e47f234db1FB569",
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

### 3. Case C: Multi-Round Escalation Dispute (`DECIDED|SPLIT|STABLE`)
- **Case ID**: `bf29f5d7c7fd`
- **Title**: `API Gateway Infrastructure SLA Milestone Dispute`
- **Open Transaction**: `0x131fc2a2a4add071c37c32288521c0997214283620b8aa1ca26dd288974fc6bb`

#### Round 1 (Balanced Performance)
- **Party 1 Ev1 Tx**: `0xebeed5a505a181cf26d864d8a7d015d1852da7a2a17f60573a12fccc7e9e0c18`
- **Party 2 Ev2 Tx**: `0xeb20f2398abac03dad399743c47501e953e2a29738c88b6b2382916e519339c3`
- **Round 1 Judge Tx**: `0x81643659e4341a05cae0841f5b4bad68e4193b93660af328af34d53b7aeb4662`
- **Status**: `ACCEPTED`
- **Consensus Result**: `MAJORITY_AGREE`
- **Leader Execution Result**: `SUCCESS`
- **Measured Latency**: `31.49s`
- **Round 1 Decision**: `DECIDED|SPLIT|STABLE`
- **Verified Stability Certificate**:
```json
{
  "schema_version": "1.0",
  "case_id": "bf29f5d7c7fd",
  "title": "API Gateway Infrastructure SLA Milestone Dispute",
  "opener": "0xf77fd09910D52B3A3AAFe52E4c3938C2d69a8B78",
  "opposing": "0x2d35C23688A1138B0CE142748e47f234db1FB569",
  "status": "JUDGED",
  "config": {
    "margin_bp": 1500,
    "max_flips": 1,
    "max_rounds": 3,
    "criteria": [
      {
        "id": "sla_maintenance",
        "text": "Which party substantiated superior system uptime and SLA maintenance: PARTY_1 or PARTY_2?",
        "weight_bp": 10000
      }
    ]
  },
  "rounds": [
    {
      "n": 1,
      "decision": "DECIDED|SPLIT|STABLE"
    }
  ],
  "current_decision": "DECIDED|SPLIT|STABLE",
  "is_decided": true,
  "outcome": "SPLIT"
}
```

---

### 4. Hardened Dispute Verification: Unsupported Contradictory Claims
- **Case ID**: `74320c3924e2`
- **Title**: `Production Milestone Dispute (Hardened Consensus Verification)`
- **Judge Transaction**: `0xb479e9f1746dbf138287c9580182982305dcf4f53934475f52e6b9833e270c47`
- **Measured Latency**: `15.07s`
- **Receipt Status**: `ACCEPTED`
- **Leader Execution**: `SUCCESS`
- **Round Decision**: `DECIDED|SPLIT|STABLE`
- **Outcome**: `SPLIT`
- **Consensus Note**: Replicates the exact evidence structure of previously divergent disputes; resolves stably under the prompt tie-break hardening without validator disagreement.
