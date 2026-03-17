# Windows Codex Release Prompt

Paste the prompt below directly into Codex on the Windows machine.

```text
Work in the local repo clone for /guild and complete the Windows v1.0.42 release to FlokiNET production.

Use this exact branch:
- codex/restart-session-persist

Context:
- Production host: 82.221.100.187
- SSH user: eddifyx
- Production HTTPS host: https://prod.82.221.100.187.sslip.io
- Production app root: /opt/guild
- Production updates dir: /opt/guild/server/updates
- Production metadata file: /opt/guild/server/client-version.json
- Windows is currently pinned to 1.0.40 in that metadata file
- Goal: build the real Windows zip for v1.0.42, test it locally, upload it, remove the Windows pin, and verify production serves v1.0.42 to Windows clients

Do this:

1. Verify the repo is on branch codex/restart-session-persist and up to date.
2. From the repo root, run npm install.
3. Delete client/out to avoid stale artifacts.
4. Build the Windows release from client with:
   npm run make -- --platform=win32 --arch=x64
5. Confirm the build artifact exists at:
   client/out/make/zip/win32/x64/guild-win32-x64-1.0.42.zip
6. Extract that zip into a fresh test folder and launch guild.exe.
7. Verify the app starts cleanly and does not hit a better-sqlite3 crash.
8. Upload guild-win32-x64-1.0.42.zip to:
   /home/eddifyx/ on 82.221.100.187
9. SSH to the server and install it to:
   /opt/guild/server/updates/guild-win32-x64-1.0.42.zip
10. Edit /opt/guild/server/client-version.json and remove the platformOverrides entries for win32 and win32-x64 so Windows inherits the base 1.0.42 version and patch notes.
11. If needed, restart:
   sudo systemctl restart guild-server
12. Verify production with:
   https://prod.82.221.100.187.sslip.io/api/version?platform=win32-x64&localVersion=1.0.41
   and confirm it returns version 1.0.42 with a Windows download path.
13. Verify the Windows zip URL returns 200.

Important constraints:
- Do not change Mac release files.
- Do not revert unrelated repo changes.
- If SSH on Windows needs a key, use the existing local SSH setup if available.
- If the build fails, fix the actual blocker and continue until the Windows artifact is published or you hit a real external blocker.

At the end, report:
- local artifact path
- production download URL
- whether Windows is unpinned and now advertising 1.0.42
- any blocker that remains
```
