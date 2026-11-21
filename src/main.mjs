import { Connection, PublicKey } from "@solana/web3.js";
import { calculateQuote, formatAmount, INITIAL_RESERVE, parseAmount } from "./quote.mjs";
import {
  checkDevnet, DEFAULT_PROGRAM_ID, DEVNET_RPC, initializeInstructions, poolAddresses, prepareWithPhantom,
  readPool, readSwapOutput, readTransactionStatus, sendPreparedTransaction, swapInstructions,
} from "./solana.mjs";
import "./style.css";

const programId = new PublicKey(import.meta.env.VITE_ORBIT_PROGRAM_ID || DEFAULT_PROGRAM_ID);
const connection = new Connection(DEVNET_RPC, { commitment: "confirmed", disableRetryOnRateLimit: true });
const byId = id => document.getElementById(id);
const amountInput = byId("amount");
const modal = byId("confirmation");
const completionDialog = byId("completion-dialog");
const numberFormat = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 9 });
const state = {
  owner: null, verified: false, deployed: false, reading: false, networkError: false,
  snapshot: null, record: null, busy: "", requestId: 0, aToB: true, review: null,
};

let wallet;

function message(text = "", kind = "info") {
  const element = byId("message");
  element.hidden = !text;
  element.dataset.kind = kind;
  element.textContent = text;
}

function explain(error) {
  const candidateLogs = error?.logs ?? error?.data?.logs ?? error?.data?.data?.logs ?? [];
  const logs = Array.isArray(candidateLogs) ? candidateLogs.map(String) : candidateLogs ? [String(candidateLogs)] : [];
  const errorMessage = String(error?.message ?? "").replace(/\s+/g, " ").trim();
  const details = [errorMessage, ...logs].join(" ");
  if (error?.code === 4001 || /user rejected|user denied/i.test(details)) return "Phantom에서 요청을 취소했습니다.";
  if (error?.code === "PENDING_RECORD_STORAGE") {
    return "중복 거래를 막기 위한 기록을 저장하지 못해 제출하지 않았습니다. 브라우저 저장 공간을 확인한 뒤 다시 시도해 주세요.";
  }
  if (error?.code === "BLOCKHASH_EXPIRED") {
    return "승인하는 동안 Devnet blockhash가 실제로 만료되어 제출되지 않았습니다. 다시 요청한 뒤 Phantom에서 바로 승인해 주세요.";
  }
  if (error?.code === "RPC_BLOCKHASH_REJECTED") {
    return "앱의 Devnet 시뮬레이션은 통과했고 blockhash도 유효했지만, Devnet RPC가 제출을 거절했습니다. 아직 체인 반영을 확인하지 못했습니다. 상태를 다시 확인한 뒤 재시도할 수 있습니다.";
  }
  if (error?.name === "PhantomSignError" && /simulation failed|insufficient/i.test(details)) {
    return "앱의 Devnet 사전 시뮬레이션은 통과했지만 Phantom의 서명 단계에서 거래가 거절됐습니다. 제출 전 단계에서 멈췄으니 Phantom의 Solana Devnet 네트워크와 계정을 확인해 주세요.";
  }
  if (/blockhash not found|blockhash.*expired|block height exceeded/i.test(details)) {
    return "Devnet RPC가 거래의 blockhash를 찾지 못했습니다. 만료 여부를 확인하지 못해 원인을 단정할 수 없습니다. 체인 상태를 새로고침하고 다시 시도해 주세요.";
  }
  if (/not enough sol|insufficient sol|insufficient lamports|insufficient funds|insufficient.*rent/i.test(details)) {
    return "Devnet SOL 잔액이 거래 수수료 또는 계정 생성 비용에 부족합니다.";
  }
  if (/MinimumOutputNotMet|0x1775/i.test(details)) return "예상가가 변해 최소 수령량을 충족하지 못했습니다. 최신 견적을 확인해 주세요.";
  if (/InsufficientBalance|0x1774/i.test(details)) return "보내는 토큰의 잔액이 부족합니다.";
  if (/insufficient lamports|insufficient funds|insufficient.*rent/i.test(details)) return "거래에 필요한 Devnet SOL이 부족합니다.";
  if (/429|rate limit/i.test(details)) return "Devnet 요청이 많습니다. 잠시 후 다시 확인해 주세요.";
  if (/fetch|network|503/i.test(details)) return "Devnet에 연결할 수 없습니다. 잠시 후 새로고침해 주세요.";
  if (/[가-힣]/.test(errorMessage)) return errorMessage;
  const diagnostic = [...logs.slice(-3), errorMessage].filter(Boolean).join(" · ");
  if (diagnostic) return `거래 오류: ${diagnostic.slice(0, 240)}`;
  return "거래를 처리할 수 없습니다. Phantom에서 Solana Devnet과 선택한 계정을 확인해 주세요.";
}

