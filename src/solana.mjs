import { Buffer } from "buffer";
import bs58 from "bs58";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
  unpackAccount,
} from "@solana/spl-token";
import { ComputeBudgetProgram, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";

export const DEVNET_RPC = "https://api.devnet.solana.com";
export const DEVNET_GENESIS = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
export const DEFAULT_PROGRAM_ID = "EUBa3ZVZamiD8c18cPmfohEWnpTkeo9ZpSfB2kT7gNTs";

const encoder = new TextEncoder();
const commitment = "confirmed";

function derive(programId, seed, key) {
  return PublicKey.findProgramAddressSync([encoder.encode(seed), key.toBytes()], programId)[0];
}

export function poolAddresses(programId, owner) {
  const pool = derive(programId, "pool", owner);
  const mintA = derive(programId, "mint-a", pool);
  const mintB = derive(programId, "mint-b", pool);
  return {
    owner, pool, mintA, mintB,
    vaultA: getAssociatedTokenAddressSync(mintA, pool, true),
    vaultB: getAssociatedTokenAddressSync(mintB, pool, true),
    walletA: getAssociatedTokenAddressSync(mintA, owner),
    walletB: getAssociatedTokenAddressSync(mintB, owner),
  };
}

function account(pubkey, isWritable = false, isSigner = false) {
  return { pubkey, isWritable, isSigner };
}

async function discriminator(instruction) {
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(`global:${instruction}`));
  return Buffer.from(hash, 0, 8);
}

export async function initializeInstructions(programId, addresses) {
  const { owner, pool, mintA, mintB, vaultA, vaultB, walletA, walletB } = addresses;
  const init = new TransactionInstruction({
    programId,
    keys: [
      account(owner, true, true), account(pool, true),
      account(mintA, true), account(mintB, true), account(vaultA, true), account(vaultB, true),
      account(walletA, true), account(walletB, true), account(TOKEN_PROGRAM_ID),
      account(ASSOCIATED_TOKEN_PROGRAM_ID), account(SystemProgram.programId),
    ],
    data: await discriminator("initialize_pool"),
  });
  return [ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }), init];
}

export async function swapInstructions(programId, addresses, aToB, amountIn, minimumOut, { createOutputAccount = true } = {}) {
  const { owner, pool, mintA, mintB, vaultA, vaultB, walletA, walletB } = addresses;
  const data = Buffer.alloc(25);
  (await discriminator("swap")).copy(data);
  data.writeUInt8(Number(aToB), 8);
  data.writeBigUInt64LE(amountIn, 9);
  data.writeBigUInt64LE(minimumOut, 17);
  const swap = new TransactionInstruction({
    programId,
    keys: [
      account(owner, true, true), account(pool),
      account(mintA), account(mintB), account(vaultA, true), account(vaultB, true),
      account(walletA, true), account(walletB, true), account(TOKEN_PROGRAM_ID),
    ],
    data,
  });
  const ensureOutputAccount = createAssociatedTokenAccountIdempotentInstruction(
    owner, aToB ? walletB : walletA, owner, aToB ? mintB : mintA,
  );
  return createOutputAccount ? [ensureOutputAccount, swap] : [swap];
}

export async function checkDevnet(connection, programId) {
  const [genesis, program] = await Promise.all([
    connection.getGenesisHash(),
    connection.getAccountInfo(programId, commitment),
  ]);
  if (genesis !== DEVNET_GENESIS) throw new Error("Solana Devnet RPC 주소인지 확인해 주세요.");
  return Boolean(program?.executable);
}

export async function readPool(connection, programId, addresses) {
  const { owner, pool, vaultA, vaultB, walletA, walletB } = addresses;
  const [balances, sol] = await Promise.all([
    connection.getMultipleAccountsInfo([pool, vaultA, vaultB, walletA, walletB], commitment),
    connection.getBalance(owner, commitment),
  ]);
  const [poolAccount, vaultAccountA, vaultAccountB, walletAccountA, walletAccountB] = balances;
  if (!poolAccount) return { sol, pool: null };
  if (!poolAccount.owner.equals(programId)) throw new Error("데모 풀의 소유 프로그램이 일치하지 않습니다.");
  return {
    sol,
    pool: {
      reserveA: unpackAccount(vaultA, vaultAccountA).amount,
      reserveB: unpackAccount(vaultB, vaultAccountB).amount,
      balanceA: walletAccountA ? unpackAccount(walletA, walletAccountA).amount : 0n,
      balanceB: walletAccountB ? unpackAccount(walletB, walletAccountB).amount : 0n,
    },
  };
}

