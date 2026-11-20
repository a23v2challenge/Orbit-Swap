import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { setTimeout as wait } from "node:timers/promises";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { getMint } from "@solana/spl-token";
import { calculateQuote, INITIAL_RESERVE, PRACTICE_BALANCE, TOKEN_UNIT } from "../src/quote.mjs";
import {
  checkDevnet, DEFAULT_PROGRAM_ID, DEVNET_RPC, initializeInstructions, poolAddresses, readPool,
  readSwapOutput, readTransactionStatus, signWithPhantom, swapInstructions,
} from "../src/solana.mjs";

const [rpc, payerPath, programAddress = DEFAULT_PROGRAM_ID] = process.argv.slice(2);
const isLocal = /^http:\/\/(127\.0\.0\.1|localhost):\d+\/?$/.test(rpc ?? "");
assert.ok(isLocal || rpc === DEVNET_RPC, "로컬 검증기 또는 공식 Solana Devnet RPC를 지정하세요.");
const payer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(await readFile(payerPath, "utf8"))));
const connection = new Connection(rpc, { commitment: "confirmed", disableRetryOnRateLimit: true });
const programId = new PublicKey(programAddress);
if (!isLocal) assert.equal(await checkDevnet(connection, programId), true);
assert.ok((await connection.getAccountInfo(programId))?.executable, "실행 가능한 프로그램 계정이 필요합니다.");
const trader = Keypair.generate();
const addresses = poolAddresses(programId, trader.publicKey);

await sendAndConfirmTransaction(
  connection,
  new Transaction().add(SystemProgram.transfer({
    fromPubkey: payer.publicKey,
    toPubkey: trader.publicKey,
    lamports: 30_000_000,
  })),
  [payer],
  { commitment: "confirmed" },
);

const signer = {
  signTransaction(transaction) {
    transaction.partialSign(trader);
    return transaction;
  },
};

async function transact(instructions, skipPreflight = false) {
  const { raw, signature, lastValidBlockHeight } = await signWithPhantom(connection, signer, trader.publicKey, instructions);
  assert.equal(await connection.sendRawTransaction(raw, { skipPreflight, preflightCommitment: "confirmed" }), signature);
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const result = await readTransactionStatus(connection, signature, lastValidBlockHeight);
    if (result.status !== "pending") return { signature, ...result };
    await wait(800);
  }
  throw new Error(`거래 확인 시간 초과 ${signature}`);
}

async function readEvent(signature) {
  const eventHash = Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode("event:SwapExecuted"))).subarray(0, 8);
  const transaction = await connection.getTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
  const event = transaction?.meta?.logMessages
    .filter(line => line.startsWith("Program data: "))
    .map(line => Buffer.from(line.slice(14), "base64"))
    .find(bytes => bytes.subarray(0, 8).equals(eventHash));
  assert.ok(event, "스왑 이벤트가 온체인 로그에 있어야 합니다.");
  assert.equal(event.length, 129);
  assert.ok(new PublicKey(event.subarray(8, 40)).equals(addresses.pool));
  assert.ok(new PublicKey(event.subarray(40, 72)).equals(trader.publicKey));
  return {
    direction: event.readUInt8(72),
    input: event.readBigUInt64LE(73),
    output: event.readBigUInt64LE(81),
    fee: event.readBigUInt64LE(89),
    beforeA: event.readBigUInt64LE(97),
    beforeB: event.readBigUInt64LE(105),
    afterA: event.readBigUInt64LE(113),
    afterB: event.readBigUInt64LE(121),
  };
}

const initialized = await transact(await initializeInstructions(programId, addresses));
assert.equal(initialized.status, "confirmed");
const { pool: before } = await readPool(connection, programId, addresses);
assert.deepEqual(before, {
  reserveA: INITIAL_RESERVE, reserveB: INITIAL_RESERVE,
  balanceA: PRACTICE_BALANCE, balanceB: PRACTICE_BALANCE,
});
for (const mint of [addresses.mintA, addresses.mintB]) {
  const details = await getMint(connection, mint, "confirmed");
  assert.equal(details.mintAuthority, null);
  assert.equal(details.supply, INITIAL_RESERVE + PRACTICE_BALANCE);
}

const forward = calculateQuote(TOKEN_UNIT, before.reserveA, before.reserveB);
const rejected = await transact(await swapInstructions(programId, addresses, true, TOKEN_UNIT, forward.amountOut + 1n), true);
assert.equal(rejected.status, "failed");
assert.ok(JSON.stringify(rejected.error).includes("6005"));
assert.deepEqual((await readPool(connection, programId, addresses)).pool, before);

const swapped = await transact(await swapInstructions(programId, addresses, true, TOKEN_UNIT, forward.minimumOut));
assert.equal(swapped.status, "confirmed");
assert.equal(await readSwapOutput(connection, swapped.signature, addresses.walletB), 996_006n);
const { pool: after } = await readPool(connection, programId, addresses);
assert.deepEqual(after, {
  reserveA: before.reserveA + TOKEN_UNIT,
  reserveB: before.reserveB - forward.amountOut,
  balanceA: before.balanceA - TOKEN_UNIT,
  balanceB: before.balanceB + forward.amountOut,
});
assert.deepEqual(await readEvent(swapped.signature), {
  direction: 1, input: TOKEN_UNIT, output: forward.amountOut, fee: forward.fee,
  beforeA: before.reserveA, beforeB: before.reserveB,
  afterA: after.reserveA, afterB: after.reserveB,
});

const reverse = calculateQuote(TOKEN_UNIT, after.reserveB, after.reserveA);
const swappedBack = await transact(await swapInstructions(programId, addresses, false, TOKEN_UNIT, reverse.minimumOut));
assert.equal(swappedBack.status, "confirmed");
assert.equal(await readSwapOutput(connection, swappedBack.signature, addresses.walletA), reverse.amountOut);
assert.deepEqual((await readPool(connection, programId, addresses)).pool, {
  reserveA: after.reserveA - reverse.amountOut,
  reserveB: after.reserveB + TOKEN_UNIT,
  balanceA: after.balanceA + reverse.amountOut,
  balanceB: after.balanceB - TOKEN_UNIT,
});

console.log(JSON.stringify({
  network: isLocal ? "local" : "devnet",
  pool: addresses.pool.toBase58(),
  initialize: initialized.signature,
  rejected: rejected.signature,
  aToB: swapped.signature,
  bToA: swappedBack.signature,
  receivedB: "0.996006",
  feeA: "0.003",
}));
