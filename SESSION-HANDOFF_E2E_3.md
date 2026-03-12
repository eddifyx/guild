# /guild E2E Encryption - Session Handoff #3

**Branch:** `feature/e2e-encryption`  
**Base commit at handoff:** `2490751`  
**Date:** 2026-03-08

---

## Current Status

- Phase 0: implemented and audited
- Phase 1: implemented and audited, including follow-up voice participant fixes
- Phase 2: implemented
- Phase 2.5: implemented in code, pending real-world manual validation
- Phase 3-7: planned, not started in this handoff

**Current recommendation:** finish the Phase 2.5 real-world DM trust test before starting Phase 3.

---

## What Was Completed In This Handoff

### Phase 0: Secure Boot / Fail-Closed App Shell

Goal: secure features are unavailable until crypto is ready.

Implemented:
- App-wide secure startup gating
- Blocking recovery UI instead of degraded-use warnings
- Login fails closed if secure startup fails
- Logout / session-expiry wins over in-flight crypto init

Key files:
- `client/src/App.jsx`
- `client/src/contexts/AuthContext.jsx`
- `client/src/contexts/SecurityContext.jsx`
- `client/src/components/Common/SecureBlockedView.jsx`
- `client/src/crypto/sessionManager.js`

Audit outcome:
- source-level Phase 0 looked good after fixing:
  - login succeeding into a blocked screen
  - logout/init race that could revive crypto after sign-out

### Phase 1: Remove Plaintext / Transport-Only Downgrades

Goal: encrypted or unavailable.

Implemented:
- message send now fail-closed when secure mode is expected
- file upload no longer silently falls back to plaintext in the target paths
- pasted images and picker uploads were moved toward the same secure send behavior
- voice / screen share no longer silently fall back to transport-only mode
- secure media errors block join/share instead of pretending success

Key files:
- `client/src/hooks/useMessages.js`
- `client/src/components/Chat/MessageInput.jsx`
- `client/src/components/Common/FileUploadButton.jsx`
- `client/src/hooks/useVoice.js`
- `client/src/crypto/voiceEncryption.js`
- `client/src/contexts/VoiceContext.jsx`
- `server/src/socket/voiceHandler.js`
- `client/src/components/Voice/VoiceControls.jsx`
- `client/src/components/Voice/VoiceChannelView.jsx`

Follow-up fixes after Phase 1.5 audit:
- stopped treating existing producers as equivalent to existing participants
- moved voice membership / key flow onto authoritative participant snapshots
- fixed brittle error classification that could mislabel secure-media failure as "no mic"

### Phase 2: First-Contact Trust Model

Goal: stop trusting server discovery as identity trust bootstrap.

Implemented:
- removed the DM crypto fallback that learned trusted `npub` values from the server user directory
- added stricter `npub`-based trust bootstrap in the new DM flow
- locked secure DMs until the user explicitly pins the contact's `npub`
- manual `npub` lookup path can open a trusted DM

Key files:
- `client/src/crypto/signalClient.js`
- `client/src/crypto/identityDirectory.js`
- `client/src/components/DirectMessages/NewDMModal.jsx`
- `client/src/components/Chat/ChatView.jsx`
- `client/src/components/Layout/Sidebar.jsx`
- `client/src/api.js`
- `server/src/routes/users.js`

### Phase 2.5: Trust Hardening

Goal: close the remaining trust bypasses before Phase 3.

Implemented:
- server-managed contacts are no longer auto-promoted into the trusted identity store
- DM send path now hard-checks for a trusted `npub`
- existing DM sessions no longer bypass trust enforcement just because a session already exists
- DM lock UI no longer pre-fills trust input from server-fed conversation metadata
- accepted-contact flow opens locked unless the user explicitly came through the manual trust bootstrap path

Key files:
- `client/src/crypto/identityDirectory.js`
- `client/src/crypto/signalClient.js`
- `client/src/hooks/useMessages.js`
- `client/src/components/Chat/ChatView.jsx`
- `client/src/components/DirectMessages/NewDMModal.jsx`
- `client/src/components/Layout/Sidebar.jsx`

---

## Additional Launch / Runtime Fixes Applied

These were necessary to get the project launching again during the security work.

### Electron main-process bridge path / packaging

