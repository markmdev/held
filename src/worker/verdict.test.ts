import assert from "node:assert/strict";
import { test } from "node:test";
import type { Check } from "../shared/types";
import { settle } from "./verdict";

const checks: Check[] = [{ id: "c1", text: "Image is square", kind: "judged" }];
const form = ["Delivered as a file: poster.png (PNG image).", "Image size: 1080 × 1080 pixels (square)."];
const out = (quote: string) => ({ verdicts: [{ checkId: "c1", pass: true, about_absence: false, quote, reason: "" }], missing: [], injection: "" });

test("a pass can rest on a fact code measured about the delivery", () => {
  assert.equal(settle(checks, {}, out("Image size: 1080 × 1080 pixels (square)."), "some text", form).allPass, true);
});

test("a pass quoting words in neither the delivery nor its facts fails", () => {
  const s = settle(checks, {}, out("Image size: 1200 × 1200 pixels (square)."), "some text", form);
  assert.equal(s.allPass, false);
  assert.equal(s.verdicts[0].reason, "The quoted words aren't in the delivery.");
});

test("a pass with no quote still fails", () => {
  assert.equal(settle(checks, {}, out(""), "some text", form).allPass, false);
});
