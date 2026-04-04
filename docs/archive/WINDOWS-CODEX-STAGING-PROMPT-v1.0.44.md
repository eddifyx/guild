# Windows Codex Staging Prompt for v1.0.44

Paste the prompt below directly into Codex on the Windows machine.

```text
Work in the shared local repo copy for /guild and complete the Windows v1.0.44 staging rollout to FlokiNET.

Important:
- Use the repo copy shared from the Mac as the source of truth for this pass, not GitHub, unless you confirm GitHub already has the latest v1.0.44 changes.
- Confirm client/package.json and server/client-version.json both say 1.0.44 before building.

Staging target:
- HTTPS host: https://staging.82.221.100.187.sslip.io
- server IP: 82.221.100.187
- SSH user: eddifyx
- staging app root: /opt/guild-staging
- staging updates dir: /opt/guild-staging/server/updates
- staging metadata file: /opt/guild-staging/server/client-version.json
- staging service: guild-staging

Goal:
- build the real Windows x64 v1.0.44 artifact
- test it locally against staging
- upload it to staging
- remove the Windows pin on staging so Windows inherits 1.0.44
- verify staging now serves 1.0.44 to Windows clients

Do this:

1. Open the shared repo copy from the Mac.
2. Confirm client/package.json and server/client-version.json both say 1.0.44.
3. Run npm install from the repo root.
4. Delete client/out and client/dist.
5. Build Windows from client with:
   npm run make -- --platform=win32 --arch=x64
6. Confirm the artifact exists at:
   client/out/make/zip/win32/x64/guild-win32-x64-1.0.44.zip
7. Extract it into a fresh test folder.
8. Launch guild.exe with:
   --profile=staging-v1-0-44-win
   --server-url=https://staging.82.221.100.187.sslip.io
9. Confirm the app starts and can log into staging.
10. Upload guild-win32-x64-1.0.44.zip to /home/eddifyx/ on 82.221.100.187.
11. SSH to the server and install it to:
    /opt/guild-staging/server/updates/guild-win32-x64-1.0.44.zip
12. Edit /opt/guild-staging/server/client-version.json and remove the platformOverrides entries for win32 and win32-x64 so Windows inherits base 1.0.44.
13. Restart:
    sudo systemctl restart guild-staging
14. Verify:
    https://staging.82.221.100.187.sslip.io/api/version?platform=win32-x64&localVersion=1.0.40
    returns version 1.0.44 with a Windows download URL.
15. Verify the Windows zip URL returns 200.

Constraints:
- Do not touch production paths under /opt/guild.
- Do not revert unrelated repo changes.
- Use the existing Windows SSH key setup.
- If the build fails, fix the actual blocker and continue until the Windows staging artifact is published or you hit a real external blocker.

At the end, report:
- local artifact path
- staging download URL
- whether Windows is now unpinned on staging
- whether the staging version API advertises 1.0.44 to win32-x64
- any blocker that remains
```
