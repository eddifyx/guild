# /guild E2E Encryption — Session Handoff

**Branch:** `feature/e2e-encryption`
**Latest commit:** `d076588` — Add session auth, Nostr challenge-response, voice/video E2E hardening
**Date:** 2026-03-04

---

## What Was Done (Across All Sessions)

### Session 1: Signal Protocol E2E Encryption
- Implemented full Signal Protocol stack: X3DH key exchange, Double Ratchet, Sender Keys
- E2E encrypted DMs (pairwise), room messages (sender keys), file attachments, and voice frames
- Client-side: `client/src/crypto/` — primitives, identityKeys, prekeys, x3dh, doubleRatchet, senderKeys, messageEncryption, attachmentEncryption, voiceEncryption, sessionManager, keyStore
- Server-side: `server/src/routes/keys.js` — prekey bundle storage/retrieval
- IndexedDB-backed key store with encrypted-at-rest identity keys

### Session 2: NIP-46 Remote Signing
- Replaced raw nsec login with NIP-46 remote signing (bunker URI / npub + relay)
- Client connects to remote signer, never touches private keys
- Profile fetched from relays (best-effort)
- `client/src/utils/nostrConnect.js` — NIP-46 protocol implementation

### Session 3: Security Audit + Session Authentication
- **Session tokens**: Server issues 256-bit random tokens on login, stored in SQLite `sessions` table
- **Nostr challenge-response**: `GET /api/auth/nostr/challenge` → client signs NIP-42 event → `POST /api/auth/nostr` verifies Schnorr signature → issues token
- **Removed username login**: Nostr-only authentication
- **All API calls**: `Authorization: Bearer <token>` (replaced `x-user-id` header)
- **Socket.IO**: Token validated in handshake middleware
- **Global 401 handler**: Clears auth, redirects to login on session expiry
- **Files**: `server/src/routes/auth.js`, `server/src/middleware/authMiddleware.js`, `server/src/socket/index.js`, `server/src/db.js`, `server/src/utils/nostrVerify.js`, `client/src/api.js`, `client/src/contexts/AuthContext.jsx`, `client/src/socket.js`, `client/src/contexts/SocketContext.jsx`, `client/src/components/Auth/LoginScreen.jsx`

### Session 4: E2E Hardening + Voice/Video Encryption Fixes
- **Prekey bundle proof of possession**: Ed25519 signature required on upload; rotation proof required when signing key changes
- **Voice E2E UI**: Lock icon (green=E2E, orange=transport-only), persistent warning banner on degradation
- **Screen share E2E**: Added `attachSenderEncryption` to screen share producer, removed `kind === 'audio'` gate on receiver decryption
- **Epoch collision fix (join)**: Only first user in channel generates voice key; subsequent joiners wait to receive it
- **Epoch collision fix (peer leave)**: Deterministic leader election — lowest userId re-keys
- **Mic-less joiner fix**: Screen share generates voice key if none exists
- **Crypto hardening**: Sender key epoch validation, TOFU identity verification, Double Ratchet chain limits, attachment digest verification, X3DH bundle signature validation

---

## Architecture Overview

### Authentication Flow
```
Client                          Server
  |                               |
  |-- GET /api/auth/nostr/challenge -->
  |<-- { challenge } ------------|
  |                               |
  | [NIP-46 signer signs          |
  |  kind:22242 event with        |
  |  challenge tag]               |
  |                               |
  |-- POST /api/auth/nostr ------>|
  |   { signedEvent, profile }    | [verify Schnorr sig, consume challenge]
  |<-- { userId, token, ... } ----|
  |                               |
  | [All subsequent requests:]    |
  |-- Authorization: Bearer <token> -->
```

### E2E Encryption Layers
1. **DMs**: X3DH → Double Ratchet (pairwise, forward secrecy per message)
2. **Room messages**: Sender Keys (one encrypt, many decrypt)
3. **File attachments**: AES-256-GCM with per-file random key, key sent in encrypted message
4. **Voice/video frames**: AES-256-GCM via Insertable Streams API, shared symmetric key distributed via encrypted DMs

### Voice Key Exchange Flow
```
User A joins (first) → generates key epoch=1, attaches encryption transform
User B joins → receives key from A via handleNewProducer → encrypted DM
User C joins → receives key from A and B via handleNewProducer
User B leaves → lowest userId among remaining (A or C) generates new key, distributes
```

### Key Files
| Path | Purpose |
|------|---------|
| `client/src/crypto/primitives.js` | Low-level crypto ops (AES-GCM, X25519, Ed25519, HKDF) |
| `client/src/crypto/sessionManager.js` | E2E session lifecycle, identity init, key upload |
| `client/src/crypto/messageEncryption.js` | Encrypt/decrypt DMs and room messages |
| `client/src/crypto/voiceEncryption.js` | Frame encryption, key management, Insertable Streams |
| `client/src/hooks/useVoice.js` | Voice/video orchestration, key distribution, leader election |
| `server/src/routes/auth.js` | Nostr challenge-response, session token issuance |
| `server/src/routes/keys.js` | Prekey bundle storage with proof verification |
| `server/src/middleware/authMiddleware.js` | Bearer token validation |
| `server/src/utils/nostrVerify.js` | Nostr event verification (Schnorr + SHA-256) |

---

## Known Issues / Not Yet Done

### Must Do Before Merge
1. **Run `npm install` on server with Node >= 22** — mediasoup requires it. The `@noble/curves` and `@noble/hashes` packages were added to `server/package.json` but haven't been installed in a clean environment.
2. **End-to-end testing** — No runtime testing has been done. The full login flow, messaging, voice, and screen share need manual testing.

### Known Limitations
- **Mic-less joiners who don't screen share**: They never produce media, so existing participants never learn they joined via `handleNewProducer`. They can receive encrypted audio/video but existing users don't send them the key. They'll hear silence until they either unmute or start sharing. This is a design limitation of the "distribute key on new producer" approach.
- **Existing username-only users are orphaned**: They remain in the DB (messages preserved) but can no longer log in since username login was removed.
- **No key backup/recovery**: If IndexedDB is cleared, all E2E keys are lost. Messages encrypted with old keys become unreadable.

### Nice to Have (Future)
- Key verification UI (QR code / safety number comparison)
- Multi-device support (key synchronization)
- Message history re-encryption on key rotation
- Audit log for key changes

---

## How to Resume Work

1. `git checkout feature/e2e-encryption`
2. `git pull origin feature/e2e-encryption`
3. `cd server && npm install` (Node >= 22 required for mediasoup)
4. `cd client && npm install`
5. Start server: `cd server && npm start`
6. Start client: `cd client && npm start`
7. Test login with a Nostr bunker URI (e.g., nsecBunker, Amber)

### Testing Checklist
- [ ] Nostr login via bunker URI works (challenge-response flow)
- [ ] Session persists across page reload
- [ ] 401 on expired/invalid token redirects to login
- [ ] Logout invalidates token server-side
- [ ] DMs are E2E encrypted (check lock icon)
- [ ] Room messages are E2E encrypted
- [ ] File attachments encrypted/decrypted correctly
- [ ] Voice call shows green lock icon (E2E active)
- [ ] Screen share is E2E encrypted
- [ ] Second user joining voice receives key from first user
- [ ] User leaving triggers re-key by lowest-userId participant
- [ ] Prekey bundle upload requires valid proof of possession
