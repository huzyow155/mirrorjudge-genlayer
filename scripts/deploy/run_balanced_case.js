const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const { createClient, chains, createAccount } = require('genlayer-js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

async function main() {
  const party1Account = createAccount();
  const party2Account = createAccount();
  const client1 = createClient({ chain: chains.studionet, account: party1Account });
  const client2 = createClient({ chain: chains.studionet, account: party2Account });

  const deployments = JSON.parse(fs.readFileSync(path.join(__dirname, 'live_evidence.json'), 'utf8'));
  const contractAddress = deployments.contractAddress;

  const title = "Balanced Shared Performance Dispute";
  const criteria = [
    {
      id: "part_a_delivery",
      text: "Which party completed Component A deliverables: PARTY_1 or PARTY_2?",
      weight_bp: 5000,
    },
    {
      id: "part_b_delivery",
      text: "Which party completed Component B deliverables: PARTY_1 or PARTY_2?",
      weight_bp: 5000,
    },
  ];
  const criteriaJson = JSON.stringify(criteria);
  const aliases1 = "Alice, Alice Corp";
  const aliases2 = "Bob, Bob Dev";

  const openTx = await client1.writeContract({
    address: contractAddress,
    functionName: 'open_case',
    args: [title, criteriaJson, aliases1, aliases2, party2Account.address],
  });
  console.log("open_case Tx:", openTx);
  await client1.waitForTransactionReceipt({ hash: openTx, retries: 120, interval: 3000 });

  const caseId = crypto.createHash('sha256').update(`${party1Account.address}|${title}|${criteriaJson}`).digest('hex').slice(0, 12);
  console.log("Case ID:", caseId);

  const ev1 = "Alice Corp provided git commits proving Alice completed all Component A deliverables with passing unit tests.";
  const ev1Tx = await client1.writeContract({ address: contractAddress, functionName: 'add_evidence', args: [caseId, ev1] });
  await client1.waitForTransactionReceipt({ hash: ev1Tx, retries: 120, interval: 3000 });

  const ev2 = "Bob Dev provided git commits proving Bob completed all Component B deliverables with passing unit tests.";
  const ev2Tx = await client2.writeContract({ address: contractAddress, functionName: 'add_evidence', args: [caseId, ev2] });
  await client2.waitForTransactionReceipt({ hash: ev2Tx, retries: 120, interval: 3000 });

  console.log("Judging Case...");
  const judgeStart = Date.now();
  const judgeTx = await client1.writeContract({ address: contractAddress, functionName: 'judge', args: [caseId] });
  console.log("judge Tx:", judgeTx);
  const judgeReceipt = await client1.waitForTransactionReceipt({ hash: judgeTx, retries: 120, interval: 3000 });
  const latency = ((Date.now() - judgeStart) / 1000).toFixed(2);
  console.log(`judge completed in ${latency}s`);
  console.log("Status:", judgeReceipt.status_name);
  console.log("Result:", judgeReceipt.result_name);

  const cert = await client1.readContract({ address: contractAddress, functionName: 'get_certificate', args: [caseId] });
  console.log("Certificate:\n", cert);

  deployments.balancedCase = {
    caseId,
    openTx,
    ev1Tx,
    ev2Tx,
    judgeTx,
    judgeLatencySec: latency,
    receiptStatus: judgeReceipt.status_name,
    receiptResult: judgeReceipt.result_name,
    certificate: JSON.parse(cert),
  };
  fs.writeFileSync(path.join(__dirname, 'live_evidence.json'), JSON.stringify(deployments, null, 2));
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
