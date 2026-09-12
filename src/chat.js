import chalk from "chalk";
import { getOrCreateConfig, saveConfig, DEFAULTS } from "./config.js";
import { runSetup } from "./setup.js";
import { streamChat, listModels } from "./api.js";
import { selectFromList } from "./select.js";
import { promptInput } from "./promptInput.js";
import { startSpinner, stopSpinner } from "./spinner.js";
import {
  printBanner,
  printHelp,
  agentPrefix,
  userPrefix,
  errorText,
  infoText,
  successText,
  VERSION,
} from "./ui.js";

const SYSTEM_PROMPT =
  "Kamu adalah ZCode, agen AI yang berjalan di terminal untuk membantu pekerjaan coding dan tugas sehari-hari pengguna. Jawab singkat, jelas, dan langsung ke intinya kecuali diminta detail lebih.";

export async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--version") || args.includes("-v")) {
    console.log(VERSION);
    return;
  }

  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    return;
  }

  // Kalau belum ada config tersimpan DAN belum ada ZCODE_MODEL di env,
  // ZCode tidak menebak model apapun — langsung jalankan wizard setup
  // supaya user memilih model dari daftar yang ditarik dari 9router.
  let config = getOrCreateConfig();
  if (!config) {
    console.log(infoText("\nBelum ada konfigurasi. Ayo setup dulu (sekali saja)."));
    config = await runSetup({ baseUrl: DEFAULTS.baseUrl, apiKey: DEFAULTS.apiKey, model: "" });
  }

  if (args.includes("--config")) {
    config = await runSetup(config);
  }

  const messages = [{ role: "system", content: SYSTEM_PROMPT }];
  const history = [];

  printBanner({ model: config.model, baseUrl: config.baseUrl });

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let input;
    try {
      input = (await promptInput({ promptLabel: `${userPrefix()} ›`, history })).trim();
    } catch (err) {
      console.log(errorText(err.message));
      break;
    }

    if (!input) continue;
    history.push(input);

    if (input.startsWith("/")) {
      const result = await handleCommand(input, { config, messages });
      if (result === "exit") break;
      if (result && result.config) config = result.config;
      continue;
    }

    messages.push({ role: "user", content: input });

    const spinner = startSpinner("berpikir");
    let fullReply = "";
    let wroteAnyChunk = false;

    try {
      for await (const chunk of streamChat({
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        model: config.model,
        messages,
      })) {
        if (!wroteAnyChunk) {
          stopSpinner(spinner);
          process.stdout.write(`${agentPrefix()} › `);
          wroteAnyChunk = true;
        }
        process.stdout.write(chunk);
        fullReply += chunk;
      }
      if (!wroteAnyChunk) stopSpinner(spinner);
      process.stdout.write("\n\n");
    } catch (err) {
      stopSpinner(spinner);
      console.log(errorText(err.message));
      console.log();
      messages.pop();
      continue;
    }

    messages.push({ role: "assistant", content: fullReply });
  }

  console.log(chalk.gray("\nSampai jumpa.\n"));
}

async function handleCommand(input, { config, messages }) {
  const [cmd, ...rest] = input.slice(1).split(" ");
  const arg = rest.join(" ").trim();

  switch (cmd) {
    case "exit":
    case "quit":
      return "exit";

    case "help":
      printHelp();
      return;

    case "clear":
      messages.length = 1; // sisakan system prompt
      console.log(successText("Riwayat percakapan dikosongkan.\n"));
      return;

    case "model":
      if (arg) {
        config.model = arg;
        saveConfig(config);
        console.log(successText(`Model diganti ke: ${arg}\n`));
        return { config };
      }
      await pickModelInteractive(config);
      return { config };

    case "models":
      try {
        const models = await listModels(config.baseUrl, config.apiKey);
        console.log();
        if (models.length === 0) {
          console.log(infoText("  (router tidak mengembalikan model apapun)"));
        }
        models.forEach((m) =>
          console.log(`  ${m === config.model ? chalk.green("● " + m) : "  " + m}`)
        );
        console.log();
      } catch (err) {
        console.log(errorText(`Gagal ambil daftar model: ${err.message}\n`));
      }
      return;

    case "config": {
      const newConfig = await runSetup(config);
      Object.assign(config, newConfig);
      return { config };
    }

    default:
      console.log(errorText(`Perintah tidak dikenal: /${cmd}. Ketik / untuk lihat daftar perintah.\n`));
      return;
  }
}

async function pickModelInteractive(config) {
  console.log(infoText("Mengambil daftar model dari 9router..."));
  let models = [];
  try {
    models = await listModels(config.baseUrl, config.apiKey);
  } catch (err) {
    console.log(errorText(`Gagal ambil daftar model: ${err.message}\n`));
    return;
  }

  if (models.length === 0) {
    console.log(errorText("Router tidak mengembalikan model apapun.\n"));
    return;
  }

  const picked = await selectFromList(models, {
    message: "Cari & pilih model:",
    current: config.model,
  });

  if (picked) {
    config.model = picked;
    saveConfig(config);
    console.log(successText(`Model diganti ke: ${picked}\n`));
  } else {
    console.log(infoText("Dibatalkan, model tidak diganti.\n"));
  }
}
