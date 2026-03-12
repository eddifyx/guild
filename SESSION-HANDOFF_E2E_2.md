# /guild E2E Encryption — Session Handoff #2

**Branch:** `feature/e2e-encryption`
**Latest commit:** `0a766a1` — Add multi-method Nostr login: QR code, nsec, and bunker URI
**Date:** 2026-03-05

---

## What Was Done This Session

### Login Screen Redesign — Multi-Method Auth
Redesigned the login screen from a single bunker:// URI input to three auth methods:

**Main screen** shows two prominent buttons:
1. **"Sign in with QR"** (primary) — generates `nostrconnect://` URI, displays QR code on click
2. **"Sign in with key"** (secondary) — navigates to nsec paste view

Plus bottom links:
- **"New to Nostr?"** — opens `https://primal.net` externally
- **"Advanced"** — bunker:// URI input (original NIP-46 flow)
- **"Server settings"** — custom server URL

### QR Code Login (nostrconnect://)
- App generates ephemeral keypair + `nostrconnect://` URI via `createNostrConnectURI()` from nostr-tools
- Rendered as QR code using `qrcode.react`
- `BunkerSigner.fromURI()` subscribes to relays and waits for signer to connect back
- Uses 3 relays for better connectivity: `relay.damus.io`, `relay.nsec.app`, `nos.lol`
- QR connection only initiates when user clicks through (not on page load)
- AbortController cancels relay subscriptions when navigating away

### nsec Login (Local Signing)
- User pastes `nsec1...` private key (password field, placeholder: "Paste your nsec here")
- Decoded via `nip19.decode()`, pubkey derived via `getPublicKey()`
- Challenge signed locally with `finalizeEvent()` — no NIP-46 relay needed
- nsec encrypted via Electron's `safeStorage` (DPAPI on Windows) before storage
- On reconnect, nsec decrypted from storage, pubkey derived, ready to sign
- Reassurance text: "Your key is encrypted and stored securely on this device. It never leaves your machine."

### Architecture Changes

**New/modified files:**

| File | Changes |
|------|---------|
| `client/package.json` | Added `qrcode.react` dependency |
| `client/src/components/Auth/LoginScreen.jsx` | Full redesign: 4 views (main/qr/nsec/bunker), QR rendering, back navigation |
| `client/src/contexts/AuthContext.jsx` | Added `nsecLogin()`, `nostrConnectLogin()`, shared `_authenticateWithServer()` helper |
| `client/src/utils/nostrConnect.js` | Added `createNostrConnectSession()`, `decodeNsec()`, `persistNsec()`, `loadNsec()`, `getNsecSigner()`, `signWithNsec()`. Updated `reconnect()` to try nsec first. Updated `getSigner()` to return nsec-based signer. Updated `disconnect()` to clear nsec storage. |

**Auth flow for nsec:**
```
User pastes nsec → decodeNsec() → getPublicKey()
  → fetchProfile() from relays (best-effort)
  → GET /api/auth/nostr/challenge → { challenge }
  → finalizeEvent(kind:22242, challenge) signed locally
  → POST /api/auth/nostr → { token, userId, ... }
  → persistNsec() via safeStorage (DPAPI)
  → initializeCryptoIdentity()
```

**Auth flow for QR:**
```
User clicks "Sign in with QR"
  → generateSecretKey() → ephemeral keypair
  → createNostrConnectURI() with 3 relays
  → QR code displayed
  → BunkerSigner.fromURI() subscribes to relays, waits
  → Signer scans QR, sends connect response with secret
  → BunkerSigner resolves → proceed with challenge-response (same as bunker flow)
```

---

## Known Issues / In Progress

### QR Code + Primal
- Tested scanning QR with Primal on mobile — Primal recognized the `nostrconnect://` URI and prompted to sign
- After signing, /guild did not pick up the connection
- Initially was using only `wss://relay.nsec.app` — switched to 3 relays but didn't get to re-test
- May be a timing issue (subscription not established before Primal sends response) or Primal may not fully implement NIP-46 connect flow
- **Next step:** Test with Amber (Android) which is the canonical NIP-46 signer, and debug with console logs

### nsec Login
- Not yet tested end-to-end (built and compiles, but needs manual testing)
- Session persistence (auto-login on restart) not tested

### From Previous Sessions (Still Open)
- Run `npm install` on server with Node >= 22 in clean environment
- Full E2E testing of messaging, voice, screen share encryption
- Mic-less joiners can't receive voice keys unless they produce media

---

## How to Resume

1. `git checkout feature/e2e-encryption && git pull`
2. `cd client && npm install` (picks up qrcode.react)
3. `cd server && npm install`
4. Start server: `cd server && npm start`
5. Start client: `cd client && npm start`

### Testing Priorities
- [ ] nsec login: paste nsec, verify challenge-response completes, verify encrypted storage
- [ ] nsec reconnect: close app, reopen, verify auto-login from encrypted nsec
- [ ] QR login with Amber (Android NIP-46 signer)
- [ ] QR login debugging: add console logs to `fromURI` flow if still not connecting
- [ ] Logout clears both nsec and NIP-46 session data
- [ ] Old localStorage auth doesn't break new flow (clear `C:/Users/<user>/AppData/Roaming/byzantine/Local Storage` if stuck)
