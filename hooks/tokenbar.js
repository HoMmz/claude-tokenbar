#!/usr/bin/env node
// tokenbar v1.1 — UserPromptSubmit hook
// Reads transcript JSONL, detects model, resolves context window limit,
// builds usage bar and injects as additionalContext.

const fs = require('fs');
const readline = require('readline');
const https = require('https');
const os = require('os');
const path = require('path');

const BAR_WIDTH = 14;
const CONFIG_DIR = path.join(os.homedir(), '.tokenbar');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

// Hardcode map — fallback when no API key
const CONTEXT_WINDOW_MAP = {
  'claude-opus-4-5':    200000,
  'claude-opus-4':      200000,
  'claude-sonnet-4-6':  200000,
  'claude-sonnet-4-5':  200000,
  'claude-sonnet-4':    200000,
  'claude-haiku-4-5':   200000,
  'claude-haiku-4':     200000,
  'claude-3-5-sonnet':  200000,
  'claude-3-5-haiku':   200000,
  'claude-3-opus':      200000,
};
const DEFAULT_CONTEXT_WINDOW = 200000;

// ── Config helpers ──────────────────────────────────────────────────────────

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    }
  } catch (_) {}
  return {};
}

// ── Context window resolution ───────────────────────────────────────────────

function getFromMap(model) {
  if (!model) return DEFAULT_CONTEXT_WINDOW;
  // exact match first
  if (CONTEXT_WINDOW_MAP[model]) return CONTEXT_WINDOW_MAP[model];
  // prefix match (e.g. "claude-sonnet-4-6-20250514" → "claude-sonnet-4-6")
  for (const key of Object.keys(CONTEXT_WINDOW_MAP)) {
    if (model.startsWith(key)) return CONTEXT_WINDOW_MAP[key];
  }
  return DEFAULT_CONTEXT_WINDOW;
}

function fetchFromAPI(apiKey, model) {
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: 'api.anthropic.com',
        path: `/v1/models/${encodeURIComponent(model)}`,
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        timeout: 3000,
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            const json = JSON.parse(body);
            // context_window field from Anthropic API
            const limit = json.context_window || json.max_tokens_input;
            resolve(limit ? Number(limit) : null);
          } catch (_) {
            resolve(null);
          }
        });
      }
    );
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}

async function resolveContextWindow(model) {
  const config = loadConfig();
  const apiKey = config.api_key || process.env.ANTHROPIC_API_KEY;

  if (apiKey && model && model !== '<synthetic>') {
    const fromAPI = await fetchFromAPI(apiKey, model);
    if (fromAPI) return fromAPI;
  }

  return getFromMap(model);
}

// ── Transcript reader ───────────────────────────────────────────────────────

async function getLatestEntry(transcriptPath) {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return null;

  return new Promise((resolve) => {
    let lastEntry = null;
    const rl = readline.createInterface({
      input: fs.createReadStream(transcriptPath),
      crlfDelay: Infinity,
    });

    rl.on('line', (line) => {
      try {
        const entry = JSON.parse(line);
        if (entry.type === 'assistant' && entry.message?.usage) {
          lastEntry = entry;
        }
      } catch (_) {}
    });

    rl.on('close', () => resolve(lastEntry));
    rl.on('error', () => resolve(null));
  });
}

// ── Bar builder ─────────────────────────────────────────────────────────────

function buildBar(used, total) {
  const pct = Math.min(used / total, 1);
  const filled = Math.round(pct * BAR_WIDTH);
  const empty = BAR_WIDTH - filled;
  const bar = '█'.repeat(filled) + '─'.repeat(empty);

  const usedK = (used / 1000).toFixed(1);
  const totalK = Math.round(total / 1000);
  const pctStr = Math.round(pct * 100);

  let emoji;
  if (pct < 0.5) emoji = '🟢';
  else if (pct < 0.8) emoji = '🟡';
  else emoji = '🔴';

  return `${emoji} [${bar}] ${usedK}k / ${totalK}k (${pctStr}%)`;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  let input = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) input += chunk;

  let data = {};
  try { data = JSON.parse(input); } catch (_) {}

  const transcriptPath = data.transcript_path;
  const entry = await getLatestEntry(transcriptPath);
  if (!entry) process.exit(0);

  const usage = entry.message.usage;
  const model = entry.message.model || null;

  const contextWindow = await resolveContextWindow(model);

  const used =
    (usage.input_tokens || 0) +
    (usage.cache_read_input_tokens || 0) +
    (usage.cache_creation_input_tokens || 0) +
    (usage.output_tokens || 0);

  const bar = buildBar(used, contextWindow);

  const instruction =
    `\n---\nTOKEN BAR INSTRUCTION (render this at the very end of your response, after all content):\n` +
    `Append this exact line at the bottom, preceded by a blank line:\n${bar}\n---\n`;

  process.stdout.write(instruction);
  process.exit(0);
}

main().catch(() => process.exit(0));
