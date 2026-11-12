// Runs the test set through the same checker the live site uses: the delivery is read as the site reads it
// (pasted text, a PDF, an image or a link), code measures what it can count, then the first check (Claude Sonnet)
// and the second (Claude Opus) only if the first passes every check. A case passes only if both do, as money
// would move. Needs ANTHROPIC_API_KEY.
//   npm run bench               every case
//   npm run bench -- --tuning   only the 20 used while tuning the prompts
import { readFileSync, writeFileSync } from "node:fs";
import { checkDelivery, FIRST_MODEL, SECOND_MODEL } from "../src/worker/claude";
import { readDelivery, type Incoming } from "../src/worker/delivery";
import { measure } from "../src/worker/measure";
import { settle } from "../src/worker/verdict";
import type { BenchCase, BenchResult, Check } from "../src/shared/types";

type Case = {
  id: string; brief: string; checks: Check[]; expected: "pass" | "fail"; why: string; heldOut: boolean; injection: boolean; hard?: boolean;
  // One of: pasted text, a file in bench/files, or a link.
  delivery?: string; file?: { name: string; type: string }; link?: string;
};

const key = process.env.ANTHROPIC_API_KEY;
if (!key) throw new Error("Set ANTHROPIC_API_KEY first.");
const load = (f: string) => JSON.parse(readFileSync(new URL(f, import.meta.url), "utf8")) as Case[];
const cases: Case[] = [...load("./cases.json"), ...load("./hard.json").map((c) => ({ ...c, hard: true }))];
// The harder cases' first run is kept as it came out; the fixes its misses led to are in the code this runs.
const firstRun = JSON.parse(readFileSync(new URL("./hard-first-run.json", import.meta.url), "utf8")) as { ranAt: string; cases: Record<string, { got: "pass" | "fail"; cause?: string }> };
const only = process.argv.includes("--tuning") ? cases.filter((c) => !c.heldOut && !c.hard) : cases;

const kind = (c: Case): NonNullable<BenchCase["kind"]> => (c.link ? "link" : c.file ? (c.file.type === "application/pdf" ? "pdf" : "image") : "text");
const incoming = (c: Case): Incoming =>
  c.link ? { link: c.link } : c.file ? { file: { ...c.file, base64: readFileSync(new URL(`./files/${c.file.name}`, import.meta.url)).toString("base64") } } : { text: c.delivery };

const excerpts = new Map<string, string>();
async function verdict(c: Case): Promise<"pass" | "fail"> {
  const d = await readDelivery(incoming(c));
  excerpts.set(c.id, (d.text ?? `${d.label} (an image; the checker reads it)`).replace(/\s+/g, " ").slice(0, 240));
  const measured = d.text === null ? {} : Object.fromEntries(c.checks.filter((x) => x.measure).map((x) => [x.id, measure(x.measure!, d.text!)]));
  const facts = Object.fromEntries(Object.entries(measured).map(([k, m]) => [k, m.fact]));
  const first = settle(c.checks, measured, await checkDelivery(key!, FIRST_MODEL, c.brief, c.checks, facts, d.blocks, d.form), d.text, d.form);
  if (!first.allPass) return "fail";
  const second = settle(c.checks, measured, await checkDelivery(key!, SECOND_MODEL, c.brief, c.checks, facts, d.blocks, d.form), d.text, d.form);
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
  return {
    id: c.id, brief: c.brief, deliveryExcerpt: excerpts.get(c.id) ?? (c.delivery ?? c.link ?? c.file!.name).replace(/\s+/g, " ").slice(0, 240),
    expected: c.expected, got: g, right: g === null ? null : g === c.expected, heldOut: c.heldOut, injection: c.injection,
    ...(c.hard ? { hard: true, kind: kind(c), why: c.why, firstGot: firstRun.cases[c.id].got, ...(firstRun.cases[c.id].cause ? { cause: firstRun.cases[c.id].cause } : {}) } : {}),
  };
});
const tally = (xs: BenchCase[]) => ({ right: xs.filter((x) => x.right).length, total: xs.filter((x) => x.right !== null).length });
const result: BenchResult = {
  ranAt: new Date().toISOString(), cases: rows,
  tuning: tally(rows.filter((r) => !r.heldOut && !r.hard)), heldOut: tally(rows.filter((r) => r.heldOut && !r.hard)), hard: tally(rows.filter((r) => r.hard)),
  hardFirst: { right: rows.filter((r) => r.hard && r.firstGot === r.expected).length, total: rows.filter((r) => r.hard).length, ranAt: firstRun.ranAt },
};
writeFileSync(new URL("./results.json", import.meta.url), JSON.stringify(result, null, 1) + "\n");
const wrongPays = rows.filter((r) => r.expected === "fail" && r.got === "pass").length;
console.log(`\nTuning: ${result.tuning.right} of ${result.tuning.total} right. Held back: ${result.heldOut.right} of ${result.heldOut.total} right. Harder cases: ${result.hard.right} of ${result.hard.total} right (${result.hardFirst.right} of ${result.hardFirst.total} on their first run, before the fixes its misses led to). Money released on a failing delivery: ${wrongPays}. Checker-instruction cases passed: ${rows.filter((r) => r.injection && r.got === "pass").length} of ${rows.filter((r) => r.injection && r.got).length}.`);
