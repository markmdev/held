import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { imageSize, readDelivery } from "./delivery";

const file = (name: string) => readFileSync(new URL(`../../bench/files/${name}`, import.meta.url));

test("a PNG's size is read from its header", () => {
  assert.deepEqual(imageSize(new Uint8Array(file("bakery-opening.png")), "image/png"), { width: 1080, height: 1080 });
});

test("a JPEG's size is read from its frame header, past the segments before it", () => {
  // SOI, an APP0 segment of 16 bytes, then SOF0: 8-bit, 630 high, 1200 wide.
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, ...new Array(14).fill(0), 0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0x76, 0x04, 0xb0, 0x03]);
  assert.deepEqual(imageSize(jpeg, "image/jpeg"), { width: 1200, height: 630 });
});

test("bytes that aren't the image they claim to be have no size", () => {
  assert.equal(imageSize(new Uint8Array([1, 2, 3, 4]), "image/png"), null);
});

test("an image's facts say how it was delivered and its size", async () => {
  const d = await readDelivery({ file: { name: "bakery-opening.png", type: "image/png", base64: file("bakery-opening.png").toString("base64") } });
  assert.deepEqual(d.form, ["Delivered as a file: bakery-opening.png (PNG image).", "Image size: 1080 × 1080 pixels (square)."]);
});

test("a PDF's facts give its pages and words", async () => {
  const d = await readDelivery({ file: { name: "returns-policy.pdf", type: "application/pdf", base64: file("returns-policy.pdf").toString("base64") } });
  assert.equal(d.form[0], "Delivered as a file: returns-policy.pdf (PDF, 1 page).");
  assert.match(d.form[1], /^Words in total: \d+\.$/);
});

test("pasted text's facts give its words", async () => {
  const d = await readDelivery({ text: "one two three" });
  assert.deepEqual(d.form, ["Delivered as pasted text.", "Words in total: 3."]);
});
