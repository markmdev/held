export type CheckKind = "measured" | "judged";

// What code measures for a "measured" check. Items are the delivery's pieces: blank-line or numbered blocks.
export type Measure =
  | { type: "item_count"; min: number; max: number }
  | { type: "words_per_item"; min: number; max: number }
  | { type: "total_words"; min: number; max: number }
  | { type: "each_item_contains"; phrase: string }
  | { type: "none_contains"; phrase: string };

export type Check = { id: string; text: string; kind: CheckKind; measure?: Measure };

export type MoneyState = "awaiting_hold" | "held" | "paid" | "part_paid" | "cancelled";
export type Money = {
  state: MoneyState;
  amount: string;
  capturedAmount?: string;
  /** When PayPal ends the hold if nothing takes or cancels it first: 29 days after it was placed. */
  holdExpiresAt?: string;
  /** True when a cancelled hold ran out at PayPal, rather than being cancelled by the client. */
  expired?: boolean;
  /** When PayPal says the payout reached the freelancer. */
  payoutDoneAt?: string;
  orderId?: string;
  authorizationId?: string;
  captureId?: string;
  payoutBatchId?: string;
  payoutStatus?: string;
  heldAt?: string;
  paidAt?: string;
  cancelledAt?: string;
};

export type Verdict = { checkId: string; pass: boolean; quote: string; reason: string };
export type DeliveryOutcome = "checking" | "passed" | "failed" | "disagreed";
export type Delivery = {
  id: string;
  at: string;
  label: string;
  excerpt: string;
  outcome: DeliveryOutcome;
  first: Verdict[];
  second: Verdict[] | null;
  missing: string[];
  secondsToPaid: number | null;
  /** When the first check finished, and the second if it ran. Deliveries from before 12 November 16:00 have neither. */
  firstCheckedAt?: string;
  secondCheckedAt?: string;
};

export type Job = {
  id: string;
  title: string;
  brief: string;
  freelancerEmail: string;
  createdAt: string;
  seeded: boolean;
  checks: Check[];
  money: Money;
  deliveries: Delivery[];
};

/** benchRight counts the harder cases as they came out on their first run. */
export type Stats = { jobsPaid: number; medianSecondsToPaid: number | null; medianSecondsToPayout: number | null; benchRight: number; benchTotal: number };
export type LedgerRow = Pick<Job, "id" | "title" | "createdAt" | "seeded"> & {
  state: MoneyState;
  /** True when a cancelled hold ran out at PayPal, rather than being cancelled by the client. */
  expired?: boolean;
  /** What the client agreed to pay and PayPal held. */
  price: string;
  /** The held price, or what was taken from the hold once it's paid. */
  amount: string;
  verdict: DeliveryOutcome | "none";
  /** What the latest delivery still lacks, one line each; empty once it passes. */
  missing: string[];
  secondsToPaid: number | null;
  authorizationId?: string;
  captureId?: string;
  payoutBatchId?: string;
};
export type BenchCase = {
  id: string;
  brief: string;
  deliveryExcerpt: string;
  expected: "pass" | "fail";
  got: "pass" | "fail" | null;
  right: boolean | null;
  heldOut: boolean;
  injection: boolean;
  /** One of the harder cases: written after the checker was finished and run once. */
  hard?: boolean;
  /** How the work was delivered; pasted text when absent. */
  kind?: "text" | "pdf" | "image" | "link";
  /** What the case tests. */
  why?: string;
  /** A harder case's verdict on its first run, before the fixes the misses led to. */
  firstGot?: "pass" | "fail";
  /** For a case missed on that first run: what went wrong and what was changed. */
  cause?: string;
};
export type BenchResult = {
  ranAt: string | null;
  cases: BenchCase[];
  tuning: { right: number; total: number };
  heldOut: { right: number; total: number };
  hard: { right: number; total: number };
  /** The harder cases' first run, on 12 November 2026, before any fix. */
  hardFirst: { right: number; total: number; ranAt: string };
};

export type DailyLeft = { checksLeft: number; checksPerDay: number };
export type ApiError = { error: string; code?: "daily_limit" | "bad_request" | "paypal" | "claude" | "not_found" };
