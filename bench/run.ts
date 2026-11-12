// Runs the test set through the same checker the live site uses: code's measured facts, the first check
// (Claude Sonnet), then the second (Claude Opus) only if the first passes every check. A case passes only
// if both do, as money would move. Needs ANTHROPIC_API_KEY.
//   npm run bench               all 30 cases
//   npm run bench -- --tuning   only the 20 used while tuning the prompts
import { readFileSync, writeFileSync } from "node:fs";
import { checkDelivery, FIRST_MODEL, SECOND_MODEL } from "../src/worker/claude";
import { measure } from "../src/worker/measure";
import { settle } from "../src/worker/verdict";
import type { BenchCase, BenchResult, Check } from "../src/shared/types";

type Case = { id: string; brief: string; checks: Check[]; delivery: string; expected: "pass" | "fail"; why: string; heldOut: boolean; injection: boolean };

const key = process.env.ANTHROPIC_API_KEY;
if (!key) throw new Error("Set ANTHROPIC_API_KEY first.");
const cases: Case[] = JSON.parse(readFileSync(new URL("./cases.json", import.meta.url), "utf8"));
const only = process.argv.includes("--tuning") ? cases.filter((c) => !c.heldOut) : cases;

async function verdict(c: Case): Promise<"pass" | "fail"> {
  const measured = Object.fromEntries(c.checks.filter((x) => x.measure).map((x) => [x.id, measure(x.measure!, c.delivery)]));
  const facts = Object.fromEntries(Object.entries(measured).map(([k, m]) => [k, m.fact]));
  const blocks = [{ type: "text", text: c.delivery }];
  const first = settle(c.checks, measured, await checkDelivery(key!, FIRST_MODEL, c.brief, c.checks, facts, blocks), c.delivery);
  if (!first.allPass) return "fail";
  const second = settle(c.checks, measured, await checkDelivery(key!, SECOND_MODEL, c.brief, c.checks, facts, blocks), c.delivery);
  return second.allPass ? "pass" : "fail";
}

const got = new Map<string, "pass" | "fail">();
for (let i = 0; i < only.length; i += 6)
  await Promise.all(only.slice(i, i + 6).map(async (c) => {
    const v = await verdict(c);
    got.set(c.id, v);
    console.log(`${v === c.expected ? "right" : "MISS "}  ${c.id.padEnd(24)} expected ${c.expected}, got ${v}  (${c.why})`);
  }));

const rows: BenchCase[] = cases.map((c) => {
  const g = got.get(c.id) ?? null;
  return { id: c.id, brief: c.brief, deliveryExcerpt: c.delivery.replace(/\s+/g, " ").slice(0, 240), expected: c.expected, got: g, right: g === null ? null : g === c.expected, heldOut: c.heldOut, injection: c.injection };
});
const tally = (xs: BenchCase[]) => ({ right: xs.filter((x) => x.right).length, total: xs.filter((x) => x.right !== null).length });
const result: BenchResult = { ranAt: new Date().toISOString(), cases: rows, tuning: tally(rows.filter((r) => !r.heldOut)), heldOut: tally(rows.filter((r) => r.heldOut)) };
writeFileSync(new URL("./results.json", import.meta.url), JSON.stringify(result, null, 1) + "\n");
const wrongPays = rows.filter((r) => r.expected === "fail" && r.got === "pass").length;
console.log(`\nTuning: ${result.tuning.right} of ${result.tuning.total} right. Held back: ${result.heldOut.right} of ${result.heldOut.total} right. Money released on a failing delivery: ${wrongPays}. Checker-instruction cases passed: ${rows.filter((r) => r.injection && r.got === "pass").length} of ${rows.filter((r) => r.injection && r.got).length}.`);
