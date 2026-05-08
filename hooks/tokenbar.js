#!/usr/bin/env node
// tokenbar — UserPromptSubmit hook
// Reads transcript JSONL, sums token usage, injects bar as additionalContext
// Claude will render the bar at the bottom of each response

const fs = require('fs');
const readline = require('readline');
const path = require('path');

const CONTEXT_WINDOW = 200000; // claude-sonnet default
const BAR_WIDTH = 14;

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

async function getLatestUsage(transcriptPath) {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return null;

  return new Promise((resolve) => {
    let lastUsage = null;
    const rl = readline.createInterface({
      input: fs.createReadStream(transcriptPath),
      crlfDelay: Infinity
    });

    rl.on('line', (line) => {
      try {
        const entry = JSON.parse(line);
        if (entry.type === 'assistant' && entry.message?.usage) {
          lastUsage = entry.message.usage;
        }
      } catch (_) {}
    });

    rl.on('close', () => resolve(lastUsage));
    rl.on('error', () => resolve(null));
  });
}

async function main() {
  let input = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) input += chunk;

  let data = {};
  try { data = JSON.parse(input); } catch (_) {}

  const transcriptPath = data.transcript_path;
  const usage = await getLatestUsage(transcriptPath);

  if (!usage) {
    process.exit(0);
  }

  // current context = cache_read + cache_creation + direct input + output
  const used =
    (usage.input_tokens || 0) +
    (usage.cache_read_input_tokens || 0) +
    (usage.cache_creation_input_tokens || 0) +
    (usage.output_tokens || 0);

  const bar = buildBar(used, CONTEXT_WINDOW);

  // Inject instruction so Claude renders it at the bottom of response
  const instruction =
    `\n---\nTOKEN BAR INSTRUCTION (render this at the very end of your response, after all content):\n` +
    `Append this exact line at the bottom, preceded by a blank line:\n${bar}\n---\n`;

  process.stdout.write(instruction);
  process.exit(0);
}

main().catch(() => process.exit(0));
