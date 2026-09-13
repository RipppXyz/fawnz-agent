import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const CONFIG_DIR = path.join(os.homedir(), ".fawnz");
const LEGACY_CONFIG_DIR = path.join(os.homedir(), ".zcode");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");
const LEGACY_CONFIG_FILE = path.join(LEGACY_CONFIG_DIR, "config.json");
const HISTORY_FILE = path.join(CONFIG_DIR, "history.json");

const DEFAULTS = {
  baseUrl: process.env.FAWNZ_BASE_URL || process.env.ZCODE_BASE_URL || "http://localhost:20128/v1",
  apiKey:
    process.env.FAWNZ_API_KEY ||
    process.env.ZCODE_API_KEY ||
    process.env.NINEROUTER_API_KEY ||
    process.env.ROUTER_API_KEY ||
    process.env.OPENROUTER_API_KEY ||
    "",
  model: process.env.FAWNZ_MODEL || process.env.ZCODE_MODEL || "",
  // Optional: what to show in the UI instead of the raw model id (e.g. hide
  // the underlying provider name). Falls back to a humanized `model` when empty.
  displayModel: process.env.FAWNZ_MODEL_LABEL || "",
};

function ensureDir() {
  fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
}

function normalizeConfig(config = {}) {
  return {
    baseUrl: String(config.baseUrl || DEFAULTS.baseUrl).trim() || DEFAULTS.baseUrl,
    apiKey: String(config.apiKey ?? DEFAULTS.apiKey),
    model: String(config.model ?? DEFAULTS.model).trim(),
    displayModel: String(config.displayModel ?? DEFAULTS.displayModel ?? "").trim(),
  };
}

export function configExists() {
  return fs.existsSync(CONFIG_FILE) || fs.existsSync(LEGACY_CONFIG_FILE);
}

export function loadConfig() {
  // Baca dari lokasi baru dulu (~/.fawnz). Kalau belum ada tapi config
  // lama dari sebelum rename (~/.zcode, jaman masih bernama "zcode")
  // masih ada, pakai itu supaya user yang upgrade gak kehilangan
  // baseUrl/apiKey/model yang udah pernah mereka set.
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      return normalizeConfig(JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8")));
    } catch {
      return null;
    }
  }
  if (fs.existsSync(LEGACY_CONFIG_FILE)) {
    try {
      const migrated = normalizeConfig(JSON.parse(fs.readFileSync(LEGACY_CONFIG_FILE, "utf8")));
      saveConfig(migrated); // pindahin sekali ke ~/.fawnz biar run berikutnya gak perlu baca lokasi lama lagi
      return migrated;
    } catch {
      return null;
    }
  }
  return null;
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
