const { EXTRACTED_UPDATE_DIR_NAME } = require('./updateDownloadModel');

function waitForSpawnClose({ spawn, command, args, options, failureMessage, onBeforeClose }) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, options);
    proc.on('close', (code) => {
      if (typeof onBeforeClose === 'function') {
        onBeforeClose();
      }
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${failureMessage} (code ${code})`));
      }
    });
    proc.on('error', reject);
  });
}

function createUpdateExtractRuntime({
  fs,
  path,
  processRef = process,
  spawn,
}) {
  async function extractUpdateArchive({ zipPath, tempDir }) {
    const extractDir = path.join(tempDir, EXTRACTED_UPDATE_DIR_NAME);

    if (processRef.platform === 'darwin') {
      fs.mkdirSync(extractDir, { recursive: true });
      await waitForSpawnClose({
        spawn,
        command: 'unzip',
        args: ['-o', zipPath, '-d', extractDir],
        options: { stdio: 'ignore' },
        failureMessage: 'Extraction failed',
      });
      return extractDir;
    }

    await waitForSpawnClose({
      spawn,
      command: 'powershell.exe',
      args: [
        '-NoProfile',
        '-Command',
        `Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}' -Force`,
      ],
      options: { stdio: 'ignore' },
      failureMessage: 'Extraction failed',
      onBeforeClose() {
        fs.mkdirSync(extractDir, { recursive: true });
      },
    });
    return extractDir;
  }

  return {
    extractUpdateArchive,
  };
}

module.exports = {
  createUpdateExtractRuntime,
  waitForSpawnClose,
};
