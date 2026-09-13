import chalk from "chalk";
import { getOrCreateConfig, saveConfig, DEFAULTS } from "./config.js";
import { runSetup } from "./setup.js";
import { streamChat, listModels, collapseModelVariants } from "./api.js";
import { selectFromList } from "./select.js";
import { promptInput } from "./promptInput.js";
import { printHelp, userPrefix, VERSION, COMMANDS } from "./ui.js";
import { renderFrame, enterFullscreen, leaveFullscreen, headerLine, terminalSize, wrapPlain, displayWidth } from "./tui.js";

const SYSTEM_PROMPT =
  "You are ZCode, an AI coding assistant running in the terminal. Be precise, practical, and concise by default. When code is requested, prefer complete usable code over vague advice.";
const MAX_NOTICES = 60;
const MAX_HISTORY = 100;

function pushNotice(notices, text, kind = "info") {
  notices.push({ text: String(text), kind });
  if (notices.length > MAX_NOTICES) notices.splice(0, notices.length - MAX_NOTICES);
}

function formatNotice({ text, kind }) {
  if (kind === "error") return chalk.red(`✖ ${text}`);
  if (kind === "success") return chalk.green(`✔ ${text}`);
  return chalk.gray(text);
}

function fitPrompt(promptLabel, input, cursor, cols) {
  const prefix = `${promptLabel} `;
  const prefixWidth = displayWidth(prefix);
  const available = Math.max(4, cols - prefixWidth);
  const inputChars = Array.from(input);
  let start = 0;
  let used = 0;

  for (let i = cursor - 1; i >= 0; i -= 1) {
    const w = displayWidth(inputChars[i] || "");
    if (used + w > Math.max(1, available - 1)) {
      start = i + 1;
      break;
    }
    used += w;
    start = i;
  }

  let visible = "";
  let visibleWidth = 0;
  for (let i = start; i < inputChars.length; i += 1) {
    const w = displayWidth(inputChars[i]);
    if (visibleWidth + w > available) break;
    visible += inputChars[i];
    visibleWidth += w;
  }

  const visibleCursor = displayWidth(inputChars.slice(start, cursor).join(""));
  const line = `${prefix}${visible}`;
  return { line, col: Math.min(cols, prefixWidth + visibleCursor + 1) };
}

