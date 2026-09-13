import chalk from "chalk";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ACCENT = "#F2A24C";

function readVersion() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8")).version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

export const VERSION = readVersion();

export const COMMANDS = [
  { name: "/help", desc: "show available commands" },
  { name: "/model", desc: "open the model picker" },
  { name: "/models", desc: "list models reported by the router" },
  { name: "/clear", desc: "clear the current conversation" },
  { name: "/config", desc: "edit the router configuration" },
  { name: "/exit", desc: "exit FawnZ" },
  { name: "/quit", desc: "same as /exit" },
];

export function printHelp() {
  console.log();
  console.log(chalk.bold("FawnZ Agent"));
  console.log(chalk.gray("AI assistant for the terminal, routed through an OpenAI-compatible 9router endpoint."));
  console.log();
  for (const command of COMMANDS) {
    console.log(`  ${chalk.cyan(command.name.padEnd(12))}${chalk.gray(command.desc)}`);
  }
  console.log();
  console.log(chalk.gray("Usage: fawnz | fawnz --config | fawnz --version"));
  console.log();
}

export function userPrefix() {
  return chalk.blue.bold("you");
}

export function errorText(message) {
  return chalk.red(`✖ ${message}`);
}

export function infoText(message) {
  return chalk.gray(message);
}

export function successText(message) {
  return chalk.green(`✔ ${message}`);
}

export { ACCENT };
