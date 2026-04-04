#!/usr/bin/env node

const { spawn } = require('child_process');

const [, , flavor, ...commandParts] = process.argv;

if (!flavor || commandParts.length === 0) {
  console.error('Usage: node scripts/with-app-flavor.js <production|staging> <command> [...args]');
  process.exit(1);
}

const command = commandParts[0];
const args = commandParts.slice(1);

const child = spawn(command, args, {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    GUILD_APP_FLAVOR: flavor,
  },
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

child.on('error', (error) => {
  console.error(error?.message || error);
  process.exit(1);
});