async function draftTransaction(connection, owner, instructions) {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash(commitment);
  const draft = new Transaction({ feePayer: owner, blockhash, lastValidBlockHeight }).add(...instructions);
  return { draft, blockhash, lastValidBlockHeight };
}

const MAX_COMPUTE_UNIT_LIMIT = 1_400_000;

function computeBudgetValue(instruction) {
  if (!instruction.programId.equals(ComputeBudgetProgram.programId)) return null;
  const data = Buffer.from(instruction.data);
  if (data.length === 5 && data.readUInt8(0) === 2) {
    return { type: "limit", value: data.readUInt32LE(1) };
  }
  if (data.length === 9 && data.readUInt8(0) === 3) {
    return { type: "price", value: data.readBigUInt64LE(1) };
  }
  return { type: "unsupported" };
}

function splitInstructions(instructions) {
  const programInstructions = [];
  const computeBudget = { limit: [], price: [], unsupported: [] };
  for (const instruction of instructions) {
    const value = computeBudgetValue(instruction);
    if (!value) {
      programInstructions.push(instruction);
    } else {
      computeBudget[value.type].push(value.value ?? null);
    }
  }
  return { programInstructions, computeBudget };
}

function validateComputeBudgetChanges(original, signed, simulatedUnits) {
  const expected = splitInstructions(original).computeBudget;
  const actual = splitInstructions(signed).computeBudget;
  if (expected.unsupported.length || actual.unsupported.length) {
    throw new Error("Phantom에서 지원하지 않는 Compute Budget 명령을 추가하거나 변경해 거래를 중단했습니다.");
  }
  for (const type of ["limit", "price"]) {
    if (expected[type].length > 1 || actual[type].length > 1) {
      throw new Error(`Phantom이 Compute Budget ${type} 명령을 여러 개 넣어 거래를 중단했습니다.`);
    }
    if (expected[type].length && (actual[type].length !== 1 || actual[type][0] !== expected[type][0])) {
      throw new Error(`Phantom이 앱에서 설정한 Compute Budget ${type} 값을 바꾸어 거래를 중단했습니다.`);
    }
  }

  const limit = actual.limit[0] ?? 200_000;
  if (limit < 1 || limit > MAX_COMPUTE_UNIT_LIMIT) {
    throw new Error("Phantom이 허용 범위를 벗어난 Compute Unit 한도를 넣어 거래를 중단했습니다.");
  }
  if (simulatedUnits !== undefined && limit < simulatedUnits) {
    throw new Error("Phantom이 시뮬레이션에 필요한 Compute Unit보다 낮은 한도를 넣어 거래를 중단했습니다.");
  }
  const microLamportsPerUnit = actual.price[0] ?? 0n;
  const priorityFeeLamports = (microLamportsPerUnit * BigInt(limit) + 999_999n) / 1_000_000n;
  if (priorityFeeLamports > 500_000n) {
    throw new Error("Phantom 우선 수수료가 0.0005 SOL을 넘어 거래를 제출하지 않았습니다.");
  }
  return priorityFeeLamports;
}

function sameInstruction(left, right) {
  return left.programId.equals(right.programId)
    && Buffer.from(left.data).equals(Buffer.from(right.data))
    && left.keys.length === right.keys.length
    && left.keys.every((key, index) => key.pubkey.equals(right.keys[index].pubkey)
      && key.isSigner === right.keys[index].isSigner
      && key.isWritable === right.keys[index].isWritable);
}

