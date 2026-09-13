import test from "node:test";
import assert from "node:assert/strict";
import { displayWidth, wrapPlain, clipLine, ANSI, humanizeModelName, bigTextLines } from "../src/tui.js";

test("eraseLine is full-line erase and must never be used right after printing text", () => {
  // Regression test for the v2.0.9 blank-screen bug: writing text then
  // ANSI.eraseLine ("\x1b[2K") wipes the whole line, including what was
  // just printed. Row rendering must use eraseToEnd instead.
  assert.equal(ANSI.eraseLine, "\x1b[2K");
  assert.equal(ANSI.eraseToEnd, "\x1b[K");
});

test("humanizeModelName turns raw router ids into friendly labels", () => {
  assert.equal(humanizeModelName("full_claude"), "Full Claude");
  assert.equal(humanizeModelName("gpt-4o-mini"), "Gpt 4o Mini");
  assert.equal(humanizeModelName(""), "");
});

test("bigTextLines renders a 5-row banner for FawnZ", () => {
  const lines = bigTextLines("FawnZ");
  assert.equal(lines.length, 5);
  assert.ok(lines.every((line) => line.length > 0));
});

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
