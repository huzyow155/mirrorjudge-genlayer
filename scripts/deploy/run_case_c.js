const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const { createClient, chains, createAccount } = require('genlayer-js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

async function main() {
  const party1Account = createAccount();
  const party2Account = createAccount();
  console.log("Party 1:", party1Account.address);
  console.log("Party 2:", party2Account.address);

  const client1 = createClient({ chain: chains.studionet, account: party1Account });
  const client2 = createClient({ chain: chains.studionet, account: party2Account });

  const deployments = JSON.parse(fs.readFileSync(path.join(__dirname, 'live_evidence.json'), 'utf8'));
  const contractAddress = deployments.contractAddress;
  console.log("MirrorJudge Address:", contractAddress);

  const titleC = "Cloud Server Infrastructure Uptime SLA Dispute";
  const criteriaC = [
    {
      id: "sla_uptime",
      text: "Which party substantiated superior server uptime and SLA compliance: PARTY_1 or PARTY_2?",
      weight_bp: 10000,
    },
  ];
  const criteriaJsonC = JSON.stringify(criteriaC);
  const aliases1C = "Eve, Eve Networks";
  const aliases2C = "Frank, Frank Systems";

  console.log("\n--- Step 1: open_case ---");
  const openTxC = await client1.writeContract({
    address: contractAddress,
    functionName: 'open_case',
    args: [titleC, criteriaJsonC, aliases1C, aliases2C, party2Account.address],
  });
  console.log("open_case Tx:", openTxC);
  await client1.waitForTransactionReceipt({ hash: openTxC, retries: 120, interval: 3000 });

  const caseIdC = crypto
    .createHash('sha256')
    .update(`${party1Account.address}|${titleC}|${criteriaJsonC}`)
    .digest('hex')
    .slice(0, 12);
  console.log("Case C ID:", caseIdC);

  // Round 1: Balanced symmetrical evidence competing for first position
  console.log("\n--- Step 2: Submitting symmetrical evidence for Round 1 ---");
  const ev1C = "Eve Networks provided server metrics proving Eve Networks achieved 99.95 percent uptime with zero critical incidents.";
  const ev1TxC = await client1.writeContract({
    address: contractAddress,
    functionName: 'add_evidence',
    args: [caseIdC, ev1C],
  });
  await client1.waitForTransactionReceipt({ hash: ev1TxC, retries: 120, interval: 3000 });
  console.log("Party 1 Ev1 Tx:", ev1TxC);

  const ev2C = "Frank Systems provided server metrics proving Frank Systems achieved 99.95 percent uptime with zero critical incidents.";
  const ev2TxC = await client2.writeContract({
    address: contractAddress,
    functionName: 'add_evidence',
    args: [caseIdC, ev2C],
  });
  await client2.waitForTransactionReceipt({ hash: ev2TxC, retries: 120, interval: 3000 });
  console.log("Party 2 Ev2 Tx:", ev2TxC);

  console.log("\n--- Step 3: Running judge() for Round 1 ---");
  const judgeStart1 = Date.now();
  const judgeTx1 = await client1.writeContract({
    address: contractAddress,
    functionName: 'judge',
    args: [caseIdC],
  });
  console.log("Round 1 judge Tx:", judgeTx1);
  const judgeReceipt1 = await client1.waitForTransactionReceipt({ hash: judgeTx1, retries: 120, interval: 3000 });
  const latency1 = ((Date.now() - judgeStart1) / 1000).toFixed(2);
  console.log(`Round 1 judge completed in ${latency1}s`);
  console.log("Round 1 Status:", judgeReceipt1.status_name);
  console.log("Round 1 Result:", judgeReceipt1.result_name);

  const cert1 = await client1.readContract({
    address: contractAddress,
    functionName: 'get_certificate',
    args: [caseIdC],
  });
  console.log("Certificate after Round 1:\n", cert1);

  // Round 2: Party 2 admits Party 1 had superior performance
  console.log("\n--- Step 4: Escalation - Adding decisive evidence for Round 2 ---");
  const ev3C = "Eve Networks submitted third-party audited SLA report confirming Eve Networks maintained 99.99 percent availability across all nodes.";
  const ev3TxC = await client1.writeContract({
    address: contractAddress,
    functionName: 'add_evidence',
    args: [caseIdC, ev3C],
  });
  await client1.waitForTransactionReceipt({ hash: ev3TxC, retries: 120, interval: 3000 });
  console.log("Party 1 Ev3 Tx:", ev3TxC);

  const ev4C = "Frank Systems explicitly admits: The audited SLA report is accurate and confirms Eve Networks maintained superior uptime and SLA compliance.";
  const ev4TxC = await client2.writeContract({
    address: contractAddress,
    functionName: 'add_evidence',
    args: [caseIdC, ev4C],
  });
  await client2.waitForTransactionReceipt({ hash: ev4TxC, retries: 120, interval: 3000 });
  console.log("Party 2 Ev4 Tx:", ev4TxC);

  console.log("\n--- Step 5: Running judge() for Round 2 ---");
  const judgeStart2 = Date.now();
  const judgeTx2 = await client1.writeContract({
    address: contractAddress,
    functionName: 'judge',
    args: [caseIdC],
  });
  console.log("Round 2 judge Tx:", judgeTx2);
  const judgeReceipt2 = await client1.waitForTransactionReceipt({ hash: judgeTx2, retries: 120, interval: 3000 });
  const latency2 = ((Date.now() - judgeStart2) / 1000).toFixed(2);
  console.log(`Round 2 judge completed in ${latency2}s`);
  console.log("Round 2 Status:", judgeReceipt2.status_name);
  console.log("Round 2 Result:", judgeReceipt2.result_name);

  const cert2 = await client1.readContract({
    address: contractAddress,
    functionName: 'get_certificate',
    args: [caseIdC],
  });
  console.log("Certificate after Round 2:\n", cert2);

  const parsedCert1 = JSON.parse(cert1);
  const parsedCert2 = JSON.parse(cert2);

  // Update live_evidence.json with Case C real data
  deployments.caseC = {
    caseId: caseIdC,
    openTx: openTxC,
    round1: {
      ev1Tx: ev1TxC,
      ev2Tx: ev2TxC,
      judgeTx: judgeTx1,
      judgeLatencySec: latency1,
      receiptStatus: judgeReceipt1.status_name,
      receiptResult: judgeReceipt1.result_name,
      leaderResult: judgeReceipt1.consensus_data?.leader_receipt?.[0]?.execution_result || judgeReceipt1.result_name,
      decision: parsedCert1.current_decision,
      certificate: parsedCert1,
    },
    round2: {
      ev3Tx: ev3TxC,
      ev4Tx: ev4TxC,
      judgeTx: judgeTx2,
      judgeLatencySec: latency2,
      receiptStatus: judgeReceipt2.status_name,
      receiptResult: judgeReceipt2.result_name,
      leaderResult: judgeReceipt2.consensus_data?.leader_receipt?.[0]?.execution_result || judgeReceipt2.result_name,
      decision: parsedCert2.current_decision,
      certificate: parsedCert2,
    },
  };

  fs.writeFileSync(path.join(__dirname, 'live_evidence.json'), JSON.stringify(deployments, null, 2));
  console.log("\nUpdated live_evidence.json with Case C rounds!");
}

main().catch(err => {
  console.error("Case C error:", err);
  process.exit(1);
});
