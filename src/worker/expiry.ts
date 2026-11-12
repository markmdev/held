import type { MoneyState } from "../shared/types";

type Hold = { money_state: MoneyState; hold_expires_at: string | null; cancelled_at: string | null };

// PayPal ends a hold at the expiry time it gave when the hold was placed, 29 days on. From then the money is
// back with the client, whether or not PayPal's notice has reached Held yet.
export function expireHold<T extends Hold>(row: T, now: number): T {
  if (row.money_state !== "held" || !row.hold_expires_at || Date.parse(row.hold_expires_at) > now) return row;
  return { ...row, money_state: "cancelled", cancelled_at: row.hold_expires_at };
}

// A cancelled hold ran out, rather than being cancelled by the client, when it ended at or after its expiry time.
export function holdExpired(row: Hold) {
  return row.money_state === "cancelled" && !!row.hold_expires_at && !!row.cancelled_at && Date.parse(row.cancelled_at) >= Date.parse(row.hold_expires_at);
}