async function signDraft(provider, owner, instructions, draft, blockhash, simulatedUnits) {
  let signed;
  try {
    signed = await provider.signTransaction(draft);
  } catch (error) {
    if (error?.code === 4001 || /user rejected|user denied/i.test(String(error?.message ?? ""))) throw error;
    const wrapped = new Error(`Phantom signing failed: ${String(error?.message ?? error)}`);
    wrapped.name = "PhantomSignError";
    wrapped.cause = error;
    throw wrapped;
  }
  if (!signed || !Array.isArray(signed.instructions)) {
    throw new Error("Phantom에서 서명된 거래 내용을 확인하지 못했습니다.");
  }
  const expectedSigner = signed?.signatures?.find(entry => entry.publicKey.equals(owner))?.signature;
  if (!expectedSigner) {
    throw new Error("Phantom에서 거래 서명을 확인하지 못했습니다.");
  }
  if (!signed.feePayer?.equals(owner)) {
    throw new Error("Phantom이 수수료 지갑을 바꾸어 거래를 중단했습니다.");
  }
  if (signed.recentBlockhash !== blockhash) {
    throw new Error("Phantom이 거래 blockhash를 바꾸어 거래를 중단했습니다.");
  }
  const original = splitInstructions(instructions);
  const actual = splitInstructions(signed.instructions);
  let mismatchIndex = original.programInstructions.findIndex((instruction, index) => !sameInstruction(instruction, actual.programInstructions[index]));
  const instructionsMatch = mismatchIndex === -1 && actual.programInstructions.length === original.programInstructions.length;
  if (!instructionsMatch) {
    if (mismatchIndex === -1) mismatchIndex = Math.min(original.programInstructions.length, actual.programInstructions.length);
    const instructionSummary = instruction => instruction
      ? `${instruction.programId.toBase58().slice(0, 8)}… (${instruction.keys.length}계정/${instruction.data.length}바이트)`
      : "누락";
    const expected = original.programInstructions[mismatchIndex];
    const received = actual.programInstructions[mismatchIndex];
    throw new Error(`Phantom 거래 검증 중 명령 ${mismatchIndex + 1}이 달라 제출을 막았습니다: ${instructionSummary(expected)} → ${instructionSummary(received)}.`);
  }
  const priorityFeeLamports = validateComputeBudgetChanges(instructions, signed.instructions, simulatedUnits);
  return { raw: signed.serialize(), signature: bs58.encode(expectedSigner), priorityFeeLamports };
}

async function blockhashStillValid(connection, blockhash, lastValidBlockHeight) {
  const [validity, blockHeight] = await Promise.all([
    connection.isBlockhashValid(blockhash, commitment),
    connection.getBlockHeight(commitment),
  ]);
  return validity.value || blockHeight <= lastValidBlockHeight;
}

export async function signWithPhantom(connection, provider, owner, instructions) {
  return prepareWithPhantom(connection, provider, owner, instructions);
}

function withComputeUnitLimit(instructions, units) {
  const withoutLimit = instructions.filter(instruction => computeBudgetValue(instruction)?.type !== "limit");
  return [ComputeBudgetProgram.setComputeUnitLimit({ units }), ...withoutLimit];
}

export async function prepareWithPhantom(connection, provider, owner, instructions) {
  const configuredBudget = splitInstructions(instructions).computeBudget;
  if (configuredBudget.unsupported.length || configuredBudget.limit.length > 1 || configuredBudget.price.length > 1) {
    throw new Error("거래에 지원하지 않는 Compute Budget 설정이 있어 제출을 중단했습니다.");
  }

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash(commitment);
  const simulationInstructions = withComputeUnitLimit(instructions, MAX_COMPUTE_UNIT_LIMIT);
  const simulationDraft = new Transaction({ feePayer: owner, blockhash, lastValidBlockHeight }).add(...simulationInstructions);
  const simulation = await connection.simulateTransaction(simulationDraft, undefined, [owner]);
  if (simulation.value.err) {
    const logs = simulation.value.logs?.slice(-4).join(" · ") ?? "";
    throw new Error(`Devnet 사전 시뮬레이션 실패: ${logs || JSON.stringify(simulation.value.err)}`);
  }
  const simulatedUnits = simulation.value.unitsConsumed;
  if (!Number.isSafeInteger(simulatedUnits) || simulatedUnits < 0) {
    throw new Error("Devnet 시뮬레이션에서 Compute Unit 사용량을 확인하지 못했습니다.");
  }
  const requestedUnits = Math.ceil(simulatedUnits * 1.1);
  if (requestedUnits > MAX_COMPUTE_UNIT_LIMIT) {
    throw new Error("거래가 Solana의 최대 Compute Unit 한도에 10% 여유를 더한 범위를 넘어 제출을 중단했습니다.");
  }

  const finalInstructions = withComputeUnitLimit(instructions, Math.max(1, requestedUnits));
  const draft = new Transaction({ feePayer: owner, blockhash, lastValidBlockHeight }).add(...finalInstructions);
  const signed = await signDraft(
    provider, owner, finalInstructions, draft, blockhash, simulatedUnits,
  );
  if (!await blockhashStillValid(connection, blockhash, lastValidBlockHeight)) {
    const error = new Error("승인 중 Devnet blockhash가 실제로 만료되어 거래를 보내지 않았습니다. 새 승인 요청이 필요합니다.");
    error.code = "BLOCKHASH_EXPIRED";
    throw error;
  }
  return { ...signed, blockhash, lastValidBlockHeight, computeUnitLimit: Math.max(1, requestedUnits) };
}

