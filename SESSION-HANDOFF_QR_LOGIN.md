# /guild QR Login - Session Handoff

**Date:** 2026-03-13

## Current Status

QR login is working again.

The final root cause was on `/guild`'s side:
- real NIP-46 signers expected `sign_event` payload JSON to include `pubkey`
- `/guild` had removed `pubkey` from remote `sign_event` requests
- the signers then stalled or returned parse errors instead of signing

The fix was to restore `pubkey` in remote `sign_event` event templates while still leaving `id` and `sig` for the signer to produce.

## Final Outcome

Confirmed working:
- QR handshake completes
- NIP-46 session is established
- `/guild` login auth succeeds
- secure startup continues after login

The decisive real-signer error before the fix was:

```text
Failed to parse event JSON: missing field `pubkey`
```

After restoring `pubkey`, login succeeded.

## Files That Matter

Primary QR / auth files:
- `client/src/utils/nostrConnect.js`
- `client/src/utils/nip46Trace.js`
- `client/src/contexts/AuthContext.jsx`
- `client/src/components/Auth/LoginScreen.jsx`

Secure startup / attestation file:
- `client/src/crypto/bundleAttestation.js`

Reference repos inspected during debugging:
- `/tmp/aegis-ios`
- `/tmp/primal-web-app`

Debug harnesses used:
- `scripts/mock-nip46-signer.mjs`
- `scripts/test-nip46-roundtrip.mjs`

## Final Fixes Kept In Code

### QR / NIP-46 transport

In `client/src/utils/nostrConnect.js`:
- QR relay is now `wss://nos.lol`
- `createNostrConnectSession()` treats `BunkerSigner.fromURI()` as already connected
- redundant post-QR `.connect()` call was removed
- QR flow skips redundant `get_public_key` when `signer.bp.pubkey` is already known
- relay cooldowns remain in place to avoid request bursts
- relay/subscription/signer tracing remains in place

### Remote login auth shape

In `client/src/contexts/AuthContext.jsx`:
- primary remote auth event is standard NIP-42 `kind:22242`
- compatibility fallback remains `kind:1`
- remote `sign_event` templates now include `pubkey`
- remote templates still do **not** include `id` or `sig`
- NIP-04 fallback remains as a last resort

### Secure startup attestation

In `client/src/crypto/bundleAttestation.js`:
- remote bundle attestation `sign_event` templates now also include `pubkey`
- `id` and `sig` are still left for the signer

## Important Behavioral Findings

### 1. `relay.damus.io` was a bad fit for this flow

Problems seen on `relay.damus.io`:
- rate limiting during `get_public_key`
- inconsistent QR/session behavior

`wss://nos.lol` worked better for both:
- real QR tests
- controlled NIP-46 roundtrip tests

### 2. `fromURI()` behavior mattered

`nostr-tools` treats `BunkerSigner.fromURI()` as already connected.

Calling `.connect()` again after QR handshake created avoidable incompatibility with some signers, especially Primal's remote login mode.

### 3. Real signers were stricter than the mock signer

The controlled mock signer proved the overall `/guild` flow was internally coherent.

But real signers revealed the actual compatibility bug:
- they expected `pubkey` in the event JSON passed to `sign_event`

This is why:
- the mock signer could succeed
- several real signers still failed until the final shape fix landed

## What Was Tested

Tested against:
- AEGIS iOS / TestFlight
- Amber
- Primal mobile remote login
- controlled mock signer

Observed progression during debugging:
1. QR handshake bugs on `/guild` were fixed
2. relay choice and redundant calls were corrected
3. smoke-test instrumentation showed the remaining break was before server auth
4. one signer finally returned a concrete error instead of timing out:
   - `missing field pubkey`
5. restoring `pubkey` fixed the issue

## What To Remember If This Breaks Again

If QR login regresses, check these first:
- relay is still `wss://nos.lol`
- QR flow is not calling `.connect()` after `fromURI()`
- remote `sign_event` payloads include `pubkey`
- remote payloads do **not** include `id` or `sig`

Useful UI/debug tools already in the app:
- `Copy NIP-46 Trace`
- `Copy QR URI`

The trace utility in `client/src/utils/nip46Trace.js` is still valuable and was intentionally left in place.

## Short Root Cause

`/guild` was sending malformed remote `sign_event` event JSON by omitting `pubkey`, and real signer apps rejected it.