function tokenName(isA) {
  return isA ? "Token A" : "Token B";
}

function updateToken(id, isA) {
  const token = byId(id);
  const [icon, label] = token.children;
  icon.textContent = isA ? "A" : "B";
  icon.className = `token-icon ${isA ? "a" : "b"}`;
  icon.setAttribute("aria-hidden", "true");
  label.textContent = tokenName(isA);
}

function currentQuote() {
  const amountIn = parseAmount(amountInput.value);
  const pool = state.snapshot?.pool;
  const reserveIn = (state.aToB ? pool?.reserveA : pool?.reserveB) ?? INITIAL_RESERVE;
  const reserveOut = (state.aToB ? pool?.reserveB : pool?.reserveA) ?? INITIAL_RESERVE;
  return { amountIn, quote: amountIn === null ? null : calculateQuote(amountIn, reserveIn, reserveOut) };
}

function renderReceipt() {
  const record = state.record;
  const activity = byId("activity");
  const statusLabel = byId("receipt-status");
  const recheck = byId("recheck");
  byId("activity-empty").hidden = Boolean(record);
  activity.hidden = !record;
  statusLabel.hidden = !record;
  if (!record) return;
  const { status, received, kind, aToB } = record;
  const labels = { pending: "확인 중", confirmed: "완료", failed: "실패", expired: "만료" };
  statusLabel.textContent = labels[status];
  statusLabel.dataset.state = status;
  let text = "Devnet에서 거래 결과를 확인하고 있습니다.";
  if (status === "confirmed") {
    text = kind === "pool"
      ? "데모 풀이 생성되었습니다."
      : received
        ? `스왑 완료! ${tokenName(!aToB)} ${formatAmount(BigInt(received))}개를 받았습니다.`
        : "스왑이 확인되었습니다. 실제 수령량 기록을 다시 조회할 수 있습니다.";
  }
  if (status === "failed") text = "거래가 실패했습니다. 서명을 열어 Devnet 기록을 확인할 수 있습니다.";
  if (status === "expired") text = "확인 시간이 지나 거래가 만료되었습니다. 최신 견적에서 다시 시작할 수 있습니다.";
  byId("receipt-text").textContent = text;
  const link = byId("transaction-link");
  link.href = `https://explorer.solana.com/tx/${record.signature}?cluster=devnet`;
  byId("signature").textContent = record.signature;
  recheck.hidden = status !== "pending" && !(status === "confirmed" && kind === "swap" && !received);
  recheck.disabled = Boolean(state.busy);
}

function showCompletion(record) {
  const heading = byId("completion-heading");
  const summary = byId("completion-summary");
  if (record.kind === "pool") {
    heading.textContent = "데모 풀이 생성됐어요";
    summary.textContent = "풀 생성 거래가 Solana Devnet에서 확인됐습니다.";
  } else {
    heading.textContent = "스왑이 완료됐어요";
    const sent = /^\d{1,20}$/.test(record.amountIn ?? "")
      ? `${formatAmount(BigInt(record.amountIn))} ${tokenName(record.aToB)}`
      : null;
    const received = /^\d{1,20}$/.test(record.received ?? "")
      ? `${formatAmount(BigInt(record.received))} ${tokenName(!record.aToB)}`
      : null;
    summary.textContent = sent && received
      ? `${sent} → ${received}`
      : received
        ? `실제 수령량 ${received}`
        : "스왑 거래가 Solana Devnet에서 확인됐습니다.";
  }
  byId("completion-signature").textContent = record.signature;
  byId("completion-explorer").href = `https://explorer.solana.com/tx/${record.signature}?cluster=devnet`;
  if (!completionDialog.open) completionDialog.showModal();
}

