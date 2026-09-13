import test from "node:test";
import assert from "node:assert/strict";
import { displayWidth, wrapPlain, clipLine } from "../src/tui.js";

test("displayWidth handles wide CJK and emoji without crashing", () => {
  assert.equal(displayWidth("abc"), 3);
  assert.equal(displayWidth("你好"), 4);
  assert.ok(displayWidth("🙂") >= 1);
});

test("wrapPlain preserves every character", () => {
  const value = "hello world this is a long line";
  const result = wrapPlain(value, 10).join("");
  assert.equal(result.replaceAll(" ", ""), value.replaceAll(" ", ""));
});

test("clipLine never exceeds its width budget", () => {
  const line = clipLine("123456789", 5);
  assert.ok(displayWidth(line) <= 5);
});
