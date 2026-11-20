import assert from "node:assert/strict";
import test from "node:test";
import { calculateQuote, formatAmount, INITIAL_RESERVE, parseAmount } from "../src/quote.mjs";

test("초기 풀의 1개 교환 견적과 수수료 및 최소 수령량", () => {
  const quote = calculateQuote(parseAmount("1"), INITIAL_RESERVE, INITIAL_RESERVE);
  assert.deepEqual(quote, { amountOut: 996_006n, fee: 3_000n, minimumOut: 991_026n });
  assert.equal(formatAmount(quote.amountOut), "0.996006");
});

test("허용 정밀도와 소액 수수료를 정수 단위로 적용", () => {
  assert.equal(parseAmount(".000002"), 2n);
  assert.equal(parseAmount("0.0000001"), null);
  assert.equal(parseAmount("18446744073709.551616"), null);
  assert.equal(calculateQuote(2n, INITIAL_RESERVE, INITIAL_RESERVE), null);
  assert.deepEqual(
    calculateQuote(3n, INITIAL_RESERVE, INITIAL_RESERVE),
    { amountOut: 1n, fee: 1n, minimumOut: 1n },
  );
});