Problems fixed:
- packaged and dev main process could not resolve `signalBridge`
- packaged builds were missing `client/electron/crypto/*` at runtime
- dev build had stale `.vite` crypto copies shadowing source fixes

Implemented:
- robust main-process `signalBridge` lookup
- packaged build copies `electron/crypto` runtime files
- asset path lookup made more stable for the app icon
- current packaged app archive was also hotfixed locally

Key files:
- `client/electron/main.js`
- `client/forge.config.js`

Local artifact note:
- backup created at `client/out/Byzantine-win32-x64/resources/app.asar.bak`

### libsignal ESM loading under Electron

Problem fixed:
- `@signalapp/libsignal-client` is ESM-only, but the Electron main-process bridge/store were using CommonJS `require()`

Implemented:
- switched bridge/store logic to lazy `import()`-based loading
- kept Electron files in CommonJS while resolving libsignal dynamically
- adjusted runtime load context so libsignal finds its native prebuild correctly under Electron

Key files:
- `client/electron/crypto/signalBridge.js`
- `client/electron/crypto/signalStore.js`

### Server-side native module isolation

Problem fixed:
- Electron uses Node 18 ABI 119
- local terminal/server uses Node 24 ABI 137
- both were fighting over the hoisted repo-root `better-sqlite3`

Implemented:
- created a server-local `better-sqlite3`
- rebuilt it against the local Node 24 ABI
- added a prestart/predev helper that keeps the server-local build aligned with the server runtime

Key files:
- `server/scripts/ensureBetterSqlite3.js`
- `server/package.json`

Verified:
- server-local `better-sqlite3` loads
- `server/src/db.js` loads successfully under the local Node runtime

---

## What Was Verified In This Handoff

Verified directly:
- syntax checks on the major Electron/source patches
- dynamic import of `@signalapp/libsignal-client`
- packaged `app.asar` contains the expected crypto bridge files
- server-local `better-sqlite3` loads successfully
- `server/src/db.js` loads successfully
- `server` predev helper now runs cleanly

Not yet fully verified:
- full interactive two-client Phase 2.5 trust smoke test
- full voice / screen-share live test after the latest launch/runtime fixes
- adversarial packet-capture / MITM validation

---

## Phase 2.5 Real-World Test To Run Next

Use two real accounts, `A` and `B`.

### Pass Conditions

1. Unknown / profile-started DM opens locked
2. Accepted contact from the picker still opens locked
3. Wrong `npub` does not unlock the DM
4. Correct `npub` unlocks the DM
5. Messaging works after trust is pinned
6. Manual `npub` path in New DM opens a trusted DM
7. Old DM session with trusted pins removed re-locks
8. Re-pinning survives restart

### Exact UI Labels Expected

From `New Secure DM`:
- `Opening a DM does not trust the other person's identity. Paste a verified npub only when you want to pin it for secure messaging.`
- contact row text: `Opens locked until you pin a verified npub`
- manual trust CTA: `Trust & Message`

From locked DM:
- `Secure DM is locked until you trust this contact's Nostr npub. Compare it over a trusted channel, then paste it here to unlock end-to-end messaging.`
- button: `Trust Nostr Identity`

Legacy-session relock helper:
```js
localStorage.removeItem('byzantine:trusted-user-npub-directory:v2')
location.reload()
```

Trust-store storage keys:
- observed: `byzantine:user-npub-directory:v2`
- trusted: `byzantine:trusted-user-npub-directory:v2`

---

## Plan Structure For Phase 3-7

### Phase 3: Unify Identity Enforcement And UI

Goal:
- one trust store, one truth

Work:
- move `trusted / changed / verified` state into the Electron Signal store
- expose trust state over IPC
- retire renderer-only identity truth for current sessions
- make `Verify Identity` and warning UI read the same state the crypto engine enforces
- hard-block on key change until explicit re-verification

Key files:
- `client/electron/crypto/signalStore.js`
- `client/electron/crypto/signalBridge.js`
- `client/electron/preload.js`
- `client/src/crypto/signalClient.js`
- `client/src/crypto/keyStore.js`
- `client/src/components/Chat/VerifyIdentityModal.jsx`
- `client/src/components/Chat/ChatView.jsx`

Exit criteria:
- UI and crypto engine always agree on identity status
- safety-number change cannot be bypassed by continuing to send

