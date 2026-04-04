# /guild Stabilization Plan

## Goal

Stop shipping reactive hotfixes and move into a short, deliberate stabilization phase that restores trust in:

- voice and screen share
- auth/session persistence
- update/install flow
- production release hygiene

This plan assumes we freeze new features until the app is boring and predictable again.

Feature freeze does not mean bug freeze.

We do not ossify anything that is currently broken. The whole point of the stabilization pass is to keep shipping targeted fixes to critical paths until:

- screen share works
- audio send/receive works
- updates work
- session persistence works

Only net-new feature work is frozen.

## What Went Wrong

Recent releases showed the same pattern repeatedly:

- experimental media code leaked into production UX
- staging assumptions were not isolated strongly enough from prod
- packaging changes fixed one platform while breaking another
- updater compatibility was not consistently preserved for older clients
- auth/session startup behavior changed across updates in ways users could not predict
- we validated parts of the system instead of validating the full user flow end to end

The root problem is not one bug. It is that release safety currently depends on memory and manual judgment instead of hard gates.

## Stabilization Rules

These rules stay in place until the stabilization pass is complete:

1. No new features in production.
2. No experimental codecs in production.
3. No debug overlays, staging toggles, or diagnostics UI in production.
4. No release without a same-version Mac and Windows smoke pass.
5. No release without testing the real update path from the previous production version.
6. No release if any known critical path is still “we think it works.”
7. Critical-path bugs continue moving even during feature freeze.

## Workstreams

### 1. Production Hygiene

Objective:
- make production builds incapable of showing staging/debug behavior

Tasks:
- remove all renderer debug overlays from production bundles
- make experimental codec paths dev-only or staging-only behind hard environment gates
- clear any persisted localStorage codec/debug overrides when not in dev
- add a built-artifact string scrub before release

Required artifact checks:
- no `REMOTE STREAM STATS`
- no `Receiver AV1`
- no `guild:showStreamDiagnostics`
- no staging-only labels or bypass markers

### 2. Voice + Screen Share Reliability

Objective:
- get one known-good cross-platform path working consistently before any codec experiments resume

Production target during stabilization:
- VP8 only
- no AV1 in prod
- no H264 unless explicitly requalified

Tasks:
- lock production server media router to known-good codec set
- remove client-side remembered codec overrides from prod
- simplify Mac share-start flow so failures stay inline and do not point users at fake permission fixes
- fix source picker thumbnail reliability on macOS
- verify Mac receive path against Windows sender and vice versa
- verify that speaking indicators and outbound mic audio are actually sent

Stop-ship conditions:
- black remote stream on either platform
- local speaking meter works but remote voice is not heard
- screen share start throws user into unusable permission loop

### 3. Auth + Session Persistence

Objective:
- users should not be forced back through key login after update/relaunch unless the server truly invalidated the session

Tasks:
- preserve `/guild` auth session across update/restart
- prevent signer-backed setup tasks from blocking restored sessions
- separate “restored app session” from “reconnected signer” more cleanly in UI
- verify fresh login, update login persistence, and ordinary relaunch persistence on both platforms

Stop-ship conditions:
- update causes forced relogin
- restart causes `Secure Startup Blocked` for a valid session
- restored sessions fail because a signer is not already in memory

### 4. Packaging + Native Runtime Stability

Objective:
- package once, run the same way everywhere, with no missing runtime modules

Tasks:
- standardize native runtime inclusion for libsignal and sqlite across Mac and Windows
- verify packaged app bundle contains the expected runtime files before publish
- keep package size improvements, but not at the expense of runtime correctness
- verify notarization/signing as a distinct release step, not an assumed one

Stop-ship conditions:
- packaged app cannot initialize Signal
- prod updater artifact differs materially from tested artifact
- Mac release is unsigned or unnotarized when notarization is required

### 5. Updater + Compatibility

Objective:
- older clients must have one reliable path to the latest release

Tasks:
- preserve legacy updater aliases where older builds depend on them
- verify platform-specific API version responses from previous production versions
- validate both manual-download and in-app update paths
- verify update leaves voice cleanly before install

Stop-ship conditions:
- prior production version cannot discover latest release
- updater returns HTTP 500 or broken archive path
- updater installs a build that fails startup/login

### 6. Release Process

Objective:
- stop relying on memory; encode release discipline into a checklist

Pre-release gates for every production push:

1. Build Mac artifact.
2. Build Windows artifact on Windows.
3. Verify packaged contents for native runtime modules.
4. Scrub built artifacts for debug/staging strings.
5. Smoke test previous production -> current production update on Mac.
6. Smoke test previous production -> current production update on Windows.
7. Smoke test voice join, DM send, room send, screen share send, and screen share receive on both platforms.
8. Verify session persists after update and ordinary relaunch.
9. Verify production API responses for both platforms.
10. Only then flip production metadata.

## Immediate Priority Order

### Phase 0: Unbreak Critical Paths

These are not optional cleanup items. They are the minimum bar before we can call the app stable enough to freeze feature work with confidence.

- fix Mac screen-share start so it no longer dead-ends on false privacy/security messaging
- fix Mac -> Windows and Windows -> Mac live stream reliability
- fix outbound Mac mic send / speaking indicator / remote hearability
- fix update-session persistence so users are not forced back through key login
- fix prior-version updater compatibility on both platforms

Nothing else gets to claim success while these are still broken.

### Phase A: Stop the bleeding

- keep production on the simplest known-good media path
- remove all experimental media and debug leakage from production
- fix forced relogin/update-session regressions
- fix Mac false permission prison

### Phase B: Requalify critical paths

- Windows -> Mac screen share
- Mac -> Windows screen share
- Mac mic send / speaking indicator / remote hearability
- update from prior production versions

### Phase C: Release safety

- codify the release checklist
- verify actual packaged artifacts, not just source code
- keep staging and production behavior hard-separated

### Phase D: Resume experiments carefully

Only after the app is stable again:

- reintroduce codec experiments behind explicit staging-only flags
- test AV1 on supported Windows hardware only
- require receiver-side verification before calling any codec work successful

## Definition of Done

We exit stabilization only when all of the following are true:

- Mac and Windows can both update from the previous production version successfully
- users stay logged in across update and relaunch
- voice works reliably on both platforms
- screen share works reliably in both directions
- no production build shows staging/debug UI
- production releases can be repeated without surprise regressions

## Next Release Recommendation

The next release should not be framed as “new features.”

It should be a stabilization release focused on:

- production hygiene cleanup
- session persistence
- updater safety
- voice/screen-share reliability
- Mac permission-flow cleanup

That release should only ship after a full cross-platform smoke pass.
