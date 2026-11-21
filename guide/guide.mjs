import { terms } from "./terms.mjs";
import "./theme.css";
import "./guide.css";

const dialog = document.createElement("dialog");
dialog.className = "orbit-guide-dialog";
dialog.setAttribute("aria-labelledby", "orbit-guide-title");
dialog.innerHTML = `
  <div class="orbit-guide-content">
    <h2 id="orbit-guide-title"></h2>
    <section class="orbit-guide-section">
      <h3>쉬운 뜻</h3>
      <p class="orbit-guide-meaning"></p>
    </section>
    <section class="orbit-guide-section orbit-guide-example">
      <h3>실제로 쓰이는 곳</h3>
      <p></p>
    </section>
    <div class="orbit-guide-actions">
      <a target="_blank" rel="noopener noreferrer">공식 문서에서 더 보기 <span aria-hidden="true">↗</span></a>
      <button type="button" class="secondary" autofocus>닫기</button>
    </div>
  </div>
`;
document.body.append(dialog);

const title = dialog.querySelector("h2");
const meaning = dialog.querySelector(".orbit-guide-meaning");
const example = dialog.querySelector(".orbit-guide-example p");
const source = dialog.querySelector("a");
dialog.querySelector("button").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", event => {
  if (event.target === dialog) dialog.close();
});

function markTerms(element, labels) {
  for (const [label, termId] of labels) {
    const node = Array.from(element.childNodes).find(
      child => child.nodeType === Node.TEXT_NODE && child.data.includes(label),
    );
    if (!node) continue;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "orbit-guide-term";
    button.dataset.term = termId;
    button.setAttribute("aria-haspopup", "dialog");
    button.textContent = label;
    const index = node.data.indexOf(label);
    node.replaceWith(node.data.slice(0, index), button, node.data.slice(index + label.length));
  }
}

document.addEventListener("click", event => {
  const button = event.target.closest(".orbit-guide-term");
  if (!button) return;

  const term = terms[button.dataset.term];
  title.textContent = term.title;
  meaning.textContent = term.meaning;
  example.textContent = term.example;
  source.href = term.source;
  button.focus({ preventScroll: true });
  dialog.showModal();
});

const quoteTerms = [
  ["예상 수령량", "estimate"],
  ["스왑 수수료", "swapFee"],
  ["슬리피지 한도", "slippage"],
  ["최소 수령량", "minimum"],
];

const staticLabels = [
  [".introduction p", [["Phantom", "phantom"], ["Devnet", "devnet"]]],
  ["#receive-label", quoteTerms],
  [".swap-panel .quote-terms dt", quoteTerms],
  ["#pool-heading", [["데모 풀", "pool"]]],
  ["#activity-empty, .completion-meta span", [["트랜잭션 서명", "signature"]]],
  ["#confirmation .hint", [["네트워크 수수료", "networkFee"], ["Phantom 승인", "approval"]]],
];

for (const [selector, labels] of staticLabels) {
  for (const element of document.querySelectorAll(selector)) markTerms(element, labels);
}

function addNote(after, text, labels = []) {
  const note = document.createElement("p");
  note.className = "orbit-guide-note";
  note.textContent = text;
  markTerms(note, labels);
  document.querySelector(after).after(note);
}

addNote(
  ".introduction h1",
  "Solana 블록체인에서 연습용 토큰을 교환하며 DeFi를 체험해 보세요.",
  [["Solana", "solana"], ["블록체인", "blockchain"], ["DeFi", "defi"]],
);
addNote(".introduction p:last-child", "밑줄 친 용어를 누르면 쉬운 뜻과 실제 쓰임을 볼 수 있어요.");
addNote(
  "#pool-hint",
  "Rust로 작성한 Solana 프로그램이 상수곱 방식으로 받을 수량을 계산해요.",
  [["Rust", "rust"], ["Solana 프로그램", "program"], ["상수곱 방식", "constantProduct"]],
);
addNote("#activity-empty", "거래 기록은 Solana Explorer에서도 확인할 수 있어요.", [["Solana Explorer", "explorer"]]);

const solBalance = document.getElementById("sol");
const reviewDetails = document.getElementById("review-details");

function markDynamicTerms() {
  markTerms(solBalance, [["SOL", "sol"]]);
  for (const label of reviewDetails.querySelectorAll("dt")) markTerms(label, quoteTerms);
}

markDynamicTerms();
const observer = new MutationObserver(markDynamicTerms);
observer.observe(solBalance, { childList: true });
observer.observe(reviewDetails, { childList: true });
