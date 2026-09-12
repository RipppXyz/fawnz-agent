import chalk from "chalk";
import { getOrCreateConfig, saveConfig, DEFAULTS } from "./config.js";
import { runSetup } from "./setup.js";
import { streamChat, listModels } from "./api.js";
import { selectFromList } from "./select.js";
import { promptInput } from "./promptInput.js";
import { startSpinner, stopSpinner } from "./spinner.js";
import {
  printBanner,
  printBootAnimation,
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

  // ZCode TIDAK menyuruh user ngisi form base url/api key/model sebelum
  // bisa ngobrol — begitu dijalankan, langsung masuk layar chat (kayak
  // Claude Code / Claude), persis sama baik ini run pertama kali atau
  // yang ke-seratus. Belum ada config sama sekali? Buat default diam-diam
  // (localhost:20128, tanpa api key, model kosong) dan langsung lanjut.
  // Model TETAP tidak ditebak/di-hardcode — kalau kosong, banner bakal
  // bilang "ketik /model", dan begitu user coba kirim pesan pertama,
  // menu pilih model otomatis kebuka (lihat pickModelInteractive di bawah).
  let config = getOrCreateConfig();
  const isFirstRun = !config;
  if (!config) {
    config = { baseUrl: DEFAULTS.baseUrl, apiKey: DEFAULTS.apiKey, model: DEFAULTS.model || "" };
    saveConfig(config);
  }

  if (args.includes("--config")) {
    config = await runSetup(config);
  }

  const messages = [{ role: "system", content: SYSTEM_PROMPT }];
  const history = [];

  await printBootAnimation();
  printBanner({ model: config.model, baseUrl: config.baseUrl });

  if (isFirstRun) {
    console.log(
      infoText(
        "  Langsung ketik aja buat mulai ngobrol. Belum ada model diset — begitu kamu kirim pesan pertama,\n" +
          "  ZCode otomatis buka menu pilih model dari 9router. Ganti kapan saja dengan " +
          chalk.cyan("/model") +
          ".\n"
      )
    );
  }

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

    // Belum ada model diset — jangan nolak pesannya, langsung bukain
    // menu pilih model dulu di tempat, biar alurnya nyambung kayak
    // ngobrol biasa, bukan error yang motong flow.
    if (!config.model) {
      const picked = await pickModelInteractive(config);
      if (!picked) {
        console.log(infoText("  Belum pilih model, pesan tadi belum dikirim. Coba lagi kapan siap.\n"));
        continue;
      }
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
    console.log(errorText(`Gagal ambil daftar model: ${err.message}`));
    console.log(infoText("  Cek Base URL / API key router-nya dengan /config.\n"));
    return null;
  }

  if (models.length === 0) {
    console.log(errorText("Router tidak mengembalikan model apapun.\n"));
    return null;
  }

  const picked = await selectFromList(models, {
    message: "Cari & pilih model:",
    current: config.model,
  });

  if (picked) {
    config.model = picked;
    saveConfig(config);
    console.log(successText(`Model diganti ke: ${picked}\n`));
    return picked;
  }

  console.log(infoText("Dibatalkan, model tidak diganti.\n"));
  return null;
}
