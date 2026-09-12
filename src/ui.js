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
  { name: "/help", desc: "tampilkan bantuan ini" },
  { name: "/model", desc: "buka menu pilih model (panah ↑↓, ketik untuk cari)" },
  { name: "/models", desc: "lihat daftar model dari router sebagai teks" },
  { name: "/clear", desc: "kosongkan riwayat percakapan" },
  { name: "/config", desc: "ulangi setup (base url / api key / model)" },
  { name: "/exit", desc: "keluar dari ZCode" },
  { name: "/quit", desc: "sama seperti /exit" },
];

function termWidth() {
  const cols = process.stdout.columns || 80;
  return Math.max(40, Math.min(cols - 2, 96));
}

export function printBanner({ model, baseUrl }) {
  const width = termWidth();
  const top = chalk.gray("╭" + "─".repeat(width) + "╮");
  const bottom = chalk.gray("╰" + "─".repeat(width) + "╯");
  const mid = chalk.gray("├" + "─".repeat(width) + "┤");

  const title = chalk.bold.hex(ACCENT)("ZCode") + chalk.bold(" Agent") + chalk.gray("  v" + VERSION);
  const titlePlainLen = ("ZCode Agent  v" + VERSION).length;
  const subtitle = "agen AI di terminal kamu, ditenagai 9router";

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
    ["model", model ? chalk.white(model) : chalk.yellow("belum diset — ketik /model")],
    ["router", chalk.white(baseUrl || "belum diset")],
    ["dir", chalk.white(shortenPath(process.cwd()))],
  ];
  for (const [label, coloredValue] of rows) {
    const plainLabel = `  ${label.padEnd(7)}`;
    const plainValueLen = coloredValue.replace(/\u001b\[[0-9;]*m/g, "").length;
    const pad = Math.max(0, width - (plainLabel.length + plainValueLen));
    console.log(chalk.gray("│") + chalk.gray(plainLabel) + coloredValue + " ".repeat(pad) + chalk.gray("│"));
  }

  console.log(bottom);
  console.log(chalk.gray("  ketik pesan lalu Enter · ") + chalk.cyan("/") + chalk.gray(" untuk daftar perintah"));
  console.log();
}

function shortenPath(p) {
  const home = process.env.HOME || "";
  if (home && p.startsWith(home)) return "~" + p.slice(home.length);
  return p;
}

export function printHelp() {
  console.log();
  console.log(chalk.bold("Perintah tersedia:"));
  for (const { name, desc } of COMMANDS) {
    console.log(`  ${chalk.cyan(name.padEnd(16))} ${chalk.gray(desc)}`);
  }
  console.log();
  console.log(chalk.gray("Tips: ketik \"/\" lalu terus ngetik untuk nyaring daftar perintah, panah ↑↓ untuk pilih, Tab/Enter untuk pakai."));
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
