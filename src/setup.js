import readline from "node:readline";
import chalk from "chalk";
import { saveConfig } from "./config.js";
import { listModels } from "./api.js";
import { selectFromList } from "./select.js";
import { errorText, successText, infoText } from "./ui.js";

function ask(rl, question, def) {
  const suffix = def ? chalk.gray(` (${def})`) : "";
  return new Promise((resolve) => {
    rl.question(`${question}${suffix}: `, (answer) => {
      resolve(answer.trim() || def || "");
    });
  });
}

/**
 * Wizard setup manual, dipakai oleh perintah /config. Nilai yang sudah
 * ada dipakai sebagai default supaya user tinggal pencet Enter kalau
 * tidak ada yang mau diubah.
 */
export async function runSetup(current = {}) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log();
  console.log(chalk.bold("Setup ZCode Agent"));
  console.log(infoText("Enter kosong = pakai nilai yang sedang aktif.\n"));

  const baseUrl = await ask(rl, "Base URL 9router", current.baseUrl);
  const apiKey = await ask(rl, "API key 9router", current.apiKey);

  console.log(infoText("\nMenghubungi router..."));

  let models = [];
  try {
    models = await listModels(baseUrl, apiKey);
  } catch (err) {
    console.log(errorText(`Gagal konek ke router: ${err.message}`));
    console.log(infoText("Kamu tetap bisa lanjut dan isi nama model secara manual.\n"));
  }

  let model = current.model || "";
  if (models.length > 0) {
    console.log(successText(`Ditemukan ${models.length} model.`));
    rl.pause();
    const picked = await selectFromList(models, {
      message: "Cari & pilih model:",
      current: model,
    });
    rl.resume();
    if (picked) model = picked;
  }

  while (!model) {
    model = await ask(rl, "Nama model yang mau dipakai");
  }

  rl.close();

  const config = { baseUrl, apiKey, model };
  saveConfig(config);
  console.log(successText("Konfigurasi tersimpan di ~/.zcode/config.json\n"));
  return config;
}