function render() {
  const { aToB, owner, snapshot, verified, deployed, reading, busy, record } = state;
  const pool = snapshot?.pool;
  const network = byId("network");
  network.dataset.state = verified ? "online" : state.networkError ? "error" : "waiting";
  network.textContent = verified ? "Devnet 연결됨" : state.networkError ? "Devnet 연결 오류" : "Devnet 확인 중";
  const walletButton = byId("wallet-button");
  const address = owner?.toBase58();
  walletButton.textContent = address ? `${address.slice(0, 4)}…${address.slice(-4)}` : busy === "wallet" ? "연결 중" : "Phantom 연결";
  walletButton.setAttribute("aria-label", address ? `Phantom 지갑 연결 해제 (${address})` : "Phantom 연결");
  walletButton.title = address ? "Phantom 연결 해제" : "";
  walletButton.disabled = Boolean(busy);

  updateToken("from-token", aToB);
  updateToken("to-token", !aToB);
  const balance = aToB ? pool?.balanceA : pool?.balanceB;
  const { amountIn, quote } = currentQuote();
  const exceedsBalance = balance !== undefined && amountIn !== null && amountIn > balance;
  byId("wallet-balance").textContent = balance === undefined ? "잔액 —" : `잔액 ${formatAmount(balance)}`;
  byId("receive").textContent = quote ? formatAmount(quote.amountOut) : "—";
  byId("fee").textContent = quote ? `0.30% · ${formatAmount(quote.fee)} ${tokenName(aToB)}` : "0.30%";
  byId("minimum").textContent = quote ? `${formatAmount(quote.minimumOut)} ${tokenName(!aToB)}` : "—";

  let hint = pool ? "Devnet 풀의 현재 잔액을 기준으로 계산했습니다." : "각각 1,000개가 든 초기 풀 기준입니다.";
  const hasInput = Boolean(amountInput.value.trim());
  if (hasInput && (amountIn === null || amountIn === 0n)) hint = "0보다 큰 수량을 소수점 6자리까지 입력해 주세요.";
  else if (hasInput && !quote) hint = "예상 수령량이 0보다 큰 수량을 입력해 주세요.";
  else if (exceedsBalance) hint = "보내는 토큰의 지갑 잔액을 초과했습니다.";
  amountInput.setAttribute("aria-invalid", String(hasInput && (!quote || exceedsBalance)));
  byId("quote-hint").textContent = hint;

  const canSend = verified && deployed && owner && snapshot && !reading && !busy && record?.status !== "pending";
  byId("review").disabled = !canSend || !pool || !quote || exceedsBalance || snapshot.sol === 0;
  byId("review").textContent = busy === "swap" ? "거래 확인 중" : "거래 내용 확인";
  byId("make-pool").disabled = !canSend || Boolean(pool) || snapshot.sol === 0;
  byId("make-pool").textContent = pool ? "데모 풀 생성 완료" : busy === "pool" ? "풀 생성 확인 중" : "데모 풀 만들기";
  byId("refresh").disabled = reading || Boolean(busy);
  byId("reserve-a").textContent = formatAmount(pool?.reserveA ?? INITIAL_RESERVE);
  byId("reserve-b").textContent = formatAmount(pool?.reserveB ?? INITIAL_RESERVE);
  byId("sol").textContent = `Devnet SOL ${snapshot ? numberFormat.format(snapshot.sol / 1_000_000_000) : "—"}`;
  byId("pool-hint").textContent = verified && !deployed
    ? "Devnet 프로그램 배포 대기 중입니다. 초기 풀 기준 견적은 확인할 수 있습니다."
    : pool
      ? "연결한 지갑의 풀에 보관된 토큰 수량입니다."
      : snapshot?.sol === 0
        ? "데모 풀을 만들려면 지갑에 테스트 SOL을 받은 뒤 새로고침하세요."
        : "풀을 만들면 각 토큰 1,000개를 풀에 넣고 지갑에 연습용 토큰을 100개씩 지급합니다.";
  byId("approve").disabled = !canSend;
  renderReceipt();
}

function storageKey(owner) {
  return `orbit-swap:${programId.toBase58()}:${owner.toBase58()}`;
}

function loadRecord(owner) {
  try {
    const data = JSON.parse(localStorage.getItem(storageKey(owner)));
    if (!data || !/^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(data.signature)
      || !Number.isSafeInteger(data.lastValidBlockHeight)
      || !["pending", "confirmed", "failed", "expired"].includes(data.status)
      || !["pool", "swap"].includes(data.kind)
      || typeof data.aToB !== "boolean") return null;
    if (typeof data.amountIn !== "string" || !/^\d{1,20}$/.test(data.amountIn)) delete data.amountIn;
    if (typeof data.received !== "string" || !/^\d{1,20}$/.test(data.received)) delete data.received;
    return data;
  } catch {
    return null;
  }
}

