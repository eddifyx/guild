# Windows Codex Staging Handoff for v1.0.44

Use this file as the direct instruction set for Codex on the Windows machine.
Goal: take the current `/guild` `v1.0.44` source tree from this Mac, build the
real Windows artifact locally on Windows, publish it to the FlokiNET staging
server, unpin Windows on staging only, and run Mac + Windows QA against the
same staging backend.

## Best Approach

Do not rely on GitHub as the source of truth for this pass unless you know it
already has the latest `.44` work.

Best path:

1. Share the current repo folder from this Mac to the Windows machine.
2. On Windows, work from that shared repo copy.
3. Build the Windows `v1.0.44` zip locally on Windows.
4. Upload only the Windows staging artifact and staging metadata changes to the
   FlokiNET staging server.
5. Test with:
   - Mac client pointed at staging
   - Windows client pointed at staging

That keeps production untouched while you verify the real Windows build against
the same staging server as Mac.

## Staging Target

- app version: `1.0.44`
- staging HTTPS host: `https://staging.82.221.100.187.sslip.io`
- staging server IP: `82.221.100.187`
- SSH user: `eddifyx`
- staging app root on server: `/opt/guild-staging`
- staging update directory on server: `/opt/guild-staging/server/updates`
- staging version metadata file on server: `/opt/guild-staging/server/client-version.json`
- staging service: `guild-staging`

## Source Tree Sanity Check

Before building on Windows, confirm the shared repo copy really contains the
latest `.44` work:

- `client/package.json` should say `1.0.44`
- `server/client-version.json` should say `1.0.44`

Also confirm the `.44` patch notes still include these areas:

- chat pinned to bottom while media loads
- composer clears immediately
- updates leave voice first
- OS notifications removed
- streaming/voice rebalance

## 1. Prerequisites On Windows

Install these first:

- `Git`
- `Node.js 22 LTS`
- `Python 3`
- `Visual Studio 2022 Build Tools`

For Visual Studio Build Tools, make sure this workload is installed:

- `Desktop development with C++`

## 2. Open The Shared Repo Copy

If you copied the repo through a file share app, put it somewhere stable, for
example:

```powershell
C:\Users\rycol\guild-v1.0.44
```

Then in PowerShell:

```powershell
cd C:\Users\rycol\guild-v1.0.44
```

If the repo is instead a normal git clone and already has the latest `.44`
changes, that is also fine. But the safest assumption for this pass is that the
shared folder from Mac is the real source of truth.

## 3. Install Dependencies

From the repo root:

```powershell
npm install
```

This repo uses npm workspaces, so install from the root.

## 4. Clean Old Windows Output

From the repo root:

```powershell
Remove-Item -Recurse -Force .\client\out -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .\client\dist -ErrorAction SilentlyContinue
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
client\out\make\zip\win32\x64\guild-win32-x64-1.0.44.zip
```

Expected packaged app folder:

```text
client\out\guild-win32-x64
```

## 6. Local Windows Smoke Test

Do not launch from inside the zip preview.

Extract to a fresh test folder:

```powershell
Expand-Archive `
  -Path .\out\make\zip\win32\x64\guild-win32-x64-1.0.44.zip `
  -DestinationPath .\out\test-guild-win32-x64 `
  -Force
```

Launch the Windows app against staging with an isolated profile:

```powershell
Start-Process .\out\test-guild-win32-x64\guild-win32-x64\guild.exe `
  -ArgumentList '--profile=staging-v1-0-44-win','--server-url=https://staging.82.221.100.187.sslip.io'
```

If the app ignores the CLI server arg for any reason, use `Server settings`
inside the app and set:

```text
https://staging.82.221.100.187.sslip.io
```

## 7. Upload The Windows Zip To FlokiNET Staging

If your Windows machine already has the correct SSH key configured in OpenSSH,
plain `scp` and `ssh` should work. If not, add `-i path\to\your_key`.

From the repo root:

```powershell
scp .\client\out\make\zip\win32\x64\guild-win32-x64-1.0.44.zip `
  eddifyx@82.221.100.187:/home/eddifyx/
```

Then SSH into the server:

```powershell
ssh eddifyx@82.221.100.187
```

Install the uploaded zip into the staging updates directory:

```bash
sudo install -o guild -g guild -m 644 \
  /home/eddifyx/guild-win32-x64-1.0.44.zip \
  /opt/guild-staging/server/updates/guild-win32-x64-1.0.44.zip
```

## 8. Unpin Windows On Staging Only

Open the staging metadata file:

```bash
sudo nano /opt/guild-staging/server/client-version.json
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

After removal, Windows staging clients will inherit the base `1.0.44` version
and patch notes.

Restart staging to be explicit:

```bash
sudo systemctl restart guild-staging
sudo systemctl status guild-staging --no-pager
```

## 9. Verify Staging Feed

From Windows or Mac, verify the live Windows staging version feed:

```powershell
curl "https://staging.82.221.100.187.sslip.io/api/version?platform=win32-x64&localVersion=1.0.40"
```

Expected:

- `"version":"1.0.44"`
- Windows download archive URL present

Verify the download itself:

```powershell
curl -I https://staging.82.221.100.187.sslip.io/updates/guild-win32-x64-1.0.44.zip
```

## 10. Mac Staging Test Setup

On the Mac, launch a staging-only profile so you do not touch your production
profile:

```bash
/Applications/guild.app/Contents/MacOS/guild \
  --profile=staging-v1-0-44-mac \
  --server-url=https://staging.82.221.100.187.sslip.io
```

If you are not testing from `/Applications/guild.app`, use the same arguments
with the packaged test build you want to launch.

If the server field is wrong after launch, open `Server settings` and set:

```text
https://staging.82.221.100.187.sslip.io
```

## 11. Cross-Platform QA Checklist For v1.0.44

Use one Mac account and one Windows account in the same staging guild.

### Chat

- Open a room with existing image/video history.
- Confirm the timeline opens at the bottom.
- Wait a few seconds for late-loading media.
- Confirm the timeline stays at the bottom and does not jump into the middle.
- Scroll near the top to trigger older history.
- Confirm the viewport does not jump unexpectedly after older messages prepend.

### Composer

- Type a message and press `Enter`.
- Confirm the message appears in chat immediately.
- Confirm the text box clears immediately and does not briefly keep the sent text.
- Switch channels or DMs while typing.
- Confirm the composer still accepts typing normally after the switch.

### Notifications

- Send a message from the other device while this conversation is not focused.
- Confirm you hear the in-app sound.
- Confirm the operating system does not show a raw payload notification toast.

### Update Flow

- While joined to voice, trigger the update UI on staging if you are testing an
  advertised update build.
- Confirm starting the update leaves voice first.

### Voice + Streaming

- Join the same voice channel on Mac and Windows.
- Start a screen share from the stronger sender machine first, ideally Windows.
- Confirm voice stays understandable while streaming is active.
- Watch the sender overlay stats:
  - target should remain `1920x1080 @ 30fps`
  - sent fps should not collapse for long stretches
  - sent resolution should stay materially above `720p`
- Join the receiver after the stream has already started.
- Confirm the receiver gets live video quickly instead of a long frozen first frame.

## 12. Troubleshooting

### `fatal: not a git repository`

You are not inside the repo folder. First:

```powershell
cd C:\Users\rycol\guild-v1.0.44
```

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

### The app still points at the wrong server

Use `Server settings` and force:

```text
https://staging.82.221.100.187.sslip.io
```

or relaunch with:

```text
--server-url=https://staging.82.221.100.187.sslip.io
```
