#!/usr/bin/env node

const { execFileSync } = require('child_process');

function run(command, args, options = {}) {
  try {
    return {
      ok: true,
      output: execFileSync(command, args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        ...options,
      }).trim(),
    };
  } catch (error) {
    const stdout = error?.stdout ? String(error.stdout) : '';
    const stderr = error?.stderr ? String(error.stderr) : '';
    return {
      ok: false,
      output: `${stdout}${stderr}`.trim() || String(error?.message || error),
    };
  }
}

const profile = process.env.APPLE_KEYCHAIN_PROFILE || 'guild-notary';
const checks = [];

checks.push({
  label: 'Developer ID Application identity',
  result: run('security', ['find-identity', '-v', '-p', 'codesigning']),
  validate(output) {
    return /Developer ID Application: .*?\([A-Z0-9]+\)/.test(output);
  },
});

checks.push({
  label: `notarytool keychain profile "${profile}"`,
  result: run('xcrun', ['notarytool', 'history', '--keychain-profile', profile]),
  validate(_output, ok) {
    return ok;
  },
});

let hasFailure = false;

for (const check of checks) {
  const passed = check.validate(check.result.output, check.result.ok);
  if (!passed) hasFailure = true;
  process.stdout.write(`\n${passed ? 'PASS' : 'FAIL'} ${check.label}\n`);
  if (check.result.output) {
    process.stdout.write(`${check.result.output}\n`);
  }
}

if (hasFailure) {
  process.stderr.write('\nmacOS release signing is not fully ready yet.\n');
  process.exit(1);
}

process.stdout.write('\nmacOS release signing and notarization look ready.\n');