function saveRecord(owner, record) {
  try {
    localStorage.setItem(storageKey(owner), JSON.stringify(record));
  } catch {
    return false;
  }
  if (state.owner?.equals(owner)) state.record = record;
  return true;
}

async function refresh() {
  const requestId = ++state.requestId;
  const owner = state.owner;
  state.reading = true;
  render();
  try {
    const deployed = await checkDevnet(connection, programId);
    if (requestId !== state.requestId) return;
    state.verified = true;
    state.deployed = deployed;
    state.networkError = false;
    const snapshot = owner ? await readPool(connection, programId, poolAddresses(programId, owner)) : null;
    if (requestId === state.requestId) state.snapshot = snapshot;
  } catch (error) {
    if (requestId !== state.requestId) return;
    state.verified = false;
    state.networkError = true;
    message(explain(error), "error");
  } finally {
    if (requestId === state.requestId) {
      state.reading = false;
      render();
    }
  }
}

function setOwner(publicKey) {
  const owner = publicKey ? new PublicKey(publicKey.toString()) : null;
  if (owner?.toBase58() === state.owner?.toBase58()) return;
  state.owner = owner;
  state.snapshot = null;
  state.record = owner ? loadRecord(owner) : null;
  state.review = null;
  if (modal.open) modal.close();
  message();
  refresh();
}

async function toggleWallet() {
  const provider = window.phantom?.solana;
  if (!provider?.isPhantom) {
    message("Phantom 확장 프로그램이 설치된 브라우저에서 페이지를 열어 주세요.", "error");
    return;
  }
  if (!wallet) {
    wallet = provider;
    wallet.on("accountChanged", setOwner);
    wallet.on("disconnect", () => setOwner(null));
  }
  state.busy = "wallet";
  render();
  try {
    if (state.owner) {
      await wallet.disconnect();
      setOwner(null);
    } else {
      const result = await wallet.connect();
      setOwner(result.publicKey);
    }
  } catch (error) {
    message(explain(error), "error");
  } finally {
    state.busy = "";
    render();
  }
}

function wait(delay) {
  return new Promise(resolve => setTimeout(resolve, delay));
}

async function settle(owner, addresses, record, attempts) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (!state.owner?.equals(owner)) return;
    try {
      if (record.status === "pending") {
        const { status } = await readTransactionStatus(connection, record.signature, record.lastValidBlockHeight);
        record.status = status;
        saveRecord(owner, record);
      }
      if (record.status === "confirmed" && record.kind === "swap" && !record.received) {
        const outputAccount = record.aToB ? addresses.walletB : addresses.walletA;
        const received = await readSwapOutput(connection, record.signature, outputAccount);
        if (received) {
          record.received = received.toString();
          saveRecord(owner, record);
        }
      }
      if (record.status !== "pending" && (record.status !== "confirmed" || record.kind === "pool" || record.received)) break;
    } catch (error) {
      if (attempt === attempts - 1) message(explain(error), "error");
    }
    if (attempt < attempts - 1) await wait(1300);
  }
}

