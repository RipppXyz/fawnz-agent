import readline from "node:readline";
import chalk from "chalk";
import { saveConfig } from "./config.js";
import { listModels, testConnection, collapseModelVariants } from "./api.js";
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

// Nama-nama env var umum yang mungkin sudah diisi user buat tool lain —
// kalau salah satu ketemu, pakai itu sebagai default API key biar user
// gak perlu ngetik ulang manual tiap /config. Ini cuma DEFAULT/prefill,
// user tetap bisa timpa lewat prompt di bawah.
function detectApiKeyFromEnv() {
  return (
    process.env.ZCODE_API_KEY ||
    process.env.NINEROUTER_API_KEY ||
    process.env.ROUTER_API_KEY ||
    process.env.OPENROUTER_API_KEY ||
    ""
  );
}

/**
 * Wizard setup manual, dipakai oleh perintah /config. Nilai yang sudah
 * ada dipakai sebagai default supaya user tinggal pencet Enter kalau
 * tidak ada yang mau diubah.
 *
 * API key TIDAK selalu ditanya lagi: kalau router yang dituju bisa
 * dihubungi tanpa key (server lokal tanpa auth) atau kalau ada env var
 * yang cocok (lihat detectApiKeyFromEnv), itu langsung dipakai otomatis
 * dan prompt-nya dilewat.
 */
export async function runSetup(current = {}) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log();
  console.log(chalk.bold("ZCode Agent setup"));
  console.log(infoText("Press Enter to keep the current value.\n"));

  const baseUrl = await ask(rl, "9router base URL", current.baseUrl);

  let apiKey = current.apiKey || detectApiKeyFromEnv();
  console.log(infoText("\nChecking the router..."));
  let reachable = false;
  try {
    await testConnection(baseUrl, apiKey);
    reachable = true;
  } catch {
    reachable = false;
  }

  if (reachable) {
    if (apiKey) console.log(successText("Router reachable — using the API key found locally, no need to type it."));
    else console.log(successText("Router reachable without an API key — skipping that step."));
  } else {
    apiKey = await ask(rl, "9router API key", apiKey);
  }

  console.log(infoText("\nFetching models..."));

  let models = [];
  try {
    models = await listModels(baseUrl, apiKey);
  } catch (err) {
    console.log(errorText(`Couldn't connect to the router: ${err.message}`));
    console.log(infoText("You can still continue and type the model name manually.\n"));
  }

  let model = current.model || "";
  if (models.length > 0) {
    const menuModels = collapseModelVariants(models);
    const hiddenCount = models.length - menuModels.length;
    console.log(successText(`Found ${models.length} model${models.length === 1 ? "" : "s"}.`));
    rl.pause();
    const picked = await selectFromList(menuModels, {
      message: "Search & pick a model:",
      current: model,
      footerNote:
        hiddenCount > 0
          ? `${hiddenCount} variant${hiddenCount === 1 ? "" : "s"} (:batch, :free, …) hidden — see /models for the full list`
          : null,
    });
    rl.resume();
    if (picked) model = picked;
  }

  while (!model) {
    model = await ask(rl, "Model name to use");
  }

  rl.close();

  const config = { baseUrl, apiKey, model };
  saveConfig(config);
  console.log(successText("Config saved to ~/.zcode/config.json\n"));
  return config;
}
