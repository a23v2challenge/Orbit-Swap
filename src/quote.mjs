export const TOKEN_DECIMALS = 6;
export const TOKEN_UNIT = 10n ** BigInt(TOKEN_DECIMALS);
export const INITIAL_RESERVE = 1_000n * TOKEN_UNIT;
export const PRACTICE_BALANCE = 100n * TOKEN_UNIT;
export const FEE_BPS = 30n;
export const SLIPPAGE_BPS = 50n;

const BPS = 10_000n;
const U64_MAX = (1n << 64n) - 1n;
const wholeFormat = new Intl.NumberFormat("ko-KR");

export function parseAmount(input) {
  const text = input.trim();
  if (!/^(?:\d+(?:\.\d{0,6})?|\.\d{1,6})$/.test(text) || text.length > 27) return null;
  const [whole, fraction = ""] = text.split(".");
  const amount = BigInt(whole || "0") * TOKEN_UNIT + BigInt(fraction.padEnd(TOKEN_DECIMALS, "0"));
  return amount <= U64_MAX ? amount : null;
}

export function formatAmount(amount) {
  const whole = wholeFormat.format(amount / TOKEN_UNIT);
  const fraction = (amount % TOKEN_UNIT).toString().padStart(TOKEN_DECIMALS, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}

export function calculateQuote(amountIn, reserveIn, reserveOut) {
  if (amountIn <= 0n || reserveIn <= 0n || reserveOut <= 0n) return null;
  const fee = (amountIn * FEE_BPS + BPS - 1n) / BPS;
  const net = amountIn - fee;
  const amountOut = (reserveOut * net) / (reserveIn + net);
  if (amountOut === 0n) return null;
  const minimumOut = (amountOut * (BPS - SLIPPAGE_BPS) + BPS - 1n) / BPS;
  return { amountOut, minimumOut, fee };
}
