import assert from "node:assert/strict";
import { test } from "node:test";
import { expireHold, holdExpired } from "./expiry";

// PayPal's own time for the seeded held job's hold.
const expires = "2026-12-11T12:54:51Z";
const held = { money_state: "held" as const, hold_expires_at: expires, cancelled_at: null };
const at = (iso: string) => Date.parse(iso);

test("a hold stays held until PayPal's expiry time", () => {
  assert.equal(expireHold(held, at("2026-12-11T12:54:50.999Z")), held);
});

test("from the expiry time the hold is cancelled, dated at the expiry", () => {
  for (const now of ["2026-12-11T12:54:51.000Z", "2026-12-15T09:00:00.000Z"]) {
    const row = expireHold(held, at(now));
    assert.equal(row.money_state, "cancelled");
    assert.equal(row.cancelled_at, expires);
    assert.equal(holdExpired(row), true);
  }
});

test("only a held job can expire", () => {
  for (const money_state of ["awaiting_hold", "paid", "part_paid", "cancelled"] as const) {
    const row = { ...held, money_state };
    assert.equal(expireHold(row, at("2027-01-01T00:00:00Z")), row);
  }
});

test("a hold with no expiry time recorded never expires here", () => {
  const row = { ...held, hold_expires_at: null };
  assert.equal(expireHold(row, at("2027-01-01T00:00:00Z")), row);
});

test("a hold the client cancelled is not called expired", () => {
  assert.equal(holdExpired({ money_state: "cancelled", hold_expires_at: expires, cancelled_at: "2026-11-12T12:55:10.000Z" }), false);
});

test("a hold PayPal voided at its expiry is expired", () => {
  assert.equal(holdExpired({ money_state: "cancelled", hold_expires_at: expires, cancelled_at: "2026-12-11T12:55:03.120Z" }), true);
});