function renderConversation(config, messages, notices, {
  input = "",
  cursor = 0,
  promptLabel = "you ›",
  menuOpen = false,
  menuIndex = 0,
  filtered = [],
  maxMenuItems = 8,
  statusText = "Enter to send · ↑↓ history · / commands · Ctrl+C quit",
  busy = false,
} = {}) {
  const { cols, rows } = terminalSize();
  const contentRows = Math.max(3, rows - 1); // reserve one footer row
  const menuItems = menuOpen ? filtered.slice(0, maxMenuItems) : [];
  const menuCount = menuItems.length + (filtered.length > maxMenuItems ? 1 : 0);
  const fixedBottom = 2; // prompt + status
  const bodyCapacity = Math.max(1, contentRows - fixedBottom - (menuCount ? menuCount + 1 : 0));
  const width = Math.max(12, cols - 4);

  const body = [];
  body.push(headerLine({ model: config.model, version: VERSION, busy }));
  body.push(chalk.gray("─".repeat(cols)));

  const transcript = messages.filter((message) => message.role !== "system");
  if (!transcript.length) {
    body.push("");
    body.push(chalk.bold.hex("#F2A24C")("Welcome to ZCode"));
    body.push(chalk.gray("Terminal AI assistant · 9router · model agnostic"));
    body.push("");
    body.push(chalk.gray("Type a message to start. Type / for commands."));
  } else {
    for (const message of transcript) {
      const isUser = message.role === "user";
      const label = isUser ? chalk.blue.bold("you") : chalk.hex("#F2A24C").bold("● zcode");
      body.push(label);
      for (const line of wrapPlain(message.content || "", width)) body.push(`  ${line}`);
      body.push("");
    }
  }

  for (const notice of notices) body.push(formatNotice(notice));

  const visibleBody = body.slice(-bodyCapacity);
  const frame = Array.from({ length: bodyCapacity }, (_, index) => visibleBody[index] || "");

  if (menuCount) {
    frame.push("");
    for (let i = 0; i < menuItems.length; i += 1) {
      const command = menuItems[i];
      const selected = i === menuIndex;
      const marker = selected ? chalk.hex("#F2A24C")("❯ ") : "  ";
      const name = selected ? chalk.bold.white(command.name) : chalk.cyan(command.name);
      frame.push(`${marker}${name}  ${chalk.gray(command.desc)}`);
    }
    if (filtered.length > maxMenuItems) {
      frame.push(chalk.gray(`  … ${filtered.length - maxMenuItems} more — keep typing to filter`));
    }
  }

  const prompt = fitPrompt(promptLabel, input, cursor, cols);
  frame.push(chalk.gray(statusText));
  frame.push(prompt.line);

  // Put the prompt on the last content row and the status immediately above it.
  // drawFullscreen keeps one footer row reserved.
  const footer = chalk.gray(`ZCode ${VERSION} · ${config.model || "no model"} · ${busy ? "working" : "ready"}`);
  renderFrame(frame.slice(-contentRows), {
    footer,
    cursor: busy ? null : { row: contentRows, col: prompt.col },
  });
}

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

  let config = getOrCreateConfig();
  const firstRun = !config;
  if (!config) {
    config = { ...DEFAULTS, model: "" };
    saveConfig(config);
  }

  const messages = [{ role: "system", content: SYSTEM_PROMPT }];
  const history = [];
  const notices = [];
  let fullscreen = false;

  const render = (state = {}) => renderConversation(config, messages, notices, state);
  const safeExit = () => {
    if (fullscreen) {
      leaveFullscreen();
      fullscreen = false;
    }
  };

  process.on("SIGINT", () => {
    safeExit();
    process.exit(0);
  });

  if (process.stdin.isTTY && process.stdout.isTTY) {
    enterFullscreen();
    fullscreen = true;
  }

  if (firstRun) pushNotice(notices, "First run: select a model with /model or send a message to choose one.");
  render();

  try {
    while (true) {
      let input;
      try {
        input = await promptInput({
          promptLabel: `${userPrefix()} ›`,
          history,
          renderFrame: render,
        });
      } catch (error) {
        pushNotice(notices, error.message, "error");
        render();
        break;
      }

      if (input === null) break;
      if (!input.trim()) continue;

      history.push(input);
      if (history.length > MAX_HISTORY) history.shift();

      const normalized = input.trim();
      if (normalized.startsWith("/")) {
        const result = await handleCommand(normalized, { config, messages, history, notices, fullscreen });
        if (result === "exit") break;
        if (result?.config) config = result.config;
        if (result?.fullscreen !== undefined) fullscreen = result.fullscreen;
        render();
        continue;
      }

      if (!config.model) {
        const picked = await pickModelInteractive(config);
        if (!picked) {
          pushNotice(notices, "No model selected. Message was not sent.", "error");
          render();
          continue;
        }
      }

      messages.push({ role: "user", content: input });
      render({ busy: true, statusText: "Thinking…" });

      let reply = "";
      try {
        for await (const chunk of streamChat({
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          model: config.model,
          messages,
        })) {
          reply += chunk;
          renderConversation(config, [...messages, { role: "assistant", content: reply }], notices, {
            busy: true,
            statusText: "Receiving response…",
          });
        }
      } catch (error) {
        messages.pop();
        pushNotice(notices, error.message, "error");
        render();
        continue;
      }

      messages.push({ role: "assistant", content: reply || "(empty response)" });
      render();
    }
  } finally {
    safeExit();
  }

  console.log(chalk.gray("Bye.\n"));
}

async function handleCommand(input, { config, messages, history, notices, fullscreen }) {
  const parts = input.slice(1).trim().split(/\s+/);
  const command = (parts.shift() || "").toLowerCase();
  const argument = parts.join(" ").trim();

  switch (command) {
    case "exit":
    case "quit":
      return "exit";

    case "help":
      notices.length = 0;
      pushNotice(notices, "Available commands:");
      for (const item of COMMANDS) pushNotice(notices, `${item.name.padEnd(12)} ${item.desc}`);
      return;

    case "clear":
      messages.length = 1;
      notices.length = 0;
      return;

    case "model":
      if (argument) {
        config.model = argument;
        saveConfig(config);
        pushNotice(notices, `Model switched to: ${argument}`, "success");
      } else {
        await pickModelInteractive(config);
      }
      return { config };

    case "models":
      try {
        const models = await listModels(config.baseUrl, config.apiKey);
        notices.length = 0;
        if (!models.length) pushNotice(notices, "The router returned no models.");
        else models.forEach((model) => pushNotice(notices, `${model === config.model ? "● " : "  "}${model}`));
      } catch (error) {
        pushNotice(notices, `Could not fetch models: ${error.message}`, "error");
      }
      return { config };

    case "config": {
      if (fullscreen) leaveFullscreen();
      const next = await runSetup(config);
      Object.assign(config, next);
      if (fullscreen) enterFullscreen();
      pushNotice(notices, "Configuration saved.", "success");
      return { config, fullscreen };
    }

    default:
      pushNotice(notices, `Unknown command: /${command}. Type / for the command palette.`, "error");
      return { config };
  }
}

async function pickModelInteractive(config) {
  let models;
  try {
    models = await listModels(config.baseUrl, config.apiKey);
  } catch {
    return null;
  }
  if (!models.length) return null;

  const collapsed = collapseModelVariants(models);
  const hiddenCount = models.length - collapsed.length;
  const selected = await selectFromList(collapsed, {
    message: "Select a model",
    current: config.model,
    footerNote: hiddenCount ? `${hiddenCount} variants hidden. Use /models to see the full list.` : null,
  });
  if (!selected) return null;

  config.model = selected;
  saveConfig(config);
  return selected;
}
