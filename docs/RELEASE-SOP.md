# /guild Release SOP

## Goal

Ship desktop builds that are correct in source, correct as packaged artifacts,
and proven on the target OS before production metadata is flipped.

## Gold Standard Rules

1. Source correctness is not enough. Artifact correctness is a separate gate.
2. Artifact correctness is not enough. Target-OS startup is a separate gate.
3. Client and server rule changes ship as a matched set.
4. Production metadata flips last.
5. If any required proof is missing, the release is stop-ship.

## Release Types

### Normal Release

- built from a clean release workspace
- packaged on the target platform
- validated
- smoke tested
- then published

### Recovery Release

- used only to recover a broken live platform
- must ship as a new higher version
- must document exactly what was reused from the last known-good artifact
- must pass stricter packaged-runtime validation
- still must boot on the real target OS before metadata flip

Recovery packaging is not a shortcut around target-OS qualification.

## Release Lanes

Every client release must be evaluated against these lanes:

- Auth / secure startup
- Guild capabilities and `/guildchat` permissions
- Messaging: `/guildchat`, DMs, mentions
- OS notifications
- Voice / media
- Build / release / updater runtime

If a release changes one lane, do not assume the others are untouched just
because the source diff looks small. The packaged app replaces all lanes.

## Required Inputs Before Build

- last known-good production version
- clean release workspace or release branch
- exact approved client file list
- exact approved server file list
- target platform build host
- signing/notarization readiness for Mac
- real Windows machine available for Windows launch proof

## Build Rules

### Mac

1. Build from the clean release workspace.
2. Sign and notarize the `.app`.
3. Validate the `.app` after staple.
4. Build the updater zip with the safe archive path.
5. Validate the final updater zip, not just the app bundle.

### Windows

1. Preferred path: build on a real Windows machine from the clean release workspace.
2. Treat the Windows updater zip as a distinct artifact.
3. Validate the final zip itself before publish.
4. Extract the exact zip that will be published into a fresh folder.
5. Launch `guild.exe` on Windows and prove startup before metadata flip.

## Required Artifact Validation

Run these before publish:

```bash
npm run verify:client-version -- /absolute/path/to/server/client-version.json
npm run verify:release-proof -- --proof /absolute/path/to/release-proof.json --manifest /absolute/path/to/server/client-version.json --release-version X.Y.Z --artifact /absolute/path/to/guild-<platform>-<version>.zip
npm run verify:packaged-runtime -- /absolute/path/to/guild-<platform>-<version>.zip
npm run verify:lane-markers -- /absolute/path/to/guild-<platform>-<version>.zip
```

Platform-specific:

```bash
npm run verify:mac-update-zip -- /absolute/path/to/guild-darwin-arm64-<version>.zip
npm run verify:windows-update-zip -- /absolute/path/to/guild-win32-x64-<version>.zip
```

`verify:packaged-runtime` is mandatory because the build can succeed while the
packaged app is still missing runtime-managed files such as `config/appFlavor.js`
or `electron/crypto/*`.

## Required Target-OS Startup Proof

### Mac

- launch the exact packaged app or extracted updater artifact
- confirm it reaches home/login without main-process crash
- confirm signed/notarized app is accepted by Gatekeeper

### Windows

- extract the exact zip that will be published into a fresh folder
- launch `guild.exe`
- confirm it reaches login/home without:
  - `ERR_MODULE_NOT_FOUND`
  - `Unable to locate ...`
  - `Secure Startup Blocked`
  - missing native module errors

No Windows production push is valid until this proof exists.

## Required Lane Qualification

Run the lane checklist in [RELEASE-SMOKE-CHECKLIST.md](/Users/eddifyx/Documents/Projects/guild-main/docs/RELEASE-SMOKE-CHECKLIST.md)
against the exact packaged artifacts.

At minimum:

- fresh login and restored session
- `/guildchat` read/post
- `/guildchat` mention delivery
- DM send/receive and notification path
- OS notification click routing
- voice on the affected platforms
- real updater path from the previous production version

## Publish Order

1. Build artifacts.
2. Validate artifacts.
3. Prove target-OS startup.
4. Run lane smoke on the exact packaged artifacts.
5. Upload artifacts.
6. Verify live URLs return the expected files.
7. Publish the full `client-version.json` together with the validated release proof.
8. Verify version API responses for every platform.
9. Announce the release only after those checks pass.

## Stop-Ship Conditions

Do not ship if any of these are true:

- release was built from an unclean workspace
- client and server file lists are not matched and intentional
- packaged runtime validation fails
- lane marker validation fails
- Mac updater zip validation fails
- Windows updater zip validation fails
- target-OS startup proof is missing
- the build being tested is not the same build being published
- the release depends on a guessed cross-platform behavior rather than proof
- previous production version cannot update cleanly

## Rollback-Forward Rule

Never point production metadata backward and expect auto-update to downgrade
users.

If a live build is broken:

1. freeze the broken platform by override or minimum-version policy
2. build a new higher recovery version
3. validate that recovery artifact like a normal release
4. publish the recovery version

## Required Release Evidence

Record this for every production release:

- release version
- baseline version
- release workspace path
- client files changed
- server files changed
- exact artifact paths
- artifact validation results
- release proof path
- target-OS startup proof for each platform
- smoke test pair and lanes exercised
- updater path tested from which prior version
- ship decision and approver
