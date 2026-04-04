# Windows 1.0.72 Release Handoff

Use this to qualify and release the Windows `1.0.72` client after the Mac
`1.0.72` lane has already been proven.

## Current State

- Mac `1.0.72` ship-proof is complete.
- Windows is still intentionally pinned to `1.0.71` in
  [/Users/eddifyx/Documents/Projects/guild-main/server/client-version.json](/Users/eddifyx/Documents/Projects/guild-main/server/client-version.json).
- The next Windows release target is `1.0.72`.
- Previous production Windows baseline is `1.0.71`.

## Important Source Fix Already Landed

Windows packaging was relying on a host-default native rebuild path in
[/Users/eddifyx/Documents/Projects/guild-main/client/forge.config.js](/Users/eddifyx/Documents/Projects/guild-main/client/forge.config.js).
The Forge hook now passes the requested target `platform` and `arch` into
`@electron/rebuild`, which is required for any trustworthy cross-target build
attempt.

This does not replace real Windows proof. It only removes one packaging bug
before the Windows-machine pass begins.

## Hard Rule

Per
[/Users/eddifyx/Documents/Projects/guild-main/docs/WINDOWS-BUILD.md](/Users/eddifyx/Documents/Projects/guild-main/docs/WINDOWS-BUILD.md)
and
[/Users/eddifyx/Documents/Projects/guild-main/docs/RELEASE-SOP.md](/Users/eddifyx/Documents/Projects/guild-main/docs/RELEASE-SOP.md),
Windows is not releasable until the exact `guild-win32-x64-1.0.72.zip` boots on
a real Windows machine.

## Required Windows Host

- Windows 10 or 11 x64
- Git
- Node.js 22 LTS
- Python 3
- Visual Studio 2022 Build Tools
- Desktop development with C++ workload

## 1. Prepare A Clean Windows Workspace

From the repo root on Windows:

```powershell
git pull
npm install
Remove-Item -Recurse -Force .\client\out -ErrorAction SilentlyContinue
```

Do not build from a dirty workspace.

## 2. Build The Exact Windows Artifact

```powershell
cd .\client
npm run make -- --platform=win32 --arch=x64
```

Expected artifact:

```text
client\out\make\zip\win32\x64\guild-win32-x64-1.0.72.zip
```

## 3. Validate The Exact Zip

From `client\` on Windows:

```powershell
bash ..\scripts\validate-windows-update-zip.sh C:\absolute\path\to\guild-win32-x64-1.0.72.zip
bash ..\scripts\validate-packaged-runtime.sh C:\absolute\path\to\guild-win32-x64-1.0.72.zip
bash ..\scripts\verify-lane-markers.sh C:\absolute\path\to\guild-win32-x64-1.0.72.zip
```

All three must pass.

## 4. Prove Windows Startup

Do not run from inside the zip preview.

```powershell
Expand-Archive `
  -Path .\client\out\make\zip\win32\x64\guild-win32-x64-1.0.72.zip `
  -DestinationPath .\client\out\test-guild-win32-x64 `
  -Force

Start-Process .\client\out\test-guild-win32-x64\guild-win32-x64\guild.exe
```

Required proof:

- no main-process crash
- no `ERR_MODULE_NOT_FOUND`
- no `Unable to locate ...`
- no `Secure Startup Blocked`
- no missing native module error
- app reaches login or home

## 5. Run Windows Lane Smoke

At minimum:

- fresh login
- restored session relaunch
- `/guildchat` post
- `/guildchat` mention
- DM notification
- hidden/minimized OS notification path
- Windows to Windows voice

If voice/media/runtime packaging changed, also do the relevant cross-platform
voice check.

## 6. Prove Real Windows Update Path

Previous production Windows baseline is `1.0.71`.

The required proof is:

- installed or extracted `1.0.71` Windows client detects `1.0.72`
- updater downloads the exact `guild-win32-x64-1.0.72.zip`
- updater applies successfully
- relaunched client is healthy on `1.0.72`

Do not mark `updatePath` passed without this proof.

## 7. Create The Windows Release Proof

Once the exact zip exists, generate a draft proof from the repo root:

```powershell
python .\scripts\create-release-proof.py `
  --manifest C:\absolute\path\to\server\client-version.json `
  --output C:\absolute\path\to\release-proofs\1.0.72-windows.json `
  --release-version 1.0.72 `
  --baseline-version 1.0.71 `
  --release-type normal `
  --workspace C:\absolute\path\to\guild-main `
  --approved-by eddifyx `
  --artifact C:\absolute\path\to\guild-win32-x64-1.0.72.zip `
  --client-file C:\absolute\path\to\client\forge.config.js `
  --client-file C:\absolute\path\to\client\src\components\GuildChat\GuildChatDock.jsx `
  --client-file C:\absolute\path\to\client\src\features\auth\authRuntimeEffects.mjs `
  --client-file C:\absolute\path\to\client\src\features\auth\nostrConnectSessionState.mjs `
  --client-file C:\absolute\path\to\client\src\features\layout\layoutGuildChatRuntime.mjs `
  --client-file C:\absolute\path\to\client\src\features\nostr\profilePublisherSessionRuntime.mjs `
  --client-file C:\absolute\path\to\client\src\nostr\profilePublisher.js `
  --client-file C:\absolute\path\to\client\package.json `
  --server-file C:\absolute\path\to\server\client-version.json
```

Then fill in:

- validator results
- Windows startup proof
- smoke checklist
- updater path proof
- final ship decision

## 8. Validate The Windows Release Proof

```powershell
python .\scripts\validate-release-proof.py `
  --proof C:\absolute\path\to\release-proofs\1.0.72-windows.json `
  --manifest C:\absolute\path\to\server\client-version.json `
  --release-version 1.0.72 `
  --artifact C:\absolute\path\to\guild-win32-x64-1.0.72.zip
```

## 9. Only Then Unpin Windows

Only after the Windows proof file validates cleanly should
[/Users/eddifyx/Documents/Projects/guild-main/server/client-version.json](/Users/eddifyx/Documents/Projects/guild-main/server/client-version.json)
be changed so `win32-x64` points at `1.0.72`.

## Stop-Ship Conditions

Do not promote Windows if any of these are true:

- no exact `1.0.72` Windows zip exists
- any Windows zip validator fails
- Windows startup proof is missing
- updater path from `1.0.71` to `1.0.72` is missing
- proof JSON does not validate
