# claude-tokenbar

A Claude Code plugin that shows a **context window usage bar** at the bottom of every response.

```
🟢 [████──────────] 38.5k / 200k (19%)
🟡 [████████──────] 142.0k / 200k (71%)
🔴 [████████████──] 188.0k / 200k (94%)
```

## Features

- **Minimal modern bar** — clean `[████──────────]` style
- **Color zones** — 🟢 green < 50% · 🟡 yellow 50–80% · 🔴 red > 80%
- **Live data** — reads actual token usage from Claude Code's transcript JSONL
- **Counts everything** — input + cache_read + cache_creation + output tokens
- **Smart context window** — fetches exact limit from Anthropic API (optional), falls back to built-in model map
- **Lightweight** — ~70 token overhead per turn

## Requirements

- [Claude Code](https://claude.ai/code) v2.1+
- Node.js (bundled with Claude Code)

## Install

```bash
claude plugin marketplace add hommm2/claude-tokenbar
claude plugin install tokenbar@claude-tokenbar
```

## How it works

A `UserPromptSubmit` hook fires before each response:

1. Reads `transcript_path` from hook stdin
2. Parses the session JSONL to find the latest `usage` block
3. Sums `input_tokens + cache_read_input_tokens + cache_creation_input_tokens + output_tokens`
4. Renders a proportional bar against the 200k context window
5. Injects it as `additionalContext` so Claude appends it to each response

## Context window sizes

| Model | Tokens |
|---|---|
| claude-sonnet (default) | 200,000 |

To change the limit, edit `CONTEXT_WINDOW` in `hooks/tokenbar.js`.

## Optional: API key for accurate context limits

Run the setup script to store your Anthropic API key:

```bash
node ~/.claude/plugins/cache/tokenbar/tokenbar/*/hooks/setup.js
```

Or set the environment variable:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

Without an API key, tokenbar uses a built-in model map (accurate for all current Claude models).

## Uninstall

```bash
claude plugin uninstall tokenbar@claude-tokenbar
claude plugin marketplace remove claude-tokenbar
```

## License

MIT