export async function sendPreparedTransaction(connection, prepared) {
  const { raw, signature, blockhash, lastValidBlockHeight, priorityFeeLamports, computeUnitLimit } = prepared;
  try {
    const sentSignature = await connection.sendRawTransaction(raw, {
      preflightCommitment: commitment,
      maxRetries: 3,
    });
    if (sentSignature !== signature) throw new Error("Devnet RPC가 서명된 거래와 다른 서명을 반환했습니다.");
    return { signature, lastValidBlockHeight, priorityFeeLamports, computeUnitLimit };
  } catch (error) {
    if (!/blockhash not found/i.test(String(error?.message ?? error))) throw error;
    if (!await blockhashStillValid(connection, blockhash, lastValidBlockHeight)) {
      const expired = new Error(`Devnet RPC가 만료된 blockhash를 거절했습니다. ${String(error?.message ?? error)}`);
      expired.code = "BLOCKHASH_EXPIRED";
      expired.cause = error;
      throw expired;
    }
    try {
      // The exact app-built transaction was already simulated. Retry these same signed bytes
      // only when the RPC's preflight disagrees with its own blockhash-validity response.
      const sentSignature = await connection.sendRawTransaction(raw, {
        skipPreflight: true,
        maxRetries: 3,
      });
      if (sentSignature !== signature) throw new Error("Devnet RPC가 서명된 거래와 다른 서명을 반환했습니다.");
      return { signature, lastValidBlockHeight, priorityFeeLamports, computeUnitLimit };
    } catch (retryError) {
      const statusResponse = await connection.getSignatureStatuses([signature], { searchTransactionHistory: true });
      const [status] = statusResponse.value;
      if (status) {
        return { signature, lastValidBlockHeight, priorityFeeLamports, computeUnitLimit };
      }
      const rejected = new Error(`Devnet RPC가 유효한 blockhash 거래를 재전송에서도 거절했습니다. ${String(retryError?.message ?? retryError)}`);
      rejected.code = "RPC_BLOCKHASH_REJECTED";
      rejected.cause = retryError;
      throw rejected;
    }
  }
}

export async function sendWithPhantom(connection, provider, owner, instructions) {
  const prepared = await prepareWithPhantom(connection, provider, owner, instructions);
  return sendPreparedTransaction(connection, prepared);
}

export async function readTransactionStatus(connection, signature, lastValidBlockHeight) {
  const response = await connection.getSignatureStatuses([signature], { searchTransactionHistory: true });
  const [status] = response.value;
  if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") {
    return status.err ? { status: "failed", error: status.err } : { status: "confirmed" };
  }
  if (!status && await connection.getBlockHeight(commitment) > lastValidBlockHeight) {
    return { status: "expired" };
  }
  return { status: "pending" };
}

export async function readSwapOutput(connection, signature, outputAccount) {
  const transaction = await connection.getTransaction(signature, {
    commitment, maxSupportedTransactionVersion: 0,
  });
  if (!transaction?.meta || transaction.meta.err) return null;
  const keys = transaction.transaction.message.getAccountKeys();
  const balance = entry => keys.get(entry.accountIndex)?.equals(outputAccount);
  const post = transaction.meta.postTokenBalances?.find(balance);
  if (!post) return null;
  const pre = transaction.meta.preTokenBalances?.find(balance);
  const received = BigInt(post.uiTokenAmount.amount) - BigInt(pre?.uiTokenAmount.amount ?? 0);
  return received > 0n ? received : null;
}
