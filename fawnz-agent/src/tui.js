import chalk from "chalk";

export const ANSI = {
  clear: "\x1b[2J\x1b[H",
  altEnter: "\x1b[?1049h",
  altLeave: "\x1b[?1049l",
  hideCursor: "\x1b[?25l",
  showCursor: "\x1b[?25h",
  saveCursor: "\x1b7",
  restoreCursor: "\x1b8",
  eraseLine: "\x1b[2K",
  eraseToEnd: "\x1b[K", // erase from the cursor to end of line — safe to use AFTER writing text on that line
  eraseDown: "\x1b[J",
  reset: "\x1b[0m",
  syncBegin: "\x1b[?2026h",
  syncEnd: "\x1b[?2026l",
};

export function isInteractiveTerminal() {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

export function enterFullscreen() {
  if (!isInteractiveTerminal()) return;
  process.stdout.write(ANSI.altEnter + ANSI.clear + ANSI.hideCursor);
}

export function leaveFullscreen() {
  if (!isInteractiveTerminal()) return;
  process.stdout.write(ANSI.showCursor + ANSI.reset + ANSI.altLeave);
}

export function terminalSize() {
  const cols = Math.max(40, Number(process.stdout.columns) || 80);
  const rows = Math.max(12, Number(process.stdout.rows) || 24);
  return { cols, rows };
}

export function stripAnsi(value = "") {
  // eslint-disable-next-line no-control-regex
  return String(value).replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "");
}

function charWidth(ch) {
  const code = ch.codePointAt(0);
  if (code === undefined || code === 0 || code < 32 || (code >= 0x7f && code < 0xa0)) return 0;
  if (/\p{Mark}/u.test(ch) || code === 0x200d || (code >= 0xfe00 && code <= 0xfe0f)) return 0;
  if (
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2329 && code <= 0x232a) ||
    (code >= 0x2e80 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe10 && code <= 0xfe19) ||
    (code >= 0xfe30 && code <= 0xfe6f) ||
    (code >= 0xff01 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6) ||
    (code >= 0x1f300 && code <= 0x1faff)
  ) return 2;
  return 1;
}

