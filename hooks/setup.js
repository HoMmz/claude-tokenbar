#!/usr/bin/env node
// tokenbar — interactive setup
// Run: node hooks/setup.js
// Prompts for optional ANTHROPIC_API_KEY and saves to ~/.tokenbar/config.json

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

const CONFIG_DIR = path.join(os.homedir(), '.tokenbar');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (_) {}
  return {};
}

function saveConfig(config) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

async function main() {
  const current = loadConfig();
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('\n── tokenbar setup ──────────────────────────');
  console.log('Providing an API key lets tokenbar fetch the');
  console.log('exact context window limit for each model.');
  console.log('Leave blank to use the built-in model map.\n');

  const existing = current.api_key ? `(current: sk-...${current.api_key.slice(-4)})` : '(optional)';

  rl.question(`ANTHROPIC_API_KEY ${existing}: `, (answer) => {
    rl.close();
    const key = answer.trim();

    if (key) {
      saveConfig({ ...current, api_key: key });
      console.log('✔ API key saved to ~/.tokenbar/config.json');
    } else if (current.api_key) {
      console.log('✔ Keeping existing API key.');
    } else {
      saveConfig({ ...current });
      console.log('✔ Using built-in model map (no API key).');
    }

    console.log('── done ────────────────────────────────────\n');
    process.exit(0);
  });
}

main();
