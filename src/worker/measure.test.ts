import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { FINISHED } from "../shared/example";
import { splitItems, words } from "./measure";

// The harder cases the first run got wrong, as they were delivered.
const hard = JSON.parse(readFileSync(new URL("../../bench/hard.json", import.meta.url), "utf8")) as { id: string; delivery?: string }[];
const delivery = (id: string) => hard.find((c) => c.id === id)!.delivery!;

test("a table is one piece per row, without its heading row", () => {
  const items = splitItems(delivery("faq-as-a-table"));
  assert.equal(items.length, 5);
  assert.match(items[0], /^When are you open\? We're open every day/);
  for (const n of items.map(words)) assert.ok(n >= 20 && n <= 40, `${n} words`);
});

test("a cover note and a sign-off around titled pieces aren't pieces", () => {
  const items = splitItems(delivery("packs-with-cover-note"));
  assert.deepEqual(items.map((s) => s.split(/\s+/).slice(0, 2).join(" ")), ["Ridge 30", "Summit 45", "Trail 20"]);
});

test("a greeting line isn't a title", () => {
  assert.deepEqual(splitItems("Hi Sam,\n\nHere is the first paragraph of the work, long enough to be a piece.\n\nAnd here is the second paragraph, also a piece of the work."), [
    "Hi Sam,",
    "Here is the first paragraph of the work, long enough to be a piece.",
    "And here is the second paragraph, also a piece of the work.",
  ]);
});

test("the sample delivery still has its five numbered pieces", () => {
  assert.deepEqual(splitItems(FINISHED).map(words), [91, 88, 92, 86, 88]);
});
