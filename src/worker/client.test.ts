import assert from "node:assert/strict";
import { test } from "node:test";
import { isClient, newClientKey } from "./client";

test("the key made with a job opens its client actions", async () => {
  const { key, hash } = await newClientKey();
  assert.notEqual(key, hash);
  assert.equal(await isClient(hash, key), true);
});

test("another job's key, a missing key or the stored hash itself don't", async () => {
  const { hash } = await newClientKey();
  const other = await newClientKey();
  assert.equal(await isClient(hash, other.key), false);
  assert.equal(await isClient(hash, undefined), false);
  assert.equal(await isClient(hash, ""), false);
  assert.equal(await isClient(hash, hash), false);
});

test("a job made without a key has no client, whatever is sent", async () => {
  const { key } = await newClientKey();
  assert.equal(await isClient(null, key), false);
  assert.equal(await isClient(null, undefined), false);
  assert.equal(await isClient(null, ""), false);
});
