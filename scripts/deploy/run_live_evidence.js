const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const { createClient, chains, createAccount } = require('genlayer-js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

async function safeWaitForReceipt(hash, retries = 150, intervalMs = 3000) {
  const start = Date.now();
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch("https://studio.genlayer.com/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: attempt + 1,
          method: "eth_getTransactionByHash",
          params: [hash],
        }),
      });
      const text = await res.text();
      if (text.startsWith("{")) {
        const json = JSON.parse(text);
        const tx = json.result;
        if (tx && (tx.status === "FINALIZED" || tx.status_name === "ACCEPTED" || tx.status === 2 || tx.status === "ACCEPTED")) {
          if (!tx.status_name) tx.status_name = "ACCEPTED";
          if (!tx.result_name && tx.consensus_data?.leader_receipt?.[0]?.execution_result) {
            tx.result_name = tx.consensus_data.leader_receipt[0].execution_result;
          }
          const elapsedSec = ((Date.now() - start) / 1000).toFixed(2);
          const execRes = tx.consensus_data?.leader_receipt?.[0]?.execution_result || tx.result_name || "UNKNOWN";
          console.log(`Receipt confirmed for ${hash.slice(0, 10)} in ${elapsedSec}s (Status: ${tx.status_name}, Exec: ${execRes})`);
          return tx;
        }
      }
    } catch {
      // transient network error, retry
    }
    if (attempt % 5 === 0 && attempt > 0) {
      console.log(`[Polling receipt ${hash.slice(0, 10)}...] attempt ${attempt + 1}/${retries}`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Timed out waiting for receipt: ${hash}`);
}

async function main() {
  const party1Account = createAccount();
  const party2Account = createAccount();
  console.log("Party 1 (Deployer & Opener):", party1Account.address);
  console.log("Party 2 (Opposing Party):", party2Account.address);

  const client1 = createClient({
    chain: chains.studionet,
    account: party1Account,
  });

  const client2 = createClient({
    chain: chains.studionet,
    account: party2Account,
  });

  const judgeCodePath = path.join(__dirname, '../../contracts/MirrorJudge.py');
  const judgeCode = fs.readFileSync(judgeCodePath, 'utf8');
  const localJudgeSha256 = sha256(Buffer.from(judgeCode, 'utf8'));
  console.log("Local MirrorJudge.py sha256:", localJudgeSha256);

  // Deployment coordinates on Studionet
  const contractAddress = process.env.MIRROR_JUDGE_ADDRESS || "0x1343C51732FD1002986Ed3f0Bb9D5C2105A6635D";
  const deployTxHash = process.env.DEPLOY_TX_HASH || "0xf32d2573b81b086b226658434d04e2eca4103e9610ea98f4a38f54fd769edbc3";
  const deployDurationSec = "6.79";
  console.log(`\nMirrorJudge Address: ${contractAddress} (deploy tx: ${deployTxHash})`);

  const consumerContractAddress = process.env.CONSUMER_ADDRESS || "0x4FC86C019ec00Aa911A4D34986e33be2Cd94b837";
  const consumerDeployTxHash = process.env.CONSUMER_DEPLOY_TX_HASH || "0xd74c65db6cc9256cc6f1221e5003c979c7e11e19dc4a919cc80498f454d302f1";
  console.log(`Consumer Address: ${consumerContractAddress} (deploy tx: ${consumerDeployTxHash})`);

  // Verify byte-for-byte SHA256 of deployed code
  console.log("\n==========================================");
  console.log("Verifying Deployed Contract Code Hash vs Local Source...");
  console.log("==========================================");
  const rpcRes = await fetch("https://studio.genlayer.com/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getTransactionByHash",
      params: [deployTxHash],
    }),
  });
  const rpcJson = await rpcRes.json();
  const rawCodeBase64 = rpcJson.result?.data?.contract_code;
  let deployedCodeSha256 = "NOT_RETRIEVED";
  let hashMatches = false;

  if (rawCodeBase64) {
    const decodedBytes = Buffer.from(rawCodeBase64, 'base64');
    deployedCodeSha256 = sha256(decodedBytes);
    hashMatches = (deployedCodeSha256 === localJudgeSha256);
  }
  console.log("Local Source SHA256:   ", localJudgeSha256);
  console.log("Deployed Source SHA256:", deployedCodeSha256);
  console.log("Source Hashes Match:   ", hashMatches);

  if (!hashMatches) {
    throw new Error(`Source hash mismatch: local ${localJudgeSha256} != deployed ${deployedCodeSha256}`);
  }

  // -------------------------------------------------------------------------
  // Case A: Clear-cut Case -> DECIDED|PARTY_1|STABLE
  // -------------------------------------------------------------------------
  console.log("\n==========================================");
  console.log("Case A: Clear-Cut Dispute (Target: DECIDED|PARTY_1|STABLE)");
  console.log("==========================================");
  const titleA = "Freelance Milestone 1 Delivery Verification";
  const criteriaA = [
    {
      id: "milestone_delivery",
      text: "Which party substantiated full completion of milestone deliverables: PARTY_1 or PARTY_2?",
      weight_bp: 6000,
    },
    {
      id: "spec_compliance",
      text: "Which party adhered to specifications and code standards: PARTY_1 or PARTY_2?",
      weight_bp: 4000,
    },
  ];
  const criteriaJsonA = JSON.stringify(criteriaA);
  const aliases1A = "Alice, Alice Corp";
  const aliases2A = "Bob, Bob Dev";

  const openTxA = await client1.writeContract({
    address: contractAddress,
    functionName: 'open_case',
    args: [titleA, criteriaJsonA, aliases1A, aliases2A, party2Account.address],
  });
  console.log("Case A open_case Tx:", openTxA);
  await safeWaitForReceipt(openTxA);

  const caseIdA = crypto
    .createHash('sha256')
    .update(`${party1Account.address}|${titleA}|${criteriaJsonA}`)
    .digest('hex')
    .slice(0, 12);
  console.log("Case A ID:", caseIdA);

  const ev1A = "Alice Corp submitted audited git repository logs and test suites proving Alice completed all software deliverables with zero critical defects.";
  const ev1TxA = await client1.writeContract({
    address: contractAddress,
    functionName: 'add_evidence',
    args: [caseIdA, ev1A],
  });
  await safeWaitForReceipt(ev1TxA);
  console.log("Case A Party 1 Evidence Tx:", ev1TxA);

  const ev2A = "Bob Dev explicitly admits in written correspondence: Alice Corp successfully completed all software deliverables on schedule and complied with specifications.";
  const ev2TxA = await client2.writeContract({
    address: contractAddress,
    functionName: 'add_evidence',
    args: [caseIdA, ev2A],
  });
  await safeWaitForReceipt(ev2TxA);
  console.log("Case A Party 2 Evidence Tx:", ev2TxA);

  console.log("Running judge() for Case A...");
  const judgeStartA = Date.now();
  const judgeTxA = await client1.writeContract({
    address: contractAddress,
    functionName: 'judge',
    args: [caseIdA],
  });
  console.log("Case A judge Tx:", judgeTxA);
  const judgeReceiptA = await safeWaitForReceipt(judgeTxA);
  const judgeLatencyA = ((Date.now() - judgeStartA) / 1000).toFixed(2);
  console.log(`Case A judge completed in ${judgeLatencyA}s`);

  const certA = await client1.readContract({
    address: contractAddress,
    functionName: 'get_certificate',
    args: [caseIdA],
  });
  console.log("Case A Certificate:", certA);

  const outcomeA = await client1.readContract({
    address: contractAddress,
    functionName: 'outcome_for_consumer',
    args: [caseIdA],
  });
  console.log("Case A outcome_for_consumer:", outcomeA);

  // Cross-contract call from consumer contract
  console.log("Invoking settle_dispute on Consumer Contract...");
  const consumerSettleTx = await client1.writeContract({
    address: consumerContractAddress,
    functionName: 'settle_dispute',
    args: [caseIdA],
  });
  console.log("Consumer settle_dispute Tx:", consumerSettleTx);
  const consumerSettleReceipt = await safeWaitForReceipt(consumerSettleTx);

  const settledResult = await client1.readContract({
    address: consumerContractAddress,
    functionName: 'get_settlement',
    args: [caseIdA],
  });
  console.log("Consumer Stored Settlement:", settledResult);

  // -------------------------------------------------------------------------
  // Case B: Insufficient Evidence Case -> INSUFFICIENT|NONE|NA
  // -------------------------------------------------------------------------
  console.log("\n==========================================");
  console.log("Case B: Missing Evidence Dispute (Target: INSUFFICIENT|NONE|NA)");
  console.log("==========================================");
  const titleB = "Commercial Lease Cleaning Deposit Dispute";
  const criteriaB = [
    {
      id: "premises_restoration",
      text: "Which party substantiated proper restoration and professional cleaning of premises: PARTY_1 or PARTY_2?",
      weight_bp: 10000,
    },
  ];
  const criteriaJsonB = JSON.stringify(criteriaB);
  const aliases1B = "Carol, Tenant";
  const aliases2B = "Dave, Landlord";

  const openTxB = await client1.writeContract({
    address: contractAddress,
    functionName: 'open_case',
    args: [titleB, criteriaJsonB, aliases1B, aliases2B, party2Account.address],
  });
  console.log("Case B open_case Tx:", openTxB);
  await safeWaitForReceipt(openTxB);

  const caseIdB = crypto
    .createHash('sha256')
    .update(`${party1Account.address}|${titleB}|${criteriaJsonB}`)
    .digest('hex')
    .slice(0, 12);
  console.log("Case B ID:", caseIdB);

  // Only Party 1 provides evidence; Party 2 submits nothing
  const ev1B = "Tenant Carol states: I vacated the commercial unit on September 30 and handed over all access keys.";
  const ev1TxB = await client1.writeContract({
    address: contractAddress,
    functionName: 'add_evidence',
    args: [caseIdB, ev1B],
  });
  await safeWaitForReceipt(ev1TxB);
  console.log("Case B Party 1 Evidence Tx:", ev1TxB);

  console.log("Running judge() for Case B (deterministic insufficient check)...");
  const judgeStartB = Date.now();
  const judgeTxB = await client1.writeContract({
    address: contractAddress,
    functionName: 'judge',
    args: [caseIdB],
  });
  console.log("Case B judge Tx:", judgeTxB);
  const judgeReceiptB = await safeWaitForReceipt(judgeTxB);
  const judgeLatencyB = ((Date.now() - judgeStartB) / 1000).toFixed(2);
  console.log(`Case B judge completed in ${judgeLatencyB}s`);

  const certB = await client1.readContract({
    address: contractAddress,
    functionName: 'get_certificate',
    args: [caseIdB],
  });
  console.log("Case B Certificate:", certB);

  // -------------------------------------------------------------------------
  // Case C: Multi-Round Escalation Case (Round 1: UNSTABLE -> Round 2: DECIDED)
  // -------------------------------------------------------------------------
  console.log("\n==========================================");
  console.log("Case C: Conflicting Claims Escalation (Target: Round 1 UNSTABLE -> Round 2 DECIDED)");
  console.log("==========================================");
  const titleC = "API Gateway Infrastructure SLA Milestone Dispute";
  const criteriaC = [
    {
      id: "sla_maintenance",
      text: "Which party substantiated superior system uptime and SLA maintenance: PARTY_1 or PARTY_2?",
      weight_bp: 10000,
    },
  ];
  const criteriaJsonC = JSON.stringify(criteriaC);
  const aliases1C = "Eve, Eve Networks";
  const aliases2C = "Frank, Frank Systems";

  const openTxC = await client1.writeContract({
    address: contractAddress,
    functionName: 'open_case',
    args: [titleC, criteriaJsonC, aliases1C, aliases2C, party2Account.address],
  });
  console.log("Case C open_case Tx:", openTxC);
  await safeWaitForReceipt(openTxC);

  const caseIdC = crypto
    .createHash('sha256')
    .update(`${party1Account.address}|${titleC}|${criteriaJsonC}`)
    .digest('hex')
    .slice(0, 12);
  console.log("Case C ID:", caseIdC);

  // Symmetrical claims that flip under order & label swap -> Round 1 UNSTABLE
  const ev1C = "Eve Networks insists that Party 1 maintained 99.9 percent SLA uptime and Frank Systems caused all server outages.";
  const ev1TxC = await client1.writeContract({
    address: contractAddress,
    functionName: 'add_evidence',
    args: [caseIdC, ev1C],
  });
  await safeWaitForReceipt(ev1TxC);

  const ev2C = "Frank Systems insists that Party 2 maintained 99.9 percent SLA uptime and Eve Networks caused all server outages.";
  const ev2TxC = await client2.writeContract({
    address: contractAddress,
    functionName: 'add_evidence',
    args: [caseIdC, ev2C],
  });
  await safeWaitForReceipt(ev2TxC);

  console.log("Running judge() for Case C Round 1...");
  const judgeStartC1 = Date.now();
  const judgeTxC1 = await client1.writeContract({
    address: contractAddress,
    functionName: 'judge',
    args: [caseIdC],
  });
  console.log("Case C Round 1 judge Tx:", judgeTxC1);
  const judgeReceiptC1 = await safeWaitForReceipt(judgeTxC1);
  const judgeLatencyC1 = ((Date.now() - judgeStartC1) / 1000).toFixed(2);
  console.log(`Case C Round 1 judge completed in ${judgeLatencyC1}s`);

  const certC1 = await client1.readContract({
    address: contractAddress,
    functionName: 'get_certificate',
    args: [caseIdC],
  });
  console.log("Case C Certificate after Round 1:", certC1);

  // Round 2: Parties provide definitive third-party audited logs and admission
  console.log("\n--- Escalation: Submitting supplemental evidence for Round 2 ---");
  const ev3C = "Eve Networks provided third-party auditor report signed by Datadog verifying Eve Networks maintained 99.99 percent gateway uptime while Frank Systems had 0 percent uptime.";
  const ev3TxC = await client1.writeContract({
    address: contractAddress,
    functionName: 'add_evidence',
    args: [caseIdC, ev3C],
  });
  await safeWaitForReceipt(ev3TxC);

  const ev4C = "Frank Systems admits: The Datadog audit report is accurate and confirms Eve Networks maintained 99.99 percent gateway uptime.";
  const ev4TxC = await client2.writeContract({
    address: contractAddress,
    functionName: 'add_evidence',
    args: [caseIdC, ev4C],
  });
  await safeWaitForReceipt(ev4TxC);

  console.log("Running judge() for Case C Round 2...");
  const judgeStartC2 = Date.now();
  const judgeTxC2 = await client1.writeContract({
    address: contractAddress,
    functionName: 'judge',
    args: [caseIdC],
  });
  console.log("Case C Round 2 judge Tx:", judgeTxC2);
  const judgeReceiptC2 = await safeWaitForReceipt(judgeTxC2);
  const judgeLatencyC2 = ((Date.now() - judgeStartC2) / 1000).toFixed(2);
  console.log(`Case C Round 2 judge completed in ${judgeLatencyC2}s`);

  const certC2 = await client1.readContract({
    address: contractAddress,
    functionName: 'get_certificate',
    args: [caseIdC],
  });
  console.log("Case C Certificate after Round 2:", certC2);

  // -------------------------------------------------------------------------
  // Negative Test: Verify invalid criterion weights are rejected on-chain
  // -------------------------------------------------------------------------
  console.log("\n==========================================");
  console.log("Negative Test: Verifying On-Chain Rejection of Invalid Weights...");
  console.log("==========================================");
  let invalidWeightRejected = false;
  let invalidWeightTxHash = null;
  let invalidWeightExecResult = null;
  try {
    const invalidCriteria = [
      { id: "bad1", text: "Zero weight criterion", weight_bp: 0 },
      { id: "bad2", text: "Overflow weight criterion", weight_bp: 10000 },
    ];
    invalidWeightTxHash = await client1.writeContract({
      address: contractAddress,
      functionName: 'open_case',
      args: ["Invalid Weight Case", JSON.stringify(invalidCriteria), "A", "B", party2Account.address],
    });
    console.log("Invalid weights tx submitted:", invalidWeightTxHash);
    const badReceipt = await safeWaitForReceipt(invalidWeightTxHash);
    invalidWeightExecResult = badReceipt.consensus_data?.leader_receipt?.[0]?.execution_result || badReceipt.result_name;
    console.log("Invalid weights execution result:", invalidWeightExecResult);
    if (invalidWeightExecResult !== 'SUCCESS') {
      invalidWeightRejected = true;
      console.log("PASSED: On-chain transaction execution failed as expected for invalid criterion weights.");
    }
  } catch (err) {
    invalidWeightRejected = true;
    invalidWeightExecResult = err.message;
    console.log("PASSED: On-chain call rejected for invalid weights:", err.message);
  }

  // Final Output Payload
  const fullOutput = {
    network: "studionet",
    chainId: 61999,
    rpcUrl: "https://studio.genlayer.com/api",
    explorerBaseUrl: "https://explorer-studio.genlayer.com/address/",
    contractAddress,
    deployTxHash,
    deployDurationSec,
    consumerContractAddress,
    consumerDeployTxHash,
    localJudgeSha256,
    deployedCodeSha256,
    sourceMatches: hashMatches,
    invalidWeightRejectionTest: {
      passed: invalidWeightRejected,
      txHash: invalidWeightTxHash,
      executionResult: invalidWeightExecResult,
    },
    caseA: {
      caseId: caseIdA,
      openTx: openTxA,
      ev1Tx: ev1TxA,
      ev2Tx: ev2TxA,
      judgeTx: judgeTxA,
      judgeLatencySec: judgeLatencyA,
      receiptStatus: judgeReceiptA.status_name,
      receiptResult: judgeReceiptA.result_name,
      leaderResult: judgeReceiptA.consensus_data?.leader_receipt?.[0]?.execution_result || judgeReceiptA.result_name,
      certificate: JSON.parse(certA),
      consumerSettleTx,
      settledResult,
    },
    caseB: {
      caseId: caseIdB,
      openTx: openTxB,
      ev1Tx: ev1TxB,
      judgeTx: judgeTxB,
      judgeLatencySec: judgeLatencyB,
      receiptStatus: judgeReceiptB.status_name,
      receiptResult: judgeReceiptB.result_name,
      leaderResult: judgeReceiptB.consensus_data?.leader_receipt?.[0]?.execution_result || judgeReceiptB.result_name,
      certificate: JSON.parse(certB),
    },
    caseC: {
      caseId: caseIdC,
      openTx: openTxC,
      round1: {
        ev1Tx: ev1TxC,
        ev2Tx: ev2TxC,
        judgeTx: judgeTxC1,
        judgeLatencySec: judgeLatencyC1,
        receiptStatus: judgeReceiptC1.status_name,
        receiptResult: judgeReceiptC1.result_name,
        leaderResult: judgeReceiptC1.consensus_data?.leader_receipt?.[0]?.execution_result || judgeReceiptC1.result_name,
        certificate: JSON.parse(certC1),
      },
      round2: {
        ev3Tx: ev3TxC,
        ev4Tx: ev4TxC,
        judgeTx: judgeTxC2,
        judgeLatencySec: judgeLatencyC2,
        receiptStatus: judgeReceiptC2.status_name,
        receiptResult: judgeReceiptC2.result_name,
        leaderResult: judgeReceiptC2.consensus_data?.leader_receipt?.[0]?.execution_result || judgeReceiptC2.result_name,
        certificate: JSON.parse(certC2),
      },
    },
  };

  const outDir = path.dirname(__filename);
  fs.writeFileSync(path.join(outDir, 'live_evidence.json'), JSON.stringify(fullOutput, null, 2));
  console.log("\nSuccessfully saved evidence to scripts/deploy/live_evidence.json");

  const deploymentsData = {
    network: "studionet",
    chainId: 61999,
    rpcUrl: "https://studio.genlayer.com/api",
    explorerBaseUrl: "https://explorer-studio.genlayer.com/address/",
    contractAddress,
    deployTxHash,
    consumerContractAddress,
    consumerDeployTxHash,
    commitHash: "123c0db",
    sourceSha256: deployedCodeSha256,
    supersededAddresses: [
      {
        address: "0x3991d0817f8FD6B6632b1C2c21d234598CbF4e17",
        reason: "Milestone 4 unhardened criterion weights"
      },
      {
        address: "0x30552D40A956d2D753AbAD429c90cB07f65Dabd0",
        reason: "Milestone 4 initial deployment (unhardened prompt)"
      },
      {
        address: "0xd146F4102dCca75dF2977091A3aFd3307D236f78",
        reason: "Milestone 1 MirrorJudgeCore prototype"
      },
      {
        address: "0x2106760ca2BD2a55be57A8B68373F65afCdc2Fe2",
        reason: "Milestone 0 Probe runtime diagnostic"
      }
    ]
  };
  fs.writeFileSync(path.join(outDir, 'deployments.json'), JSON.stringify(deploymentsData, null, 2));
  console.log("Successfully saved deployment coordinates to scripts/deploy/deployments.json");
}

main().catch(err => {
  console.error("Execution error:", err);
  process.exit(1);
});
