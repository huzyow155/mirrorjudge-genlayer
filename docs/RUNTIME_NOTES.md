# Runtime Notes & Verification (Milestone 0)

## Overview
This document records the exact runtime characteristics of GenLayer Studio (`studionet`, chain ID `61999`, RPC `https://studio.genlayer.com/api`) probed live on-chain using `contracts/Probe.py`.

## Header and Imports Chosen
```python
# v0.2.16
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
```

This header is verified live on Studionet.

## Probed Behaviors & Findings

1. **Sender Address Accessor & String Conversion**:
   - `gl.message.sender_address` returns an instance of type `Address`.
   - String representation can be obtained either via `sender.as_hex` or `str(sender)` (e.g. `0x8Dd2617732258f6d0Ef162298b7525FE91F90B42`).

2. **Standard Library Imports**:
   - `import hashlib` succeeds inside methods and constructors.
   - SHA-256 digests compute deterministically (`hashlib_test`: `80a149ff6cb4`).

3. **User Error Class**:
   - `gl.vm.UserError` is verified present and correctly identified as `UserError`.

4. **Equivalence Principle (`gl.eq_principle.strict_eq`)**:
   - `gl.eq_principle.strict_eq(fn)` executes the function across validators and enforces that all validators reach the exact same string value (`strict_eq_passed`: `true`).

5. **Non-deterministic Prompt Execution (`gl.nondet.exec_prompt`)**:
   - `gl.nondet.exec_prompt(prompt, response_format="json")` is supported.
   - On this runtime, `response_format="json"` returns a Python `dict` (`nondet_type`: `"dict"`, parsed to `"{'status': 'OK'}"`).
   - The contract uses defensive parsing (`_parse`) which handles both direct `dict` returns and string/code-fenced JSON responses seamlessly.

6. **Latency**:
   - Measured consensus transaction duration: `14.92s`.

## On-Chain Verification Artifacts
- **Network**: GenLayer Studionet (Chain ID 61999)
- **Deployer**: `0x8Dd2617732258f6d0Ef162298b7525FE91F90B42`
- **Probe Contract Address**: `0x2106760ca2BD2a55be57A8B68373F65afCdc2Fe2`
- **Deploy Tx Hash**: `0x82fcd84fe54db8447a06523ca0677515500697c731551699a074345d1b9d5b0e`
- **Deploy Status**: `ACCEPTED`
- **Deploy Consensus Result**: `MAJORITY_AGREE`
- **Consensus Probe Tx Hash**: `0xfe3383da70850429f05b0956e9de67874efff3342f413d7cbc3c796ebb4f3d67`
- **Consensus Status**: `ACCEPTED`
- **Consensus Result**: `MAJORITY_AGREE`
- **Measured Consensus Latency**: `14.92s`
- **Verified Read-Back JSON**:
```json
{
  "sender_address": "0x8Dd2617732258f6d0Ef162298b7525FE91F90B42",
  "sender_str": "0x8Dd2617732258f6d0Ef162298b7525FE91F90B42",
  "sender_type": "Address",
  "hashlib_test": "80a149ff6cb4",
  "user_error_class": "gl.vm.UserError",
  "strict_eq_passed": true,
  "response_format_param_supported": true,
  "nondet_raw_output": "{'status': 'OK'}",
  "nondet_type": "dict"
}
```
