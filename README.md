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
- `server/` Express + Socket.IO backend
- `docs/` supporting implementation notes
- `scripts/` local dev helpers

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

- [Guild System](./docs/GUILD-SYSTEM.md)
- [DeepFilter Integration](./docs/deepfilter-integration.md)

## Compatibility Notes

The public branding is now **/guild**. Some internal compatibility identifiers still use older legacy names so existing profiles, caches, encrypted state, and packaged update flows continue to work.