async function submit(kind, reviewedTrade) {
  const owner = state.owner;
  if (!owner || !wallet || !state.verified || !state.deployed || state.busy || state.record?.status === "pending") return;
  if (kind === "swap" && !reviewedTrade?.owner.equals(owner)) return;
  const addresses = poolAddresses(programId, owner);
  state.busy = kind;
  render();
  message("Phantom에서 거래 내용을 확인한 뒤 바로 승인해 주세요. 오래 기다리면 거래가 만료되어 다시 요청해야 합니다.");
  let persistedRecord = null;
  try {
    const deployed = await checkDevnet(connection, programId);
    if (!deployed) throw new Error("Orbit Swap 프로그램이 Devnet에서 확인되지 않습니다.");
    let instructions;
    if (kind === "pool") {
      instructions = await initializeInstructions(programId, addresses);
    } else {
      const outputAccount = reviewedTrade.aToB ? addresses.walletB : addresses.walletA;
      const outputAccountExists = await connection.getAccountInfo(outputAccount, "confirmed");
      instructions = await swapInstructions(
        programId, addresses, reviewedTrade.aToB, reviewedTrade.amountIn, reviewedTrade.quote.minimumOut,
        { createOutputAccount: !outputAccountExists },
      );
    }
    const prepared = await prepareWithPhantom(connection, wallet, owner, instructions);
    if (!state.owner?.equals(owner) || !wallet.publicKey?.equals(owner)) {
      throw new Error("지갑 계정이 바뀌어 거래를 전송하지 않았습니다.");
    }
    const record = {
      signature: prepared.signature,
      lastValidBlockHeight: prepared.lastValidBlockHeight,
      kind,
      status: "pending",
      aToB: reviewedTrade?.aToB ?? true,
      amountIn: kind === "swap" ? reviewedTrade.amountIn.toString() : null,
    };
    if (!saveRecord(owner, record)) {
      const error = new Error("중복 제출 방지를 위한 거래 기록을 저장하지 못했습니다.");
      error.code = "PENDING_RECORD_STORAGE";
      throw error;
    }
    persistedRecord = record;
    message("서명된 거래의 확인 정보를 저장하고 Devnet 제출 결과를 확인하고 있습니다.");
    render();

    let submissionError = null;
    try {
      await sendPreparedTransaction(connection, prepared);
    } catch (error) {
      submissionError = error;
      console.error("[Orbit Swap] transaction submission response uncertain", error);
    }

    await settle(owner, addresses, record, 10);
    await refresh();
    if (record.status === "confirmed") {
      message();
      showCompletion(record);
    } else if (record.status === "failed") {
      message("서명된 거래가 Devnet에서 실패한 것을 확인했습니다. 수수료가 발생했을 수 있습니다.", "error");
    } else if (record.status === "expired") {
      message("기존 거래의 만료를 확인했습니다. 최신 견적에서 다시 요청할 수 있습니다.");
    } else if (submissionError) {
      message("RPC에서 제출 결과를 확인하지 못했습니다. 아래 서명을 조회 중이며, 거래가 확인되거나 만료될 때까지 새 승인을 막습니다.", "error");
    }
  } catch (error) {
    console.error("[Orbit Swap] transaction failed", error);
    if (!persistedRecord) {
      message(explain(error), "error");
    } else if (persistedRecord.status === "pending") {
      message("거래 결과를 확인 중입니다. 기존 서명이 확정되거나 만료되기 전까지 새 승인을 막습니다.", "error");
    }
    await refresh();
  } finally {
    state.busy = "";
    render();
  }
}

function addReviewRow(label, value) {
  const row = document.createElement("div");
  const heading = document.createElement("dt");
  const detail = document.createElement("dd");
  heading.textContent = label;
  detail.textContent = value;
  row.append(heading, detail);
  byId("review-details").append(row);
}

byId("program-link").href = `https://explorer.solana.com/address/${programId.toBase58()}?cluster=devnet`;
byId("wallet-button").addEventListener("click", toggleWallet);
byId("refresh").addEventListener("click", () => {
  message();
  refresh();
});
amountInput.addEventListener("input", render);
byId("direction").addEventListener("click", () => {
  state.aToB = !state.aToB;
  render();
});
byId("make-pool").addEventListener("click", () => submit("pool"));
byId("swap-form").addEventListener("submit", event => {
  event.preventDefault();
  if (byId("review").disabled) return;
  const { quote, amountIn } = currentQuote();
  const { aToB, owner } = state;
  state.review = { quote, amountIn, aToB, owner };
  byId("review-details").replaceChildren();
  addReviewRow("보내는 수량", `${formatAmount(amountIn)} ${tokenName(aToB)}`);
  addReviewRow("예상 수령량", `${formatAmount(quote.amountOut)} ${tokenName(!aToB)}`);
  addReviewRow("스왑 수수료", `0.30% · ${formatAmount(quote.fee)} ${tokenName(aToB)}`);
  addReviewRow("슬리피지 한도", "0.50%");
  addReviewRow("최소 수령량", `${formatAmount(quote.minimumOut)} ${tokenName(!aToB)}`);
  modal.showModal();
});
byId("cancel-review").addEventListener("click", () => modal.close());
byId("dismiss-completion").addEventListener("click", () => completionDialog.close());
byId("approve").addEventListener("click", () => {
  const trade = state.review;
  modal.close();
  submit("swap", trade);
});
modal.addEventListener("close", () => {
  state.review = null;
});
byId("recheck").addEventListener("click", async () => {
  const { owner, record } = state;
  if (!owner || !record || state.busy) return;
  const alreadyReceived = record.status === "confirmed" && Boolean(record.received);
  state.busy = "check";
  message();
  render();
  try {
    await settle(owner, poolAddresses(programId, owner), record, 4);
    await refresh();
    if (record.status === "confirmed" && !alreadyReceived) showCompletion(record);
  } finally {
    state.busy = "";
    render();
  }
});

refresh();
