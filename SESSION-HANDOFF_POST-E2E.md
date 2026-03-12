# /guild Post-E2E Handoff

**Branch:** `feature/e2e-encryption`  
**Date:** 2026-03-11

---

## Current Status

The seven-phase end-to-end encryption roadmap is complete.

- Phases 1-7 were implemented, hardened, and manually validated
- Messages, attachments, and secure voice / screen share now operate under the fail-closed E2E model
- Phase 7 adversarial checks were completed against the live app

There are no more planned E2E implementation phases in the current roadmap.

---

## What Was Accomplished

### Phases 1-7 Completed

The E2E implementation work is now in place across:

- secure app boot / fail-closed startup
- no plaintext or transport-only downgrades in protected flows
- Nostr-first DM trust and identity binding
- unified identity verification and trust UX
- attachment protection and ACL enforcement
- metadata scoping for presence, guild visibility, and DM availability
- adversarial validation of the security claim

### What Phase 7 Proved

The validation pass covered:

- same-guild DM only works when the contact resolves to the expected `npub` and valid signed Signal bundle
- wrong `npub` / invalid attestation hard-blocks DM
- cross-guild DM stays unavailable
- stale bad trust state stays blocked until correctly repinned
- broken encrypted attachments do not send as usable content
- foreign protected file fetches return `403`
- server-side message storage is ciphertext, not plaintext
- secure voice / screen share fail closed when trust is broken
- packet capture did not reveal readable protected content, though the packet proof should still be treated as practical rather than formal-lab grade

### Product Claim We Can Support

After this work, /guild can honestly be described as:

- end-to-end encrypted for messages
- end-to-end encrypted for attachments
- end-to-end encrypted for secure voice / screen share when active

Important non-claims:

- not metadata-free
- not anonymous
- not formally audited by an external security firm

---

## Remaining Work

What remains is release hardening, cleanup, and product polish, not more core E2E implementation.

### 1. Release Claim / Messaging

Write the exact public-facing language for:

- landing page / marketing copy
- in-app trust and safety copy
- FAQ language around what E2E does and does not protect

Recommended stance:

- claim encrypted content protection clearly
- avoid overstating anonymity or metadata protection
- avoid claiming formal audit unless one is completed

### 2. Cleanup Pass

Do a targeted cleanup of:

- dead legacy trust code that no longer participates in enforcement
- stale renderer-only verification remnants
- noisy console warnings or temporary debug handling introduced during the E2E rollout

### 3. Short Ship-Readiness Regression Pass

Run one final short regression pass over:

- same-guild DM open / send / relog recovery
- cross-guild DM cutoff
- encrypted attachments send / receive / protected fetch denial
- secure voice join / switch / rejoin / screen share
- guild leave / join transitions affecting visibility and DM scope

### 4. Branding / Compatibility Notes

The product should now be referred to publicly and in GitHub-facing materials as **/guild**.

However, several internal legacy identifiers intentionally still use the old `byzantine` naming for compatibility:

- localStorage / IndexedDB keys
- default seeded guild and rank IDs
- packaged app / updater artifact names
- cryptographic protocol labels and attestation scopes

These were left in place to avoid breaking existing profiles, caches, encrypted sessions, and update behavior.

Important constraint:

- the literal string `/guild` is safe for branding and UI copy
- it is **not** safe as a direct executable, bundle, or filesystem folder name without a dedicated migration plan

### 5. Packaging / Migration Confidence

Before broad release, confirm:

- packaged clients still preserve the E2E behaviors seen in dev
- profile upgrades do not regress trust or message-cache handling
- restart / crash recovery does not reintroduce insecure fallbacks
- decide whether packaged artifact names should stay legacy-compatible or get a formal migration

### 6. Optional Higher-Assurance Follow-Up

Not required to ship the E2E claim, but valuable later:

- external security review or audit
- cleaner packet-capture proof with a quieter host / isolated network
- multi-device and key transfer design
- key backup / recovery UX

---

## Recommended Next Order

1. Write final security / marketing language
2. Do a short ship-readiness regression pass
3. Clean dead code and noisy debug leftovers
4. Validate packaged build / migration behavior
5. Decide whether to schedule an external review or packaging migration

---

## Bottom Line

The E2E implementation journey is functionally complete. What remains is the work required to ship, communicate, and maintain the feature set responsibly.
