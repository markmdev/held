import type { Job, LedgerRow } from "../shared/types";
import { EXAMPLE } from "../shared/example";

// The example job as it looks once paid, for building pages before the live data is there.
export const SAMPLE_JOB: Job = {
  id: "job_sample",
  title: EXAMPLE.title,
  brief: EXAMPLE.brief,
  freelancerEmail: "freelancer@held.example.com",
  createdAt: "2026-11-12T13:40:00.000Z",
  seeded: false,
  checks: [
    { id: "c1", text: "5 descriptions, one for each mug", kind: "measured", measure: { type: "item_count", min: 5, max: 5 } },
    { id: "c2", text: "Covers Harbor Blue, Oat Speckle, Midnight Glaze, Terracotta Stripe and Sea Glass", kind: "judged" },
    { id: "c3", text: "80 to 120 words each", kind: "measured", measure: { type: "words_per_item", min: 80, max: 120 } },
    { id: "c4", text: "Written in English", kind: "judged" },
    { id: "c5", text: "Each says dishwasher-safe", kind: "measured", measure: { type: "each_item_contains", phrase: "dishwasher-safe" } },
    { id: "c6", text: "No exclamation marks", kind: "measured", measure: { type: "none_contains", phrase: "!" } },
    { id: "c7", text: "Warm and calm in tone", kind: "judged" },
  ],
  money: { state: "paid", amount: "150.00", capturedAmount: "150.00", orderId: "5O190127TN364715T", authorizationId: "0VF52814937998046", captureId: "3C679366HH908993F", payoutBatchId: "5UXD2E8A7EBQJ", payoutStatus: "SUCCESS", heldAt: "2026-11-12T13:41:10.000Z", paidAt: "2026-11-12T13:43:21.000Z" },
  deliveries: [
    {
      id: "dlv_1", at: "2026-11-12T13:42:00.000Z", label: "Pasted text", excerpt: "1. Harbor Blue A deep coastal blue that pools darker where the glaze runs thick near the base…", outcome: "failed",
      first: [
        { checkId: "c1", pass: false, quote: "1. Harbor Blue A deep coastal blue… 2. Oat Speckle Our best seller! A…", reason: "4 pieces found; needs 5" },
        { checkId: "c2", pass: false, quote: "", reason: "Sea Glass is not covered anywhere in the delivery." },
        { checkId: "c3", pass: false, quote: "Piece 3 (18 words): “Midnight Glaze Nearly black, with a soft blue shine…”", reason: "word counts: 91, 76, 18, 86; each needs 80 to 120" },
        { checkId: "c4", pass: true, quote: "A deep coastal blue that pools darker where the glaze runs thick near the base.", reason: "All the text is in English." },
        { checkId: "c5", pass: true, quote: "It is dishwasher-safe and microwave-safe", reason: "“dishwasher-safe” appears in 4 of 4 pieces" },
        { checkId: "c6", pass: false, quote: "Piece 2: “Our best seller!”", reason: "“!” appears in 1 piece" },
        { checkId: "c7", pass: false, quote: "Grab two, because one always goes missing to the office!", reason: "The Oat Speckle description is loud and salesy rather than warm and calm." },
      ],
      second: null,
      missing: ["Add a Sea Glass description of 80 to 120 words.", "Expand the Midnight Glaze description from 18 words.", "Remove the exclamation marks from Oat Speckle."],
      secondsToPaid: null,
    },
    {
      id: "dlv_2", at: "2026-11-12T13:43:10.000Z", label: "Pasted text", excerpt: "1. Harbor Blue A deep coastal blue that pools darker where the glaze runs thick near the base…", outcome: "passed",
      first: [{ checkId: "c1", pass: true, quote: "1. Harbor Blue… 5. Sea Glass…", reason: "5 pieces found; needs 5" }],
      second: [{ checkId: "c1", pass: true, quote: "1. Harbor Blue… 5. Sea Glass…", reason: "5 pieces found; needs 5" }],
      missing: [],
      secondsToPaid: 11.2,
    },
  ],
};

export const SAMPLE_LEDGER: LedgerRow[] = [
  { id: "job_sample", title: EXAMPLE.title, createdAt: SAMPLE_JOB.createdAt, seeded: false, state: "paid", amount: "150.00", verdict: "passed", secondsToPaid: 11.2, authorizationId: "0VF52814937998046", captureId: "3C679366HH908993F", payoutBatchId: "5UXD2E8A7EBQJ" },
];
