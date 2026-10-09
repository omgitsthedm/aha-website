import test from "node:test";
import assert from "node:assert/strict";
import { createBrief, validateBrief } from "../src/scripts/brief.ts";
test("blank and malformed fields get precise errors", () => {
  assert.deepEqual(Object.keys(validateBrief({})), [
    "name",
    "email",
    "message",
  ]);
  assert.ok(
    validateBrief({
      name: "Alex",
      email: "broken",
      message: "Fix our booking.",
    }).email,
  );
});
test("a valid brief prepares an encoded AHA email without sending", () => {
  const values = {
    name: "Alex & Sam",
    reference: "A / B",
    email: "owner@example.com",
    message: "Help with booking & invoices?",
    topic: "product",
  };
  assert.deepEqual(validateBrief(values), {});
  const brief = createBrief(values);
  const url = new URL(brief.url);
  assert.equal(url.protocol, "mailto:");
  assert.equal(url.pathname, "info@afterhoursagenda.com");
  assert.equal(url.searchParams.get("body"), brief.body);
  assert.match(brief.body, /Alex & Sam/);
  assert.match(brief.body, /Product or fit question/);
});
test("unknown topic and missing optional order number stay honest", () => {
  const brief = createBrief({
    name: "Alex",
    email: "owner@example.com",
    message: "Help with our website.",
    topic: "javascript:alert(1)",
  });
  assert.match(brief.body, /General question/);
  assert.match(brief.body, /Order number: Not provided/);
  assert.ok(!brief.url.includes("javascript:"));
});
test("long inputs stay bounded and data never becomes HTML", () => {
  const brief = createBrief({
    name: "<script>alert(1)</script>",
    message: "x".repeat(10000),
    email: "owner@example.com",
  });
  assert.ok(brief.body.length < 2300);
  assert.ok(!brief.url.includes("<script>"));
});
