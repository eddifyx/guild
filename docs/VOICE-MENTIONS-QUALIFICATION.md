# Voice And Mentions Qualification

## Goal

Prove where a failure lives before making a behavioral change.

## Client Diagnostics

The packaged client now keeps a rolling in-memory diagnostics buffer.

Open DevTools on the affected client and run:

```js
window.__guildLaneDiagnostics?.read?.()
```

Clear it with:

```js
window.__guildLaneDiagnostics?.clear?.()
```

To get live console traces for a lane:

```js
localStorage.setItem('guild:diagnostics', 'true')
localStorage.setItem('guild:diagnostics:voice', 'true')
localStorage.setItem('guild:diagnostics:messaging', 'true')
```

Then fully reload the app.

## What To Capture For Mentions

1. Confirm the exact packaged version.
2. Clear diagnostics.
3. Have user A mention user B in `/guildchat`.
4. On user B, capture:
   - `guildchat_mention_socket_received`
   - `guildchat_mention_suppressed`
   - `guildchat_mention_notification_requested`
   - `system_notification_attempt`
   - `system_notification_action` if clicked

Interpretation:

- no `guildchat_mention_socket_received`: server emit or socket delivery issue
- socket received but suppressed: client policy issue
- notification requested but not shown: platform bridge issue
- notification shown but action wrong: route handling issue

## What To Capture For Voice

1. Confirm exact packaged versions on both clients.
2. Clear diagnostics on both clients.
3. Join the same voice channel from both clients.
4. Capture:
   - `join_requested`
   - `join_ack`
   - `send_transport_created`
   - `recv_transport_created`
   - `new_producer_socket`
   - `consume_requested`
   - `consumer_ready`
   - `join_failed` if present

Interpretation:

- no `join_ack`: socket/server join issue
- join ack but no transports: client mediasoup setup issue
- new producer seen but no consumer ready: receive/consume issue
- consumer ready on both sides but no audio: playback, mute, sink, or media transform issue

## Server Diagnostics

Check `/api/dev/metrics` and inspect:

- `traffic.chat.recentEvents`
- `traffic.voice.recentEvents`
- `notes`

Important chat events:

- `guildchat:join`
- `guildchat:permission_denied`
- `guildchat:invalid_payload`
- `guildchat:invalid_mentions`
- `guildchat:mention_emitted`

Important voice events:

- `voice:invalid_payload`
- `voice:join_requested`
- `voice:join_ready`
- `voice:transport_created`
- `voice:transport_connected`
- `voice:producer_ready`
- `voice:consumer_ready`

## Artifact Qualification

Before live qualification, run the offline stabilization tests:

```bash
npm run test:stabilization
```

Then verify the packaged artifact markers:

```bash
npm run verify:packaged-runtime -- /absolute/path/to/guild-<platform>-<version>.zip
npm run verify:lane-markers -- /absolute/path/to/guild-darwin-arm64-<version>.zip
```

or

```bash
npm run verify:packaged-runtime -- /absolute/path/to/guild-<platform>-<version>.zip
npm run verify:lane-markers -- /absolute/path/to/guild-win32-x64-<version>.zip
```

This is not a substitute for live smoke, but it prevents publishing an artifact
that is obviously missing the runtime files or lane paths we expect to test.
