import chalk from "chalk";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Versi ditarik langsung dari package.json (single source of truth) —
// supaya banner, --version, dan npm registry gak pernah selisih lagi.
function readVersion() {
  try {
    const pkgPath = path.join(__dirname, "..", "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    return pkg.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

const VERSION = readVersion();
const ACCENT = "#F2A24C";

// Satu sumber untuk semua perintah "/" — dipakai oleh /help DAN oleh
// menu autocomplete di promptInput.js supaya keduanya selalu sinkron.
export const COMMANDS = [
  { name: "/help", desc: "show this help" },
  { name: "/model", desc: "open the model picker (↑↓ arrows, type to search)" },
  { name: "/models", desc: "list every model from the router as plain text" },
  { name: "/clear", desc: "clear the conversation history" },
  { name: "/config", desc: "redo setup (base url / api key / model)" },
  { name: "/exit", desc: "quit ZCode" },
  { name: "/quit", desc: "same as /exit" },
];

function termWidth() {
  const cols = process.stdout.columns || 80;
  return Math.max(40, Math.min(cols - 2, 96));
}

// Animasi singkat pas app baru dibuka — cuma buat "vibe" masuk ke app,
// bukan loading beneran (gak ada network call di sini). Otomatis
// dilewati kalau output bukan TTY (dipipe/di-log/CI) supaya gak nyampah
// karakter ANSI di tempat yang gak bisa render animasi.
const BOOT_FRAMES = ["◐", "◓", "◑", "◒"];

export function printBootAnimation({ durationMs = 420 } = {}) {
  if (!process.stdout.isTTY) return Promise.resolve();

  return new Promise((resolve) => {
    let i = 0;
    process.stdout.write("\x1B[?25l");
    const label = chalk.gray("booting ") + chalk.hex(ACCENT).bold("ZCode") + chalk.gray("...");
    const timer = setInterval(() => {
      process.stdout.write(`\r\x1B[K${chalk.hex(ACCENT)(BOOT_FRAMES[i])} ${label}`);
      i = (i + 1) % BOOT_FRAMES.length;
    }, 90);

    setTimeout(() => {
      clearInterval(timer);
      process.stdout.write("\r\x1B[K\x1B[?25h");
      resolve();
    }, durationMs);
  });
}

export function printBanner({ model, baseUrl }) {
  const width = termWidth();
  const top = chalk.gray("╭" + "─".repeat(width) + "╮");
  const bottom = chalk.gray("╰" + "─".repeat(width) + "╯");
  const mid = chalk.gray("├" + "─".repeat(width) + "┤");

  const title = chalk.bold.hex(ACCENT)("ZCode") + chalk.bold(" Agent") + chalk.gray("  v" + VERSION);
  const titlePlainLen = ("ZCode Agent  v" + VERSION).length;
  const subtitle = "the AI agent in your terminal, powered by 9router";

  console.log();
  console.log(top);
  // baris judul (dipusatkan berdasarkan panjang teks polos)
  const titlePad = Math.max(0, width - titlePlainLen);
  const titleLeft = Math.floor(titlePad / 2);
  const titleRight = titlePad - titleLeft;
  console.log(chalk.gray("│") + " ".repeat(titleLeft) + title + " ".repeat(titleRight) + chalk.gray("│"));

  const subPad = Math.max(0, width - subtitle.length);
  const subLeft = Math.floor(subPad / 2);
  const subRight = subPad - subLeft;
  console.log(chalk.gray("│") + chalk.gray(" ".repeat(subLeft) + subtitle + " ".repeat(subRight)) + chalk.gray("│"));

  console.log(mid);

  const rows = [
    ["model", model ? chalk.white(model) : chalk.yellow("not set — type /model")],
    ["router", chalk.white(baseUrl || "not set")],
    ["dir", chalk.white(shortenPath(process.cwd()))],
  ];
  for (const [label, coloredValue] of rows) {
    const plainLabel = `  ${label.padEnd(7)}`;
    const plainValueLen = coloredValue.replace(/\u001b\[[0-9;]*m/g, "").length;
    const pad = Math.max(0, width - (plainLabel.length + plainValueLen));
    console.log(chalk.gray("│") + chalk.gray(plainLabel) + coloredValue + " ".repeat(pad) + chalk.gray("│"));
  }

  console.log(bottom);
  console.log(chalk.gray("  type a message and hit Enter · ") + chalk.cyan("/") + chalk.gray(" for the command list"));
  console.log();
}

function shortenPath(p) {
  const home = process.env.HOME || "";
  if (home && p.startsWith(home)) return "~" + p.slice(home.length);
  return p;
}

export function printHelp() {
  console.log();
  console.log(chalk.bold("Available commands:"));
  for (const { name, desc } of COMMANDS) {
    console.log(`  ${chalk.cyan(name.padEnd(16))} ${chalk.gray(desc)}`);
  }
  console.log();
  console.log(chalk.gray("Tip: type \"/\" and keep typing to filter the command list, ↑↓ to move, Tab/Enter to use."));
  console.log();
}

export function agentPrefix() {
  return chalk.hex(ACCENT).bold("● zcode");
}

export function userPrefix() {
  return chalk.blue.bold("you");
}

export function errorText(msg) {
  return chalk.red(`✖ ${msg}`);
}

export function infoText(msg) {
  return chalk.gray(msg);
}

export function successText(msg) {
  return chalk.green(`✔ ${msg}`);
}

export { VERSION, ACCENT };
