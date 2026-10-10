const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const { createClient, chains, createAccount } = require('genlayer-js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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
      // transient error, retry
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
  console.log("Party 1 (Opener):", party1Account.address);
  console.log("Party 2 (Opposing):", party2Account.address);

  const client1 = createClient({ chain: chains.studionet, account: party1Account });
  const client2 = createClient({ chain: chains.studionet, account: party2Account });

  const contractAddress = "0x1343C51732FD1002986Ed3f0Bb9D5C2105A6635D";
  console.log("Target MirrorJudge:", contractAddress);

  const title = "Cross-Border Escrow & SLA Addendum Attribution Dispute";
  const criteria = [
    {
      id: "latency_benchmark",
      text: "Which party substantiated compliance with the primary API latency benchmark and addendum: PARTY_1 or PARTY_2?",
      weight_bp: 5000,
    },
    {
      id: "settlement_attribution",
      text: "Which party is designated as the compliant operator under the joint audit addendum: PARTY_1 or PARTY_2?",
      weight_bp: 5000,
    },
  ];
  const criteriaJson = JSON.stringify(criteria);
  const aliases1 = "Meridian, Meridian Labs";
  const aliases2 = "Solstice, Solstice Digital";

  console.log("\n--- Opening Case (Attempt 1) ---");
  const openTx = await client1.writeContract({
    address: contractAddress,
    functionName: 'open_case',
    args: [title, criteriaJson, aliases1, aliases2, party2Account.address],
  });
  console.log("open_case Tx:", openTx);
  await safeWaitForReceipt(openTx);

  const caseId = crypto
    .createHash('sha256')
    .update(`${party1Account.address}|${title}|${criteriaJson}`)
    .digest('hex')
    .slice(0, 12);
  console.log("Computed Case ID:", caseId);

  const ev1 = "Joint Escrow Audit Log #882: Independent auditor confirms Meridian Labs met the baseline telemetry threshold, and the signed settlement addendum explicitly designates PARTY_1 as the compliant operator for both latency_benchmark and settlement_attribution.";
  const ev1Tx = await client1.writeContract({
    address: contractAddress,
    functionName: 'add_evidence',
    args: [caseId, ev1],
  });
  console.log("Party 1 add_evidence Tx:", ev1Tx);
  await safeWaitForReceipt(ev1Tx);

  const ev2 = "Joint Escrow Audit Log #882 Counter-Statement: Solstice Digital acknowledges the independent audit log and confirms the signed settlement addendum explicitly designates PARTY_1 as the compliant operator for both latency_benchmark and settlement_attribution.";
  const ev2Tx = await client2.writeContract({
    address: contractAddress,
    functionName: 'add_evidence',
    args: [caseId, ev2],
  });
  console.log("Party 2 add_evidence Tx:", ev2Tx);
  await safeWaitForReceipt(ev2Tx);

  console.log("\n--- Running judge() (Attempt 1) ---");
  const judgeStart = Date.now();
  const judgeTx = await client1.writeContract({
    address: contractAddress,
    functionName: 'judge',
    args: [caseId],
  });
  console.log("judge Tx:", judgeTx);
  const judgeReceipt = await safeWaitForReceipt(judgeTx);
  const judgeLatencySec = ((Date.now() - judgeStart) / 1000).toFixed(2);

  const certRaw = await client1.readContract({
    address: contractAddress,
    functionName: 'get_certificate',
    args: [caseId],
  });
  console.log("Raw Certificate:\n", certRaw);

  const caseRaw = await client1.readContract({
    address: contractAddress,
    functionName: 'get_case',
    args: [caseId],
  });
  console.log("Raw Case:\n", caseRaw);

  const cert = JSON.parse(certRaw);
  const attemptRecord = {
    attempt: 1,
    caseId,
    opener: party1Account.address,
    opposing: party2Account.address,
    openTx,
    ev1Tx,
    ev2Tx,
    judgeTx,
    judgeLatencySec,
    receiptStatus: judgeReceipt.status_name,
    receiptResult: judgeReceipt.result_name,
    leaderResult: judgeReceipt.consensus_data?.leader_receipt?.[0]?.execution_result || judgeReceipt.result_name,
    currentDecision: cert.current_decision,
    certificate: cert,
  };

  fs.writeFileSync(
    path.join(__dirname, 'unstable_attempts.json'),
    JSON.stringify([attemptRecord], null, 2)
  );
  console.log("Saved attempt 1 to scripts/deploy/unstable_attempts.json");
}

main().catch((err) => {
  console.error("Error in run_unstable_case.js:", err);
  process.exit(1);
});
