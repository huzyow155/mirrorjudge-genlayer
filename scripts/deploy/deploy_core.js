const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const { createClient, chains, createAccount } = require('genlayer-js');
const fs = require('fs');
const path = require('path');

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

  const codePath = path.join(__dirname, '../../contracts/MirrorJudgeCore.py');
  const code = fs.readFileSync(codePath, 'utf8');

  console.log("\n--- Deploying MirrorJudgeCore contract to Studionet ---");
  const deployTxHash = await client1.deployContract({
    code: code,
    args: [],
  });
  console.log("Deploy Transaction Hash:", deployTxHash);

  const receipt = await client1.waitForTransactionReceipt({
    hash: deployTxHash,
    retries: 120,
    interval: 3000,
  });
  console.log("Deploy Receipt Status:", receipt.status_name);
  console.log("Deploy Receipt Result:", receipt.result_name);
  const contractAddress = receipt.recipient;
  console.log("Deployed Core Address:", contractAddress);

  if (!contractAddress) {
    throw new Error("No contract address returned from deployment");
  }

  // 1. open_case
  console.log("\n--- Step 1: open_case ---");
  const title = "Software Delivery Milestone Verification";
  const criteria = [
    {
      id: "milestone_completion",
      text: "Which party substantiated satisfactory completion of software deliverables: PARTY_1 or PARTY_2?",
      weight_bp: 6000,
    },
    {
      id: "contract_compliance",
      text: "Which party adhered to the agreed specifications and milestone requirements: PARTY_1 or PARTY_2?",
      weight_bp: 4000,
    },
  ];
  const criteriaJson = JSON.stringify(criteria);
  const aliases1 = "Alice, Alice Corp";
  const aliases2 = "Bob, Bob Dev";

  const openTxHash = await client1.writeContract({
    address: contractAddress,
    functionName: 'open_case',
    args: [title, criteriaJson, aliases1, aliases2, party2Account.address],
  });
  console.log("open_case Tx Hash:", openTxHash);
  const openReceipt = await client1.waitForTransactionReceipt({
    hash: openTxHash,
    retries: 120,
    interval: 3000,
  });
  console.log("open_case Status:", openReceipt.status_name);
  console.log("open_case Result:", openReceipt.result_name);

  // Compute case_id: first 12 hex of sha256(opener|title|criteria_json)
  const crypto = require('crypto');
  const expectedCaseId = crypto
    .createHash('sha256')
    .update(`${party1Account.address}|${title}|${criteriaJson}`)
    .digest('hex')
    .slice(0, 12);
  console.log("Expected Case ID:", expectedCaseId);

  // 2. Party 1 adds evidence
  console.log("\n--- Step 2: Party 1 adds evidence ---");
  const ev1 = "Alice Corp provided audited system logs and repository commit history proving Alice completed all software deliverables with zero critical defects.";
  const addEv1TxHash = await client1.writeContract({
    address: contractAddress,
    functionName: 'add_evidence',
    args: [expectedCaseId, ev1],
  });
  console.log("Party 1 add_evidence Tx Hash:", addEv1TxHash);
  const ev1Receipt = await client1.waitForTransactionReceipt({
    hash: addEv1TxHash,
    retries: 120,
    interval: 3000,
  });
  console.log("Party 1 add_evidence Status:", ev1Receipt.status_name);

  // 3. Party 2 adds evidence
  console.log("\n--- Step 3: Party 2 adds evidence ---");
  const ev2 = "Bob Dev explicitly admits in written correspondence: Alice Corp successfully completed all software deliverables on schedule and complied with specifications.";
  const addEv2TxHash = await client2.writeContract({
    address: contractAddress,
    functionName: 'add_evidence',
    args: [expectedCaseId, ev2],
  });
  console.log("Party 2 add_evidence Tx Hash:", addEv2TxHash);
  const ev2Receipt = await client2.waitForTransactionReceipt({
    hash: addEv2TxHash,
    retries: 120,
    interval: 3000,
  });
  console.log("Party 2 add_evidence Status:", ev2Receipt.status_name);

  // 4. judge (live validator consensus)
  console.log("\n--- Step 4: judge (live validator consensus) ---");
  const judgeStart = Date.now();
  const judgeTxHash = await client1.writeContract({
    address: contractAddress,
    functionName: 'judge',
    args: [expectedCaseId],
  });
  console.log("judge Tx Hash:", judgeTxHash);

  const judgeReceipt = await client1.waitForTransactionReceipt({
    hash: judgeTxHash,
    retries: 120,
    interval: 3000,
  });
  const durationSec = ((Date.now() - judgeStart) / 1000).toFixed(2);
  console.log(`judge completed in ${durationSec}s`);
  console.log("judge Receipt Status:", judgeReceipt.status_name);
  console.log("judge Receipt Result:", judgeReceipt.result_name);

  const leaderExecutionResult =
    judgeReceipt.consensus_data?.leader_receipt?.[0]?.execution_result ||
    judgeReceipt.result_name;
  console.log("Leader Execution Result:", leaderExecutionResult);

  // 5. Read back final case state
  const finalCaseJson = await client1.readContract({
    address: contractAddress,
    functionName: 'get_case',
    args: [expectedCaseId],
  });
  console.log("\n--- Final Case Readback ---");
  console.log(finalCaseJson);

  const out = {
    contractAddress,
    deployTxHash,
    openTxHash,
    addEv1TxHash,
    addEv2TxHash,
    judgeTxHash,
    judgeDurationSec: durationSec,
    caseId: expectedCaseId,
    judgeReceiptStatus: judgeReceipt.status_name,
    judgeReceiptResult: judgeReceipt.result_name,
    leaderExecutionResult: leaderExecutionResult,
    finalCase: JSON.parse(finalCaseJson),
    rawJudgeReceipt: judgeReceipt,
  };

  const outDir = path.dirname(__filename);
  fs.writeFileSync(path.join(outDir, 'core_output.json'), JSON.stringify(out, null, 2));
  console.log("\nSaved core deployment output to scripts/deploy/core_output.json");
}

main().catch(err => {
  console.error("Core deployment error:", err);
  process.exit(1);
});
