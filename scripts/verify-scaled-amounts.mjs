import assert from "node:assert/strict";

function effectiveMultiplier(multiplier) {
  return multiplier && Number.isFinite(multiplier) && multiplier > 0 ? multiplier : null;
}

function uiToRaw(uiAmount, multiplier, decimals) {
  const active = effectiveMultiplier(multiplier);
  if (!Number.isFinite(uiAmount) || uiAmount <= 0 || !active || !Number.isInteger(decimals) || decimals < 0 || decimals > 18) return null;
  const baseAmount = uiAmount / active;
  const raw = Math.floor(baseAmount * (10 ** decimals));
  if (!Number.isSafeInteger(raw) || raw <= 0) return null;
  return { uiAmount, baseAmount, rawAmount: String(raw), multiplier: active, decimals };
}

function rawToUi(rawAmount, multiplier, decimals) {
  const active = effectiveMultiplier(multiplier);
  const raw = typeof rawAmount === "string" ? Number(rawAmount) : rawAmount;
  if (!Number.isFinite(raw) || raw < 0 || !active || !Number.isInteger(decimals) || decimals < 0 || decimals > 18) return null;
  return (raw / (10 ** decimals)) * active;
}

const split = uiToRaw(1, 2, 6);
assert.ok(split);
assert.equal(split.rawAmount, "500000");
assert.equal(rawToUi(split.rawAmount, 2, 6), 1);

const identity = uiToRaw(3.5, 1, 6);
assert.ok(identity);
assert.equal(identity.rawAmount, "3500000");

assert.equal(uiToRaw(1, 0, 6), null);
assert.equal(uiToRaw(1, null, 6), null);
assert.equal(uiToRaw(-1, 1, 6), null);
assert.equal(rawToUi("1000000", 1, 6), 1);

console.log("scaled-amount checks passed");
