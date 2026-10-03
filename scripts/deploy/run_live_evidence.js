const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const { createClient, chains, createAccount } = require('genlayer-js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
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

  // Deploy MirrorJudge
  console.log("\n==========================================");
  console.log("Deploying MirrorJudge Contract to Studionet...");
  console.log("==========================================");
  const deployStart = Date.now();
  const deployTxHash = await client1.deployContract({
    code: judgeCode,
    args: [],
  });
  console.log("Deploy Tx Hash:", deployTxHash);
  const deployReceipt = await client1.waitForTransactionReceipt({
    hash: deployTxHash,
    retries: 120,
    interval: 3000,
  });
  const deployDurationSec = ((Date.now() - deployStart) / 1000).toFixed(2);
  const contractAddress = deployReceipt.recipient;
  console.log(`Deployed MirrorJudge Address: ${contractAddress} in ${deployDurationSec}s`);
  console.log("Deploy Status:", deployReceipt.status_name);
  console.log("Deploy Result:", deployReceipt.result_name);

  // Deploy Consumer Contract
  const consumerCodePath = path.join(__dirname, '../../examples/consumer/consumer.py');
  const consumerCode = fs.readFileSync(consumerCodePath, 'utf8');
  console.log("\nDeploying MirrorJudgeConsumer Contract...");
  const consumerDeployTxHash = await client1.deployContract({
    code: consumerCode,
    args: [contractAddress],
  });
  console.log("Consumer Deploy Tx Hash:", consumerDeployTxHash);
  const consumerReceipt = await client1.waitForTransactionReceipt({
    hash: consumerDeployTxHash,
    retries: 120,
    interval: 3000,
  });
  const consumerContractAddress = consumerReceipt.recipient;
  console.log("Deployed Consumer Address:", consumerContractAddress);

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
  await client1.waitForTransactionReceipt({ hash: openTxA, retries: 120, interval: 3000 });

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
  await client1.waitForTransactionReceipt({ hash: ev1TxA, retries: 120, interval: 3000 });
  console.log("Case A Party 1 Evidence Tx:", ev1TxA);

  const ev2A = "Bob Dev explicitly admits in written correspondence: Alice Corp successfully completed all software deliverables on schedule and complied with specifications.";
  const ev2TxA = await client2.writeContract({
    address: contractAddress,
    functionName: 'add_evidence',
    args: [caseIdA, ev2A],
  });
  await client2.waitForTransactionReceipt({ hash: ev2TxA, retries: 120, interval: 3000 });
  console.log("Case A Party 2 Evidence Tx:", ev2TxA);

  console.log("Running judge() for Case A...");
  const judgeStartA = Date.now();
  const judgeTxA = await client1.writeContract({
    address: contractAddress,
    functionName: 'judge',
    args: [caseIdA],
  });
  console.log("Case A judge Tx:", judgeTxA);
  const judgeReceiptA = await client1.waitForTransactionReceipt({ hash: judgeTxA, retries: 120, interval: 3000 });
  const judgeLatencyA = ((Date.now() - judgeStartA) / 1000).toFixed(2);
  console.log(`Case A judge completed in ${judgeLatencyA}s`);
  console.log("Case A Status:", judgeReceiptA.status_name);
  console.log("Case A Result:", judgeReceiptA.result_name);

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
  const consumerSettleReceipt = await client1.waitForTransactionReceipt({
    hash: consumerSettleTx,
    retries: 120,
    interval: 3000,
  });
  console.log("Consumer Settle Status:", consumerSettleReceipt.status_name);
  console.log("Consumer Settle Result:", consumerSettleReceipt.result_name);

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
  await client1.waitForTransactionReceipt({ hash: openTxB, retries: 120, interval: 3000 });

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
  await client1.waitForTransactionReceipt({ hash: ev1TxB, retries: 120, interval: 3000 });
  console.log("Case B Party 1 Evidence Tx:", ev1TxB);

  console.log("Running judge() for Case B (deterministic insufficient check)...");
  const judgeStartB = Date.now();
  const judgeTxB = await client1.writeContract({
    address: contractAddress,
    functionName: 'judge',
    args: [caseIdB],
  });
  console.log("Case B judge Tx:", judgeTxB);
  const judgeReceiptB = await client1.waitForTransactionReceipt({ hash: judgeTxB, retries: 120, interval: 3000 });
  const judgeLatencyB = ((Date.now() - judgeStartB) / 1000).toFixed(2);
  console.log(`Case B judge completed in ${judgeLatencyB}s`);
  console.log("Case B Status:", judgeReceiptB.status_name);
  console.log("Case B Result:", judgeReceiptB.result_name);

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
  await client1.waitForTransactionReceipt({ hash: openTxC, retries: 120, interval: 3000 });

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
  await client1.waitForTransactionReceipt({ hash: ev1TxC, retries: 120, interval: 3000 });

  const ev2C = "Frank Systems insists that Party 2 maintained 99.9 percent SLA uptime and Eve Networks caused all server outages.";
  const ev2TxC = await client2.writeContract({
    address: contractAddress,
    functionName: 'add_evidence',
    args: [caseIdC, ev2C],
  });
  await client2.waitForTransactionReceipt({ hash: ev2TxC, retries: 120, interval: 3000 });

  console.log("Running judge() for Case C Round 1...");
  const judgeStartC1 = Date.now();
  const judgeTxC1 = await client1.writeContract({
    address: contractAddress,
    functionName: 'judge',
    args: [caseIdC],
  });
  console.log("Case C Round 1 judge Tx:", judgeTxC1);
  const judgeReceiptC1 = await client1.waitForTransactionReceipt({ hash: judgeTxC1, retries: 120, interval: 3000 });
  const judgeLatencyC1 = ((Date.now() - judgeStartC1) / 1000).toFixed(2);
  console.log(`Case C Round 1 judge completed in ${judgeLatencyC1}s`);
  console.log("Case C Round 1 Status:", judgeReceiptC1.status_name);
  console.log("Case C Round 1 Result:", judgeReceiptC1.result_name);

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
  await client1.waitForTransactionReceipt({ hash: ev3TxC, retries: 120, interval: 3000 });

  const ev4C = "Frank Systems admits: The Datadog audit report is accurate and confirms Eve Networks maintained 99.99 percent gateway uptime.";
  const ev4TxC = await client2.writeContract({
    address: contractAddress,
    functionName: 'add_evidence',
    args: [caseIdC, ev4C],
  });
  await client2.waitForTransactionReceipt({ hash: ev4TxC, retries: 120, interval: 3000 });

  console.log("Running judge() for Case C Round 2...");
  const judgeStartC2 = Date.now();
  const judgeTxC2 = await client1.writeContract({
    address: contractAddress,
    functionName: 'judge',
    args: [caseIdC],
  });
  console.log("Case C Round 2 judge Tx:", judgeTxC2);
  const judgeReceiptC2 = await client1.waitForTransactionReceipt({ hash: judgeTxC2, retries: 120, interval: 3000 });
  const judgeLatencyC2 = ((Date.now() - judgeStartC2) / 1000).toFixed(2);
  console.log(`Case C Round 2 judge completed in ${judgeLatencyC2}s`);
  console.log("Case C Round 2 Status:", judgeReceiptC2.status_name);
  console.log("Case C Round 2 Result:", judgeReceiptC2.result_name);

  const certC2 = await client1.readContract({
    address: contractAddress,
    functionName: 'get_certificate',
    args: [caseIdC],
  });
  console.log("Case C Certificate after Round 2:", certC2);

  // -------------------------------------------------------------------------
  // On-Chain Code Verification
  // -------------------------------------------------------------------------
  console.log("\n==========================================");
  console.log("Verifying Deployed Contract Code Hash vs Local Source...");
  console.log("==========================================");
  // Fetch deployment transaction via eth_getTransactionByHash
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
  console.log("\nSuccessfully saved live evidence to scripts/deploy/live_evidence.json");
}

main().catch(err => {
  console.error("Live evidence error:", err);
  process.exit(1);
});
