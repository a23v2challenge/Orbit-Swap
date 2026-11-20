import { Buffer } from "buffer";

globalThis.Buffer ??= Buffer;
import("./main.mjs").catch(error => {
  console.error(error);
  const message = document.getElementById("message");
  message.textContent = "스왑 화면을 시작하지 못했습니다. 페이지를 새로고침해 주세요.";
  message.dataset.kind = "error";
  message.hidden = false;
});
