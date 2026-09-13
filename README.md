<div align="center">
  <img src="https://github.com/Anmol-Baranwal/Cool-GIFs-For-GitHub/assets/74038190/0c7eb6ed-663b-4ce4-bfbd-18239a38ba1b" width="500">
</div>
# FawnZ Agent

A terminal AI assistant built around an OpenAI-compatible 9router endpoint.

[![npm](https://img.shields.io/npm/v/fawnz.svg)](https://www.npmjs.com/package/fawnz)
[![node](https://img.shields.io/node/v/fawnz.svg)](https://nodejs.org)
[![license](https://img.shields.io/npm/l/fawnz.svg)](./LICENSE)

</div>

FawnZ is a small terminal client for 9router. It keeps the model choice outside the app, streams responses, and uses a fullscreen terminal interface instead of printing a new screen for every command.

## Requirements

- Node.js 18 or newer
- An OpenAI-compatible 9router instance
- A terminal with TTY support for the fullscreen interface

FawnZ also runs without a TTY, but interactive features are limited in that mode.

## Install

### npm

```bash
npm install -g fawnz@latest
fawnz
```

### From source

```bash
git clone https://github.com/RipppXyz/fawnz-agent.git
cd fawnz-agent
npm install
npm link
fawnz
```

### Termux

```bash
pkg update
pkg install nodejs git
npm install -g fawnz@latest
fawnz
```

## First run

FawnZ defaults to `http://localhost:20128/v1` and will ask for a model when one is not configured.

You can also configure it with environment variables:

```bash
export FAWNZ_BASE_URL="http://localhost:20128/v1"
export FAWNZ_API_KEY=""
export FAWNZ_MODEL="your-model-id"
fawnz
```

Configuration is stored in:

```text
~/.fawnz/config.json
```

The file is created with private permissions. API keys are not printed by FawnZ.

## Commands

Inside FawnZ, type `/` to open the command palette.

| Command | Action |
| --- | --- |
| `/help` | Show the command list |
| `/model` | Open the model picker |
| `/model <id>` | Switch models directly |
| `/models` | Fetch the current model list from 9router |
| `/clear` | Clear the current conversation |
| `/config` | Change the 9router URL, key, or model |
| `/exit` | Exit |
| `/quit` | Exit |

Input controls:

- `↑` / `↓`: command navigation or input history
- `Tab`: accept the highlighted command
- `Enter`: run a command or send a message
- `Esc`: close the command palette
- `Home` / `End`: move the input cursor
- `Ctrl+C` / `Ctrl+D`: exit
- `Ctrl+L`: redraw the current screen

## Fullscreen terminal UI

The UI uses the terminal's alternate screen buffer and redraws one deterministic frame. This matters for long responses, command completion, terminal resizing, and terminals where old output would otherwise be left behind.

The renderer also accounts for wide Unicode characters when calculating visible columns. Input is horizontally scrolled when it is wider than the terminal so the cursor stays visible.

The model picker has its own bounded viewport and reacts to terminal resize events.

## 9router

FawnZ sends requests to:

```text
POST /v1/chat/completions
GET  /v1/models
```

The chat request uses the OpenAI-style `messages`, `model`, and `stream` fields. Streaming responses are read as SSE when the router returns `text/event-stream`; JSON responses are also accepted as a fallback.

FawnZ does not contain a hardcoded model catalog. The model list comes from the configured router.

## Updating a Codespace

Codespaces can keep an older checkout or an older globally installed npm package. Use one of these paths depending on how FawnZ was installed.

### Installed from npm

Run this in the Codespaces terminal:

```bash
npm cache verify
npm install -g fawnz@latest --force
hash -r
which fawnz
fawnz --version
```

The important part is `@latest`. Reinstalling `fawnz` without it can leave you on an older cached/versioned install.

### Running from the GitHub repository

Use the remote repository as the source of truth instead of cloning the repo again:

```bash
cd ~/fawnz-agent
git fetch --all --prune
BRANCH="$(git remote show origin | sed -n '/HEAD branch/s/.*: //p')"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"
npm install
npm link
hash -r
fawnz --version
```

This intentionally discards local changes in the repository checkout. Use normal `git pull` instead when you need to keep local work.

### One-line refresh

```bash
npm install -g fawnz@latest --force && hash -r && fawnz --version
```

## Publishing a release

FawnZ is a public package. A publish requires an authenticated npm account that has publish access to `fawnz`.

```bash
npm login
npm publish --access public
```

For a release from a clean checkout:

```bash
git pull --ff-only
npm install
npm test
npm publish --access public
```

Do not run `npm version` after the package version has already been published. npm does not allow the same version to be published twice.

## Development

```bash
npm install
npm test
npm start
```

The test suite covers model-list parsing, streamed SSE parsing, Unicode width handling, wrapping, and line clipping.

## Project layout

```text
fawnz-agent/
├── bin/
│   └── fawnz.js
├── src/
│   ├── api.js
│   ├── chat.js
│   ├── config.js
│   ├── promptInput.js
│   ├── select.js
│   ├── setup.js
│   ├── spinner.js
│   ├── tui.js
│   └── ui.js
├── test/
│   ├── api.test.js
│   └── tui.test.js
├── install.sh
├── update.sh
├── package.json
└── README.md
```

## What FawnZ is today

FawnZ v2.0.9 is a terminal AI assistant and router client. It is not a drop-in clone of Anthropic's Claude Code and does not currently reproduce Claude Code's private agent runtime, tool ecosystem, or product behavior.

The project is intentionally kept small so the terminal layer can stay predictable while 9router handles model selection and provider routing.

## License

MIT
