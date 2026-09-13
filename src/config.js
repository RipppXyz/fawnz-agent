import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const CONFIG_DIR = path.join(os.homedir(), ".zcode");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");
const HISTORY_FILE = path.join(CONFIG_DIR, "history.json");

const DEFAULTS = {
  baseUrl: process.env.ZCODE_BASE_URL || "http://localhost:20128/v1",
  apiKey:
    process.env.ZCODE_API_KEY ||
    process.env.NINEROUTER_API_KEY ||
    process.env.ROUTER_API_KEY ||
    process.env.OPENROUTER_API_KEY ||
    "",
  model: process.env.ZCODE_MODEL || "",
};

function ensureDir() {
  fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
}

function normalizeConfig(config = {}) {
  return {
    baseUrl: String(config.baseUrl || DEFAULTS.baseUrl).trim() || DEFAULTS.baseUrl,
    apiKey: String(config.apiKey ?? DEFAULTS.apiKey),
    model: String(config.model ?? DEFAULTS.model).trim(),
  };
}

export function configExists() {
  return fs.existsSync(CONFIG_FILE);
}

export function loadConfig() {
  if (!configExists()) return null;
  try {
    return normalizeConfig(JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8")));
  } catch {
    return null;
  }
}

export function getOrCreateConfig() {
  const existing = loadConfig();
  if (existing) return existing;
  if (!DEFAULTS.model) return null;
  const fresh = normalizeConfig(DEFAULTS);
  saveConfig(fresh);
  return fresh;
}

export function saveConfig(config) {
  ensureDir();
  const normalized = normalizeConfig(config);
  const temp = `${CONFIG_FILE}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(normalized, null, 2), { encoding: "utf8", mode: 0o600 });
  fs.renameSync(temp, CONFIG_FILE);
}

export function deleteConfig() {
  if (configExists()) fs.unlinkSync(CONFIG_FILE);
}

export function saveLastSession(messages) {
  ensureDir();
  try {
    const temp = `${HISTORY_FILE}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(messages, null, 2), { encoding: "utf8", mode: 0o600 });
    fs.renameSync(temp, HISTORY_FILE);
  } catch {
    // Session history is optional; never crash the CLI because persistence failed.
  }
}

export function loadLastSession() {
  if (!fs.existsSync(HISTORY_FILE)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export { CONFIG_DIR, CONFIG_FILE, DEFAULTS };
