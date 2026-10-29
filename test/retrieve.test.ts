import { test } from "node:test";
import assert from "node:assert/strict";
import { Index, loadChunks, tokenize } from "../src/retrieve.js";

const index = new Index(loadChunks("docs"));

test("loads one chunk per heading section", () => {
  assert.ok(index.size >= 10);
  assert.deepEqual(index.sources().sort(), ["deployments.md", "onboarding.md", "security.md", "vendor-notes.md"]);
});

test("tokenizer lowercases and drops stopwords", () => {
  assert.deepEqual(tokenize("How do we ROLL BACK a release?"), ["roll", "back", "release"]);
});

test("finds the rollback section", () => {
  const [top] = index.search("how do I roll back a deployment, rollbacks");
  assert.equal(top.chunk.source, "deployments.md");
  assert.equal(top.chunk.heading, "Rollbacks");
});

test("finds the Friday deployment rule", () => {
  const [top] = index.search("can we deploy on Friday");
  assert.equal(top.chunk.heading, "Release windows");
});

test("finds secret rotation guidance", () => {
  const [top] = index.search("rotate exposed secrets");
  assert.equal(top.chunk.source, "security.md");
});

test("returns nothing for unrelated queries", () => {
  assert.deepEqual(index.search("holiday entitlement pension"), []);
});
