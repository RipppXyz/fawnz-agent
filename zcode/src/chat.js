import chalk from "chalk";
import { getOrCreateConfig, saveConfig, DEFAULTS } from "./config.js";
import { runSetup } from "./setup.js";
import { streamChat, listModels, collapseModelVariants } from "./api.js";
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
  "You are ZCode, an AI agent running in the terminal to help with coding and everyday tasks. Answer briefly, clearly, and to the point unless the user asks for more detail.";

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
        "  Just start typing to chat. No model is set yet — as soon as you send your first\n" +
          "  message, ZCode will open the model picker from 9router. Change it anytime with " +
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
        console.log(infoText("  No model picked, that message wasn't sent. Try again whenever you're ready.\n"));
        continue;
      }
    }

    messages.push({ role: "user", content: input });

    const spinner = startSpinner("thinking");
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

  console.log(chalk.gray("\nBye.\n"));
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
      console.log(successText("Conversation history cleared.\n"));
      return;

    case "model":
      if (arg) {
        config.model = arg;
        saveConfig(config);
        console.log(successText(`Model switched to: ${arg}\n`));
        return { config };
      }
      await pickModelInteractive(config);
      return { config };

    case "models":
      try {
        const models = await listModels(config.baseUrl, config.apiKey);
        console.log();
        if (models.length === 0) {
          console.log(infoText("  (the router didn't return any models)"));
        }
        models.forEach((m) =>
          console.log(`  ${m === config.model ? chalk.green("● " + m) : "  " + m}`)
        );
        console.log();
      } catch (err) {
        console.log(errorText(`Couldn't fetch the model list: ${err.message}\n`));
      }
      return;

    case "config": {
      const newConfig = await runSetup(config);
      Object.assign(config, newConfig);
      return { config };
    }

    default:
      console.log(errorText(`Unknown command: /${cmd}. Type / to see the command list.\n`));
      return;
  }
}

async function pickModelInteractive(config) {
  console.log(infoText("Fetching the model list from 9router..."));
  let models = [];
  try {
    models = await listModels(config.baseUrl, config.apiKey);
  } catch (err) {
    console.log(errorText(`Couldn't fetch the model list: ${err.message}`));
    console.log(infoText("  Check the router's Base URL / API key with /config.\n"));
    return null;
  }

  if (models.length === 0) {
    console.log(errorText("The router didn't return any models.\n"));
    return null;
  }

  // Combo cuma nunjukin satu baris per model dasar (varian ":batch" dkk
  // disaring) supaya gampang dicari — lihat collapseModelVariants di
  // api.js. Daftar mentah lengkapnya tetap bisa dilihat lewat /models.
  const menuModels = collapseModelVariants(models);
  const hiddenCount = models.length - menuModels.length;

  const picked = await selectFromList(menuModels, {
    message: "Search & pick a model:",
    current: config.model,
    footerNote:
      hiddenCount > 0
        ? `${hiddenCount} variant${hiddenCount === 1 ? "" : "s"} (:batch, :free, …) hidden — see /models for the full list`
        : null,
  });

  if (picked) {
    config.model = picked;
    saveConfig(config);
    console.log(successText(`Model switched to: ${picked}\n`));
    return picked;
  }

  console.log(infoText("Cancelled, model unchanged.\n"));
  return null;
}
