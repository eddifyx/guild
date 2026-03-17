# Windows Codex Release Handoff

Use this file as the direct instruction set for Codex on the Windows machine.
Goal: build the real Windows `v1.0.42` artifact locally on Windows, upload it
to the FlokiNET production server, unpin Windows from `1.0.40`, and verify the
live production update/feed.

## Release Target

- app version: `1.0.42`
- git branch: `codex/restart-session-persist`
- production HTTPS host: `https://prod.82.221.100.187.sslip.io`
- production server IP: `82.221.100.187`
- SSH user: `eddifyx`
- production app root on server: `/opt/guild`
- production update directory on server: `/opt/guild/server/updates`
- production version metadata file on server: `/opt/guild/server/client-version.json`
- production systemd service: `guild-server`

Important:

- Windows is currently pinned to `1.0.40` in `server/client-version.json`
- after uploading the real Windows `1.0.42` zip, remove the Windows override
  so production users can actually see `1.0.42`

## 1. Prerequisites On Windows

Install these first:

- `Git`
- `Node.js 22 LTS`
- `Python 3`
- `Visual Studio 2022 Build Tools`

For Visual Studio Build Tools, make sure this workload is installed:

- `Desktop development with C++`

## 2. Get The Correct Branch

If the repo is not cloned yet:

```powershell
git clone https://github.com/eddifyx/guild.git
cd .\guild
git checkout codex/restart-session-persist
```

If the repo already exists:

```powershell
cd C:\Users\rycol\guild
git fetch origin
git checkout codex/restart-session-persist
git pull
```

## 3. Install Dependencies

From the repo root:

```powershell
npm install
```

This repo uses npm workspaces, so install from the root first.

## 4. Clean Old Windows Output

From the repo root:

```powershell
Remove-Item -Recurse -Force .\client\out -ErrorAction SilentlyContinue
```

If you previously extracted an older Windows build somewhere else, delete that
old extracted folder too so you do not accidentally test stale files.

## 5. Build The Windows Artifact

From the repo root:

```powershell
cd .\client
npm run make -- --platform=win32 --arch=x64
```

Expected output zip:

```text
client\out\make\zip\win32\x64\guild-win32-x64-1.0.42.zip
```

Expected packaged app folder:

```text
client\out\guild-win32-x64
```

## 6. Test The Windows Build Locally

Do not launch from inside the zip preview.

Extract to a fresh folder:

```powershell
Expand-Archive `
  -Path .\out\make\zip\win32\x64\guild-win32-x64-1.0.42.zip `
  -DestinationPath .\out\test-guild-win32-x64 `
  -Force
```

Launch:

```powershell
Start-Process .\out\test-guild-win32-x64\guild-win32-x64\guild.exe
```

Local sanity checks before upload:

- app launches without `better-sqlite3` errors
- login works
- the app reaches the production server
- secure startup completes
- voice works
- General room history does not show failed decrypt rows

## 7. Upload The Zip To FlokiNET

If your Windows machine already has the correct SSH key configured in OpenSSH,
plain `scp` and `ssh` should work. If not, add `-i path\to\your_key`.

From the repo root:

```powershell
scp .\client\out\make\zip\win32\x64\guild-win32-x64-1.0.42.zip `
  eddifyx@82.221.100.187:/home/eddifyx/
```

Then SSH into the server:

```powershell
ssh eddifyx@82.221.100.187
```

Install the uploaded zip into the live production updates directory:

```bash
sudo install -o guild -g guild -m 644 \
  /home/eddifyx/guild-win32-x64-1.0.42.zip \
  /opt/guild/server/updates/guild-win32-x64-1.0.42.zip
```

## 8. Unpin Windows From 1.0.40

Open the production metadata file:

```bash
sudo nano /opt/guild/server/client-version.json
```

Find this block and remove both Windows override entries:

```json
"platformOverrides": {
  "win32": {
    "version": "1.0.40",
    "releasedAt": null,
    "patchNotes": null
  },
  "win32-x64": {
    "version": "1.0.40",
    "releasedAt": null,
    "patchNotes": null
  }
}
```

After removal, Windows will inherit the base `1.0.42` version and patch notes.

No restart should be required because the server reads the version file on each
request, but restarting the service is safe if you want to be explicit:

```bash
sudo systemctl restart guild-server
sudo systemctl status guild-server --no-pager
```

## 9. Verify Production

On the server or your local machine, verify the live Windows version feed:

```powershell
curl "https://prod.82.221.100.187.sslip.io/api/version?platform=win32-x64&localVersion=1.0.41"
```

Expected:

- `"version":"1.0.42"`
- Windows download archive URL present

Verify the download itself:

```powershell
curl -I https://prod.82.221.100.187.sslip.io/updates/guild-win32-x64-1.0.42.zip
```

Optional legacy HTTP verification for older clients:

```powershell
curl "http://82.221.100.187/api/version?platform=win32-x64&localVersion=1.0.41"
curl -I http://82.221.100.187/updates/guild-win32-x64-1.0.42.zip
```

## 10. Troubleshooting

### `Cannot find module 'better-sqlite3'`

Usually means one of these:

- you launched an old extracted build
- you extracted over an existing folder
- the build did not finish cleanly

Fix:

1. delete old extracted folders
2. delete `client\out`
3. rebuild
4. extract into a brand new folder

### Native build failures

Usually missing one of:

- `Node.js 22`
- `Python 3`
- `Visual Studio 2022 Build Tools`
- `Desktop development with C++`

### SmartScreen warning

Expected for an unsigned Windows test/release zip built locally.

If you trust the build you just made:

1. click `More info`
2. click `Run anyway`

## 11. What Success Looks Like

Success means all of these are true:

- `guild-win32-x64-1.0.42.zip` exists locally
- the app launches on Windows
- `/opt/guild/server/updates/guild-win32-x64-1.0.42.zip` exists on FlokiNET
- `https://prod.82.221.100.187.sslip.io/api/version?platform=win32-x64&localVersion=1.0.41`
  reports `1.0.42`
- Windows production users can now download or update to the real Windows `.42`
