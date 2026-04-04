# /guild

/guild is a Nostr-authenticated guild chat app with end-to-end encrypted DMs, attachments, voice, and screen share.

## Highlights

- guild-scoped text, voice, and live stream spaces
- same-guild secure DMs with identity attestation
- encrypted attachments with ACL-protected file fetches
- fail-closed secure voice and screen share
- Nostr-backed identity with signed Signal bundle attestation

## Repo Layout

- `client/` Electron + React desktop client
- `mobile/` Expo + EAS mobile scaffold for iOS TestFlight and Android store builds
- `server/` Express + Socket.IO backend
- `docs/` supporting implementation notes
- `scripts/` local dev helpers

## Mobile

The repo now includes a dedicated `mobile/` workspace for managed iOS and
Android builds. It is the right path for TestFlight and Zapstore packaging,
but it is not yet a feature-complete port of the Electron client. The current
secure messaging, persistence, and media stack still lives in Electron-native
runtime code.

See [Mobile App Runbook](./docs/MOBILE-APP-RUNBOOK.md) for the current mobile
release flow and the remaining productization work.

## Development

Install dependencies from the repo root:

```bash
npm install
```

Run the server:

```bash
npm run dev:server
```

Then start one or more client profiles in separate terminals:

```bash
npm run dev:client:a
npm run dev:client:b
npm run dev:client:c
npm run dev:client:profile -- E
```

## Docs

- [Docs Index](./docs/README.md)
- [Release SOP](./docs/RELEASE-SOP.md)
- [Release Smoke Checklist](./docs/RELEASE-SMOKE-CHECKLIST.md)
- [Release Lanes](./docs/ARCHITECTURE-LANES.md)
- [Guild System](./docs/GUILD-SYSTEM.md)
- [DeepFilter Integration](./docs/deepfilter-integration.md)

## Compatibility Notes

The public branding is now **/guild**. Some internal compatibility identifiers still use older legacy names so existing profiles, caches, encrypted state, and packaged update flows continue to work.
