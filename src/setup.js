import readline from "node:readline";
import chalk from "chalk";
import { saveConfig } from "./config.js";
import { listModels, testConnection, collapseModelVariants } from "./api.js";
import { selectFromList } from "./select.js";
import { errorText, successText, infoText } from "./ui.js";

function ask(rl, question, fallback = "") {
  const suffix = fallback ? chalk.gray(` (${fallback})`) : "";
  return new Promise((resolve) => {
    rl.question(`${question}${suffix}: `, (answer) => resolve(answer.trim() || fallback || ""));
  });
}

function detectApiKey() {
  return (
    process.env.ZCODE_API_KEY ||
    process.env.NINEROUTER_API_KEY ||
    process.env.ROUTER_API_KEY ||
    process.env.OPENROUTER_API_KEY ||
    ""
  );
}

export async function runSetup(current = {}) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log();
  console.log(chalk.bold("ZCode configuration"));
  console.log(infoText("Press Enter to keep the current value.\n"));

  const baseUrl = await ask(rl, "9router base URL", current.baseUrl);
  let apiKey = current.apiKey || detectApiKey();

  console.log(infoText("\nChecking the router…"));
  try {
    await testConnection(baseUrl, apiKey);
    console.log(successText("Router is reachable."));
  } catch {
    apiKey = await ask(rl, "9router API key", apiKey);
  }

  console.log(infoText("\nFetching models…"));
  let models = [];
  try {
    models = await listModels(baseUrl, apiKey);
  } catch (error) {
    console.log(errorText(`Could not fetch models: ${error.message}`));
    console.log(infoText("You can enter a model name manually.\n"));
  }

  let model = current.model || "";
  if (models.length) {
    const visibleModels = collapseModelVariants(models);
    const hiddenCount = models.length - visibleModels.length;
    const picked = await selectFromList(visibleModels, {
      message: "Select a model",
      current: model,
      footerNote: hiddenCount ? `${hiddenCount} variants hidden; /models shows the complete list.` : null,
    });
    if (picked) model = picked;
  }

  while (!model) model = await ask(rl, "Model name");
  rl.close();

  const next = { baseUrl, apiKey, model };
  saveConfig(next);
  console.log(successText("Configuration saved.\n"));
  return next;
}
