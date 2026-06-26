# interm-ops

One-command installer for [**interm-ops**](https://github.com/santifer/interm-ops) — the AI-powered job search pipeline built on Claude Code.

```bash
npx @santifer/interm-ops init
```

This sets up a ready-to-use workspace:

1. Clones interm-ops at the latest stable release
2. Installs dependencies

Then open your AI coding tool in the folder. **On first launch the agent walks you through setup — your CV, profile and target roles — just by chatting.** Nothing to configure by hand. interm-ops is AI-agnostic — Claude Code, Gemini, Codex, Qwen, OpenCode and GitHub Copilot CLI all work.

## Usage

```bash
npx @santifer/interm-ops init [folder]   # default folder: ./interm-ops
```

Prefer the manual route? `git clone` still works exactly as before — see the [setup guide](https://github.com/santifer/interm-ops/blob/main/docs/SETUP.md).

## Requirements

- Node.js 18+
- git

## License

MIT © [Santiago Fernández de Valderrama](https://santifer.io)
