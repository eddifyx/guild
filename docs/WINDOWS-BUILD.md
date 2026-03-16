# Windows Build Runbook

This is the fastest path to build a real Windows desktop artifact for `/guild`
on a Windows machine instead of cross-building from macOS.

Current status:

- Windows packaging is `zip` only
- there is no Windows installer `.exe` yet
- the app executable lives inside the extracted app folder as `guild.exe`

If you see `Cannot find module 'better-sqlite3'`, you are almost certainly
launching an older broken zip. Build a fresh artifact with the steps below and
extract it into a brand new folder before testing.

## 1. Prerequisites

Install these on the Windows machine first:

- `Git`
- `Node.js 22 LTS`
- `Python 3`
- `Visual Studio 2022 Build Tools`

For Visual Studio Build Tools, make sure this workload is installed:

- `Desktop development with C++`

That gives native Electron modules like `better-sqlite3` a real Windows build
environment.

## 2. Get The Repo

Clone the repo somewhere simple, for example:

```powershell
git clone <YOUR_REPO_URL> R:\Projects\guild-main
cd R:\Projects\guild-main
```

If you already have the repo on the Windows box, pull the latest changes first.

## 3. Install Dependencies

From the repo root:

```powershell
npm install
```

This project uses npm workspaces, so install from the root, not from `client/`
first.

## 4. Clean Old Windows Artifacts

Before building, remove any stale packaged output so you do not accidentally
test an old zip.

From the repo root:

```powershell
Remove-Item -Recurse -Force .\client\out -ErrorAction SilentlyContinue
```

If you already extracted a previous Windows build somewhere else, delete that
old extracted folder too.

## 5. Build The Windows App

From the repo root:

```powershell
cd .\client
npm run make -- --platform=win32 --arch=x64
```

If the build succeeds, the zip will be here:

```text
client\out\make\zip\win32\x64\guild-win32-x64-1.0.40.zip
```

The packaged app folder will also exist here:

```text
client\out\guild-win32-x64
```

## 6. Test The Build On Windows

Do not launch the app out of the zip preview.

Instead:

1. Copy the zip somewhere easy to find
2. Extract it fully
3. Open the extracted folder
4. Run `guild.exe`

Example PowerShell extraction:

```powershell
Expand-Archive `
  -Path .\client\out\make\zip\win32\x64\guild-win32-x64-1.0.40.zip `
  -DestinationPath .\client\out\test-guild-win32-x64 `
  -Force
```

Then launch:

```powershell
Start-Process .\client\out\test-guild-win32-x64\guild-win32-x64\guild.exe
```

## 7. Quick Sanity Checks

Before you upload the zip anywhere, verify:

- the app launches without the `better-sqlite3` crash
- login opens
- the app reaches the server
- secure startup completes

Optional quick file check:

```powershell
Get-ChildItem .\client\out\make\zip\win32\x64
```

## 8. Upload To FlokiNET

If you want to replace the current Windows test zip on FlokiNET from the
Windows machine directly, use `scp`.

From the repo root on Windows:

```powershell
scp .\client\out\make\zip\win32\x64\guild-win32-x64-1.0.40.zip `
  eddifyx@82.221.100.187:/home/eddifyx/
```

Then SSH into the VPS:

```powershell
ssh eddifyx@82.221.100.187
```

On the VPS:

```bash
sudo cp /home/eddifyx/guild-win32-x64-1.0.40.zip /opt/guild/server/updates/guild-win32-x64-1.0.40.zip
```

The download path on FlokiNET is:

```text
http://82.221.100.187:3001/updates/guild-win32-x64-1.0.40.zip
```

## 9. Troubleshooting

### `Cannot find module 'better-sqlite3'`

This usually means one of these:

- you launched an older zip
- you extracted over an older folder instead of using a fresh one
- the Windows build did not complete successfully

Fix:

1. delete old extracted folders
2. delete `client\out`
3. rebuild
4. extract to a brand new folder

### Build fails during native dependency compilation

Usually this means the Windows build machine is missing:

- C++ build tools
- Python
- a proper Node installation

Re-check the prerequisites in section 1.

### SmartScreen warning

That is expected for an unsigned Windows test build.

If you trust the artifact you just built yourself:

- click `More info`
- then `Run anyway`

## 10. Current Windows Packaging Notes

Right now this repo produces:

- `guild-win32-x64-1.0.40.zip`

It does **not** currently produce:

- a signed Windows installer
- a standalone installer `.exe`
- MSI

If we want a cleaner Windows release flow later, the next step is adding a real
Windows installer target such as Squirrel or WiX.
