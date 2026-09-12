import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const CONFIG_DIR = path.join(os.homedir(), ".zcode");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");
const HISTORY_FILE = path.join(CONFIG_DIR, "history.json");

// Nilai default. baseUrl & apiKey boleh kosong/lokal karena aman untuk
// dicoba langsung. Model SENGAJA tidak di-hardcode ke model tertentu —
// ZCode tidak berasumsi model apapun, daftar model selalu ditarik
// langsung dari instance 9router kamu (lihat src/api.js -> listModels).
// Kalau ZCODE_MODEL tidak diset, user akan diminta memilih model dari
// 9router saat pertama kali menjalankan zcode.
const DEFAULTS = {
  baseUrl: process.env.ZCODE_BASE_URL || "http://localhost:20128/v1",
  apiKey: process.env.ZCODE_API_KEY || "",
  model: process.env.ZCODE_MODEL || "",
};

function ensureDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function configExists() {
  return fs.existsSync(CONFIG_FILE);
}

export function loadConfig() {
  if (!configExists()) return null;
  try {
    const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Ambil config yang sudah tersimpan. Kalau belum ada sama sekali:
 *  - kalau ZCODE_MODEL (env) sudah diisi, langsung buat config dari
 *    DEFAULTS tanpa nanya apa-apa (cocok buat automation/CI/Docker).
 *  - kalau tidak, return null supaya caller (chat.js) menjalankan
 *    wizard /config interaktif — termasuk menarik daftar model dari
 *    9router — daripada diam-diam mengunci ke satu model tertentu.
 */
export function getOrCreateConfig() {
  const existing = loadConfig();
  if (existing) return existing;
  if (!DEFAULTS.model) return null;
  const fresh = { ...DEFAULTS };
  saveConfig(fresh);
  return fresh;
}

export function saveConfig(config) {
  ensureDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
}

export function deleteConfig() {
  if (configExists()) fs.unlinkSync(CONFIG_FILE);
}

export function saveLastSession(messages) {
  ensureDir();
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(messages, null, 2), "utf-8");
  } catch {
    // gagal simpan history bukan hal fatal, diamkan saja
  }
}

export function loadLastSession() {
  if (!fs.existsSync(HISTORY_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(HISTORY_FILE, "utf-8"));
  } catch {
    return [];
  }
}

export { CONFIG_DIR, CONFIG_FILE, DEFAULTS };