### Phase 4: Attachment Pipeline And Upload ACLs

Goal:
- no plaintext attachment leaks
- no auth-only file access

Work:
- create one shared attachment-preparation helper for picker, paste, drag/drop
- fail closed when E2E is expected but unavailable
- store upload scope metadata in DB
- replace raw `/uploads/...` serving with an authorized route
- authorize downloads by room / DM membership
- clean up orphaned uploads from failed sends

Key files:
- `client/src/components/Chat/MessageInput.jsx`
- `client/src/components/Common/FileUploadButton.jsx`
- `client/src/crypto/attachmentEncryption.js`
- `client/src/api.js`
- `server/src/routes/upload.js`
- `server/src/index.js`
- `server/src/socket/chatHandler.js`
- `server/src/db.js`

Likely new file:
- `server/src/routes/files.js`

Exit criteria:
- paste and picker share the same secure path
- unrelated authenticated users get `403` for foreign files
- no plaintext upload when secure mode is expected

### Phase 5: Voice And Screen Share E2E Repair

Goal:
- media E2E works reliably, or media does not start

Work:
- finish making participant membership authoritative for media key distribution
- verify incoming media keys against channel participant state
- ensure listener-only users are included in key flow
- remove all secure-media downgrade behavior
- abort join/share if media E2E setup fails
- validate late joiners, leave/rekey flows, and screen-share audio/video

Key files:
- `client/src/crypto/voiceEncryption.js`
- `client/src/hooks/useVoice.js`
- `client/src/components/Voice/VoiceChannelView.jsx`
- `client/src/components/Voice/VoiceControls.jsx`
- `server/src/routes/voice.js`
- `server/src/socket/voiceHandler.js`
- `client/src/hooks/useVoiceChannels.js`
- `client/src/contexts/VoiceContext.jsx`

Exit criteria:
- voice and screen share run only when media E2E is active
- all participants share the correct media key state
- media E2E failure blocks the feature cleanly

### Phase 6: Metadata Scoping

Goal:
- reduce privacy leakage that weakens the secure-messenger claim

Work:
- restrict `/api/users` to contacts, guildmates, or explicit `npub` lookup
- stop global presence broadcasts
- scope realtime metadata events to authorized viewers only
- review voice/channel socket events for guild/privacy leakage

Key files:
- `server/src/routes/users.js`
- `server/src/socket/presenceHandler.js`
- `client/src/components/Layout/Sidebar.jsx`
- `client/src/hooks/useOnlineUsers.js`
- `client/src/hooks/useVoiceChannels.js`

Exit criteria:
- random authenticated accounts cannot enumerate all users / presence
- metadata visibility is scoped to authorized users

### Phase 7: Adversarial Test Pass

Goal:
- verify the security claim against real behavior
- validate the actual /guild trust model: guild-scoped messaging, Nostr-bound identity, and fail-closed secure media

Tests:
- same-guild DM only starts when the contact resolves to the expected `npub` and a validly attested Signal bundle
- wrong `npub` or invalid bundle attestation cannot unlock DM
- cross-guild DM stays unavailable even when old conversation history exists
- stale untrusted legacy session is blocked until the contact is correctly repinned
- same trusted `npub` plus valid signed replacement bundle recovers under policy; mismatched identity hard-blocks
- pasted image or attachment with broken crypto uploads nothing usable
- foreign file fetch returns `403`
- server stores ciphertext for DM / room content and does not expose protected attachments without authorization
- voice and screen share either use media E2E or fail to start
- packet inspection confirms server cannot read media payloads

Ship gate:
- do not claim `fully E2E` until all adversarial checks pass
- marketing language must match what was actually proven: content E2E, not metadata anonymity or zero-knowledge privacy

---

## Current Launch Commands

Server:
```powershell
cd R:\Projects\byzantine
npm run dev:server
```

Client:
```powershell
cd R:\Projects\byzantine
npm run dev:client
```

Clean relaunch if needed:
```powershell
taskkill /IM electron.exe /F 2>$null
taskkill /IM byzantine.exe /F 2>$null
taskkill /IM node.exe /F 2>$null
```

---

## Recommended Next Step

Finish the Phase 2.5 real-world DM trust validation.

If that passes:
- start Phase 3

If it fails:
- patch the specific bypass before moving on
