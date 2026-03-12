const { spawn } = require('child_process');
const path = require('path');

const profile = (process.argv[2] || '').trim();
const extraArgs = process.argv.slice(3);

if (!profile) {
  console.error('Usage: node scripts/start-client-profile.js <profile-id> [extra args...]');
  process.exit(1);
}

const clientCwd = path.join(__dirname, '..', 'client');
const env = {
  ...process.env,
  BYZANTINE_PROFILE: profile,
};

const child = process.platform === 'win32'
  ? spawn(
      process.env.ComSpec || 'cmd.exe',
      ['/d', '/s', '/c', `npm start${extraArgs.length ? ` -- ${extraArgs.join(' ')}` : ''}`],
      {
        cwd: clientCwd,
        stdio: 'inherit',
        env,
      }
    )
  : spawn('npm', extraArgs.length ? ['start', '--', ...extraArgs] : ['start'], {
      cwd: clientCwd,
      stdio: 'inherit',
      env,
    });

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

child.on('error', (error) => {
  console.error(error);
  process.exit(1);
});
