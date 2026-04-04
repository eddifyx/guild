# Windows Build And Release Runbook

Use this for any Windows build that might reach users.

## Hard Rule

Windows production releases must be built or at least launch-tested on a real
Windows machine.

If a non-Windows machine is used for emergency recovery packaging, that artifact
is not eligible for production until the exact published zip boots on Windows.

## Current Packaging Shape

- Windows release format is `guild-win32-x64-<version>.zip`
- the executable is `guild.exe`
- there is no signed installer yet

## 1. Prerequisites On Windows

- `Git`
- `Node.js 22 LTS`
- `Python 3`
- `Visual Studio 2022 Build Tools`
- `Desktop development with C++` workload

## 2. Prepare A Clean Workspace

From the repo root:

```powershell
git pull
npm install
Remove-Item -Recurse -Force .\client\out -ErrorAction SilentlyContinue
```

Do not build production from a dirty workspace.

## 3. Build On Windows

```powershell
cd .\client
npm run make -- --platform=win32 --arch=x64
```

Expected artifact:

```text
client\out\make\zip\win32\x64\guild-win32-x64-<version>.zip
```

## 4. Validate The Zip

Run the repo validators:

```powershell
bash ..\scripts\validate-windows-update-zip.sh C:\absolute\path\to\guild-win32-x64-<version>.zip
bash ..\scripts\validate-packaged-runtime.sh C:\absolute\path\to\guild-win32-x64-<version>.zip
bash ..\scripts\verify-lane-markers.sh C:\absolute\path\to\guild-win32-x64-<version>.zip
```

These must pass before any publish step.

## 5. Prove Windows Startup

Do not launch from inside the zip preview.

Extract into a fresh folder:

```powershell
Expand-Archive `
  -Path .\client\out\make\zip\win32\x64\guild-win32-x64-<version>.zip `
  -DestinationPath .\client\out\test-guild-win32-x64 `
  -Force
```

Launch:

```powershell
Start-Process .\client\out\test-guild-win32-x64\guild-win32-x64\guild.exe
```

Required proof:

- app starts without main-process crash
- app reaches login or home
- no missing module/runtime file error
- no secure startup block caused by packaging

This proof is mandatory. A Windows release is not valid without it.

## 6. Run Lane Smoke

Use the checklist in [RELEASE-SMOKE-CHECKLIST.md](/Users/eddifyx/Documents/Projects/guild-main/docs/RELEASE-SMOKE-CHECKLIST.md).

At minimum for Windows:

- fresh login
- restored session relaunch
- `/guildchat` post and mention
- DM notification
- OS notification when hidden
- Windows↔Windows voice

## 7. Publish

Use the production helper from the repo root:

```bash
bash ops/1984/publish-update-artifacts.sh \
  --apply \
  --manifest /absolute/path/to/server/client-version.json \
  --version <version> \
  --target production \
  /absolute/path/to/guild-win32-x64-<version>.zip
```

Then verify:

- version API returns the new Windows version
- live zip URL returns `200`

## 8. Recovery Release Rule

If Windows production is broken:

1. freeze Windows on the last known-good version first
2. build a new higher recovery version
3. validate the recovery artifact
4. prove it boots on Windows
5. only then publish it

Do not republish a patched recovery artifact without real Windows launch proof.

## 9. Troubleshooting

### Missing native module

Usually means:

- stale extracted folder
- stale `client/out`
- incomplete Windows build

### Missing runtime JS file such as `appFlavor.js`

This means the packaged `app.asar` is missing runtime-managed files that Forge
normally copies into the app bundle.

Fix:

1. rebuild from a clean workspace
2. rerun `verify:packaged-runtime`
3. launch the exact zip on Windows before publish