export function displayWidth(value = "") {
  const text = String(value).replace(/\r/g, "");
  let width = 0;
  const tokens = text.match(/\x1b\[[0-?]*[ -/]*[@-~]|[^\x1b]/gu) || [];
  for (const token of tokens) {
    if (token.startsWith("\x1b[")) continue;
    width += charWidth(token);
  }
  return width;
}

export function clipLine(value, maxWidth) {
  if (maxWidth <= 0) return "";
  const text = String(value ?? "");
  if (displayWidth(text) <= maxWidth) return text;

  let out = "";
  let width = 0;
  const limit = Math.max(0, maxWidth - 1);
  const tokens = text.match(/\x1b\[[0-?]*[ -/]*[@-~]|[^\x1b]/gu) || [];
  for (const token of tokens) {
    if (token.startsWith("\x1b[")) {
      out += token;
      continue;
    }
    const w = charWidth(token);
    if (width + w > limit) break;
    out += token;
    width += w;
  }
  return `${out}…${ANSI.reset}`;
}

export function wrapPlain(text, width) {
  const safeWidth = Math.max(10, width);
  const normalized = String(text ?? "").replace(/\r/g, "");
  const sourceLines = normalized.split("\n");
  const out = [];

  for (const rawLine of sourceLines) {
    if (rawLine === "") {
      out.push("");
      continue;
    }

    let line = rawLine;
    while (displayWidth(line) > safeWidth) {
      let cutIndex = 0;
      let used = 0;
      for (const ch of Array.from(line)) {
        const w = charWidth(ch);
        if (used + w > safeWidth) break;
        used += w;
        cutIndex += ch.length;
      }
      if (cutIndex <= 0) break;

      let segment = line.slice(0, cutIndex);
      const breakAt = segment.lastIndexOf(" ");
      if (breakAt > Math.floor(segment.length * 0.55)) {
        segment = segment.slice(0, breakAt);
        cutIndex = breakAt;
      }
      out.push(segment);
      line = line.slice(cutIndex).replace(/^\s+/, "");
    }
    out.push(line);
  }
  return out;
}

function padRight(text, width) {
  return `${text}${" ".repeat(Math.max(0, width - displayWidth(text)))}`;
}

export function renderFrame(lines, { footer = null, cursor = null, clear = false } = {}) {
  if (!isInteractiveTerminal()) return;

  const { cols, rows } = terminalSize();
  const footerRows = footer ? 1 : 0;
  const contentRows = Math.max(1, rows - footerRows);
  const source = Array.isArray(lines) ? lines : [String(lines ?? "")];
  const visible = source.slice(-contentRows);

  let frame = ANSI.syncBegin;
  if (clear) frame += ANSI.clear;
  else frame += "\x1b[H";

  for (let row = 0; row < contentRows; row += 1) {
    const text = visible[row] ?? "";
    // Erase-to-end AFTER the text (not eraseLine, which would wipe out what we just wrote).
    frame += `\x1b[${row + 1};1H${clipLine(text, cols)}${ANSI.eraseToEnd}`;
  }

  if (footer) {
    frame += `\x1b[${rows};1H${padRight(clipLine(footer, cols), cols)}`;
  }

  if (cursor) {
    const row = Math.max(1, Math.min(rows, cursor.row));
    const col = Math.max(1, Math.min(cols, cursor.col));
    frame += `\x1b[${row};${col}H${ANSI.showCursor}`;
  } else {
    frame += ANSI.hideCursor;
  }

  frame += ANSI.syncEnd;
  process.stdout.write(frame);
}

export function drawFullscreen(lines, options = {}) {
  renderFrame(lines, { ...options, clear: true });
}

// Compact 5x5 block font — only the glyphs FawnZ actually needs for its splash banner.
const BANNER_FONT = {
  F: ["█████", "█    ", "███  ", "█    ", "█    "],
  A: [" ███ ", "█   █", "█████", "█   █", "█   █"],
  W: ["█   █", "█   █", "█ █ █", "██ ██", "█   █"],
  N: ["█   █", "██  █", "█ █ █", "█  ██", "█   █"],
  Z: ["█████", "    █", "   █ ", "  █  ", "█████"],
};
const BANNER_GLYPH_HEIGHT = 5;
const BANNER_BLANK_GLYPH = ["     ", "     ", "     ", "     ", "     "];

// Renders `word` as big block-letter ASCII art (Hermes/figlet-style splash),
// one row per array entry. Falls back to blank columns for unsupported chars.
export function bigTextLines(word) {
  const glyphs = String(word)
    .toUpperCase()
    .split("")
    .map((ch) => BANNER_FONT[ch] || (ch === " " ? ["  ", "  ", "  ", "  ", "  "] : BANNER_BLANK_GLYPH));
  const rows = [];
  for (let row = 0; row < BANNER_GLYPH_HEIGHT; row += 1) {
    rows.push(glyphs.map((glyph) => glyph[row]).join(" "));
  }
  return rows;
}

export function bannerWidth(word) {
  const lines = bigTextLines(word);
  return Math.max(0, ...lines.map((line) => displayWidth(line)));
}

export function centerLine(text, width) {
  const w = displayWidth(text);
  const pad = Math.max(0, Math.floor((width - w) / 2));
  return " ".repeat(pad) + text;
}

// Turns a raw router/model id like "full_claude" into a friendlier label
// like "Full Claude" for display. Set `displayModel` in config to override
// this entirely (e.g. to hide the underlying provider name).
export function humanizeModelName(rawModel) {
  const value = String(rawModel || "").trim();
  if (!value) return "";
  return value
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function headerLine({ model, version, busy = false }) {
  const { cols } = terminalSize();
  const left = chalk.bold.hex("#F2A24C")("FawnZ") + chalk.gray(` v${version}`);
  const middle = model ? chalk.white(humanizeModelName(model)) : chalk.yellow("no model");
  const right = busy ? chalk.hex("#F2A24C")("● working") : chalk.gray("● ready");
  const leftWidth = displayWidth(left);
  const middleWidth = displayWidth(middle);
  const rightWidth = displayWidth(right);
  const spaces = Math.max(3, cols - leftWidth - middleWidth - rightWidth);
  const leftGap = Math.floor(spaces / 2);
  const rightGap = spaces - leftGap;
  return `${left}${" ".repeat(leftGap)}${middle}${" ".repeat(rightGap)}${right}`;
}
