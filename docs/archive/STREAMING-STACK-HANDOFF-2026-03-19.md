# Streaming Stack Handoff

Date: 2026-03-19

Purpose: this is a repo-grounded handoff of the current video and screen-share streaming stack so an external firm can evaluate the implementation, reproduce the current behavior, and propose a concrete improvement plan.

This document is based on the code currently in this repo, not on older handoff notes unless called out explicitly as historical or stale.

## Executive Summary

The current stream stack is an Electron + React desktop client that captures screen/window media through Chromium desktop capture, sends media through `mediasoup-client`, and uses a Node.js + `mediasoup` SFU on the server. Signaling rides over Socket.IO. Media does not.

The current screen-share path is optimized around a fairly aggressive default sender profile:

- Initial profile starts at `1600x900`
- Initial target frame rate is `45 FPS`
- Initial max bitrate is up to `9 Mbps`
- Screen share uses a single outbound encoding layer
- There is no configured TURN layer in this repo
- The server is currently capped at 2 mediasoup workers

Users are reporting that screen share frequently lands around `15 FPS` and that streams freeze for about `10 seconds` at a time, consistently enough that this needs to be treated as a primary product issue.

My read of the code is that the most important things for the firm to validate first are:

- Whether the starting sender profile is too aggressive for real devices and networks
- Whether the lack of simulcast or a multi-layer ladder is forcing the entire stream to degrade globally
- Whether keyframe behavior during adaptation or packet loss recovery is contributing to the multi-second freezes
- Whether the lack of TURN or more robust network traversal is hurting stability on some user networks
- Whether the current diagnostics and runtime telemetry are too thin to isolate sender CPU pressure vs receiver decode pressure vs network issues

## Current User-Reported Problem

Please preserve this in any vendor brief:

> Users are reporting roughly 15 FPS during screen share, along with repeated freezes or stalls lasting about 10 seconds.

That symptom should be treated as the baseline reproduction target before the firm proposes any architecture change.

## End-to-End Topology

### Client

The desktop client is an Electron app with a React renderer.

Relevant client pieces:

- `client/electron/main.js`
- `client/electron/preload.js`
- `client/src/hooks/useVoice.js`
- `client/src/contexts/VoiceContext.jsx`
- `client/src/components/Stream/StreamView.jsx`
- `client/src/components/Stream/SourcePicker.jsx`
- `client/src/components/Voice/VoiceControls.jsx`
- `client/src/crypto/voiceEncryption.js`

### Server

The backend is a Node/Express app with Socket.IO for signaling and mediasoup for the SFU/media layer.

Relevant server pieces:

- `server/src/socket/voiceHandler.js`
- `server/src/voice/mediasoupManager.js`
- `server/src/monitoring/runtimeMetrics.js`
- `server/src/routes/devDashboard.js`

### Control Plane vs Media Plane

Control plane:

- Socket.IO is used for joining voice channels, creating transports, connecting transports, producing, consuming, mute/deafen state, speaking state, and screen-share state.
- The client socket path uses `websocket` with `polling` fallback.

Media plane:

- Actual audio/video media goes through mediasoup `WebRtcTransport`s.
- Media is not carried through Socket.IO.

This distinction matters because improvements can be needed at the media layer even when signaling looks healthy.

## Runtime and Package Versions

From the current repo:

Client:

- Electron `^28.3.3`
- React `18.2.0`
- `mediasoup-client` `^3.18.7`
- `socket.io-client` `^4.7.4`

Server:

- `mediasoup` `^3.19.3`
- `socket.io` `^4.7.4`
- Express `^4.18.2`

There is also a repo note indicating mediasoup setup expects Node 22 or newer on the server side for clean installation.

## Signaling Flow

Main events in the current implementation include:

- `voice:join`
- `voice:create-transport`
- `voice:connect-transport`
- `voice:produce`
- `voice:consume`
- `voice:resume-consumer`
- mute/deafen updates
- speaking updates
- screen-share state updates

The server-side signaling entry point is `server/src/socket/voiceHandler.js`.

The client-side orchestration happens mostly in `client/src/hooks/useVoice.js`.

## Server SFU Architecture

### mediasoup Router Codecs

The server configures the mediasoup router with:

- Audio: Opus, 48 kHz, 2 channels
- Video: VP8, 90 kHz

Optional experimental codecs can be enabled with env flags:

- H264 if `MEDIASOUP_ENABLE_EXPERIMENTAL_SCREEN_CODECS=1`
- AV1 if `MEDIASOUP_ENABLE_EXPERIMENTAL_SCREEN_CODECS=1` and `MEDIASOUP_ENABLE_EXPERIMENTAL_AV1=1`

Current H264 parameters in code:

- `level-asymmetry-allowed: 1`
- `packetization-mode: 1`
- `profile-level-id: 42e01f`

Important point: VP8 is the default non-experimental screen video codec path in the current repo.

### Worker Topology

The mediasoup worker count is capped to:

- `Math.min(os.cpus().length, 2)`

That means the current implementation will use at most 2 mediasoup workers even on larger server hardware.

This is a very important scaling detail for the firm to review.

### Transport Configuration

Current WebRTC transport configuration includes:

- `listenIps: [{ ip: '0.0.0.0', announcedIp: ANNOUNCED_IP }]`
- `enableUdp: true`
- `enableTcp: true`
- `preferUdp: true`
- `initialAvailableOutgoingBitrate: 10_000_000`

Default RTP/RTC port window:

- `MEDIASOUP_RTC_MIN_PORT` default `10000`
- `MEDIASOUP_RTC_MAX_PORT` default `10100`

That is a narrow default port range and worth validating under load.

### Peer/Transport Model

Per peer, the server maintains:

- Dedicated send transport map
- Single recv transport
- Producers map
- Consumers map

The current client/server design separates microphone send transport and screen-share send transport, while using a single recv transport for inbound media.

### No Transcoding or Recording Path Found

I did not find a server-side transcoding pipeline or a server-side recording path in the current streaming stack.

The current server behaves like an SFU that routes media rather than a media processor that re-encodes screen share for different receiver profiles.

### No TURN/Coturn Config Found in Repo

I did not find a repo-managed TURN/coturn deployment or explicit client ICE server configuration for TURN.

I also did not find application-level `iceServers` being injected on the client side in the current code snapshot.

Implication:

- The firm should assume the current deployment primarily relies on mediasoup transport connectivity through the advertised IP/port setup unless there is infrastructure that lives outside this repo.

If there is external TURN infrastructure today, it is not represented clearly in this codebase and should be documented separately.

## Client Capture and Wrapper Stack

### Electron Display Capture Wrapper

Electron main process code overrides Chromium display-media handling in `client/electron/main.js`.

The renderer interacts with the main process through `client/electron/preload.js`, which exposes methods such as:

- `prefetchDesktopSources`
- `getDesktopSources`
- `getDesktopWindows`
- `getDesktopThumbnails`
- `selectDesktopSource`
- `getScreenCaptureAccessStatus`
- `openScreenCaptureSettings`

### Windows Screen Share Audio

On Windows, when audio is requested for display capture, the Electron handler returns:

- `audio = 'loopback'`

That means Windows system audio capture is using Chromium/Electron loopback behavior, not a separate in-app virtual device setup.

### macOS Screen Share Audio

On macOS, the app checks for virtual audio devices and only enables "Also share audio" if a supported device is present.

The source picker currently checks names like:

- BlackHole
- Soundflower
- Loopback Audio
- VB-Cable

If no supported virtual device is available, macOS screen-share audio is effectively disabled in the UX and the UI points users toward BlackHole installation.

### macOS Screen Recording Permission

The main process checks macOS screen recording permission using system APIs and can deep-link users to System Settings if access is missing.

## Current Screen Share Capture Spec

### Capture Request

The client requests screen capture with an aggressive ideal target:

- Ideal width: `1920`
- Ideal height: `1080`
- Ideal frame rate: `45`
- Max frame rate: `60`

Audio behavior depends on platform:

- Windows can request display audio loopback
- macOS display audio depends on the virtual-device path

### Post-Capture Constraint Application

After the capture track is created, the app applies additional constraints based on the selected screen-share quality profile.

This is important because the effective stream profile is not just whatever `getDisplayMedia()` first returns. The app further tunes the video track afterward.

### Content Hints

The client sets track `contentHint` based on the source:

- `motion` when sharing audio
- otherwise `detail`
- fallback to `text` if needed

That means the current stack is actively trying to bias encode behavior depending on whether the shared content looks more like video/motion or detailed static content.

## Current Screen Share Quality Profiles

The code defines 3 screen-share profiles:

### `high-fps`

- Resolution: `1600x900`
- FPS: `45`
- Max bitrate: `9,000,000`
- Screen-share audio max bitrate: `96,000`
- Start bitrate hint: `4,500 kbps`
- Min bitrate hint: `2,000 kbps`

### `balanced`

- Resolution: `1280x720`
- FPS: `45`
- Max bitrate: `6,500,000`
- Screen-share audio max bitrate: `96,000`
- Start bitrate hint: `3,200 kbps`
- Min bitrate hint: `1,500 kbps`

### `efficiency`

- Resolution: `1280x720`
- FPS: `30`
- Max bitrate: `4,000,000`
- Screen-share audio max bitrate: `96,000`
- Start bitrate hint: `2,000 kbps`
- Min bitrate hint: `1,000 kbps`

### Important Behavioral Detail

The stream starts on the highest profile first.

The code tracks a `lowResourceHint`, but in the current implementation that hint is used for diagnostics and does not appear to change the initial screen-share profile selection.

This matters because weaker senders may be starting in a mode they cannot sustain.

## Producer Setup and Encoding Behavior

### Separate Screen Send Transport

Screen share uses a dedicated send transport, separate from the microphone transport.

That is a sound structural decision because it isolates stream publishing logic from mic publishing logic.

The transport creation path also opts into encoded insertable streams, which lines up with the E2EE transform layer used by the app.

### Single Encoding Layer

The screen-share producer currently uses a single outbound encoding entry with parameters such as:

- `maxBitrate`
- `maxFramerate`
- `scaleResolutionDownBy`
- `priority: 'high'`
- `networkPriority: 'high'`
- `scalabilityMode: 'L1T3'`

Crucial detail:

- There is only one encoding object.
- There is no multi-RID simulcast ladder in the current screen-share path.

That means the sender is effectively publishing one main version of the stream, not multiple receiver-selectable quality layers.

### SVC Note

The current code sets `scalabilityMode: 'L1T3'`.

That may provide temporal layering depending on codec/browser behavior, but it is not the same thing as a full spatial simulcast ladder with multiple resolutions.

In practical terms, this still leaves the stack without the kind of multi-layer delivery flexibility many large RTC screen-share products rely on.

### Codec Bitrate Hints

The client passes codec options like:

- `videoGoogleStartBitrate`
- `videoGoogleMinBitrate`
- `videoGoogleMaxBitrate`

These are codec/encoder hints, not guarantees.

## Codec Selection Logic

### Current Default

The current default codec preference path resolves to VP8.

### Experimental Codec Support

The client has a local storage key:

- `guild:screenShareCodecMode`

The ranking logic can consider VP8, H264, and AV1 candidates.

However, the current experimental-codec enablement function returns true only in dev mode:

- `Boolean(import.meta.env.DEV)`

That means older notes about staging preferring AV1 are not aligned with the current code snapshot unless there is separate build behavior outside this repo that changes this path.

### Candidate Fallback Behavior

Even when a codec preference exists, the client builds a ranked candidate list and attempts to produce using those candidates in order until one succeeds.

That is a useful resilience behavior, but it also means the actual runtime codec may not match a preferred codec if negotiation or production fails.

## End-to-End Encryption Layer

### E2EE Strategy

The stack uses Insertable Streams / encoded transforms for voice and screen-share E2EE.

This is implemented in `client/src/crypto/voiceEncryption.js`.

### Header Preservation by Codec

The encryption logic preserves a codec-specific number of header bytes:

- Opus: 1 byte
- VP8: 10 bytes
- VP9: 10 bytes
- H264: 5 bytes
- AV1: 16 bytes

### AV1 Special Handling

For AV1, the code strips temporal delimiter OBUs before encryption.

There is also logic that can bypass E2EE for experimental AV1 screen video in a narrowly defined case:

- Source must be `screen-video`
- Experimental screen codecs must be enabled
- Codec must be `video/av1`

That path labels screen-video E2EE mode as either:

- `encrypted`
- `bypassed-staging-av1`

### Why This Matters

The firm should explicitly review whether the encoded transform layer is affecting:

- Sender CPU usage
- Frame pacing
- Recovery after packet loss or keyframe dependency
- Browser/Electron codec path differences

This is especially worth checking for high-resolution screen share.

## Consumer Path and Playback

### Consumer Creation

When a new producer appears, the client requests a consume operation and creates a mediasoup consumer on the recv transport.

The server creates consumers in a paused state.

The client finishes its setup, including decryption setup if needed, and then asks the server to resume the consumer.

### Keyframe Request Behavior

The server explicitly requests a keyframe when resuming a video consumer.

I did not find an equally explicit keyframe request tied to sender profile changes during runtime adaptation.

That does not prove a bug, but it is a very plausible area for the firm to inspect given the reported multi-second freezes.

### Remote Playback Model

Remote screen video and screen audio are handled separately:

- Video is rendered in a muted `<video>` element
- Screen-share audio is played through separate `Audio()` elements on the client

This split is important when diagnosing "stream freeze" complaints because video may stall while the audio path behaves differently.

## Runtime Adaptation Logic

### Polling Cadence

The client polls screen-share stats every `1500 ms`.

### Adaptation Timing

Current thresholds:

- Hold time after change: `8000 ms`
- Downgrade after `3` bad samples
- Upgrade after `8` good samples

### Downgrade Triggers

The sender can downgrade when it detects conditions like:

- `qualityLimitationReason === 'cpu'`
- Available outgoing bitrate below 50 percent of profile max
- RTT above 220 ms combined with bitrate shortfall
- Pacing pressure where limitation reason is not none and sent FPS drops below a threshold

### Upgrade Triggers

The sender can upgrade when it sees:

- Limitation reason `none`
- Available outgoing bitrate above the next profile's needs
- RTT under a safer threshold

### What Actually Changes on Adaptation

When the profile changes, the client updates:

- Track constraints
- `contentHint`
- Sender params like max bitrate and max frame rate
- `scaleResolutionDownBy`
- `scalabilityMode`

### Why This Is Important

This is sender-driven global adaptation of one outbound stream.

Because there is no multi-quality simulcast ladder, the adaptation strategy effectively decides one compromise stream for everyone.

That can be good for simplicity, but it also means:

- One constrained sender can drag quality down for all receivers
- One slow receiver cannot independently subscribe to a lower spatial layer because those layers do not exist

## UI and Product-Level Constraints

The UI currently allows only one active stream at a time through a client-side check in the voice controls.

I did not find strong server-side enforcement for "exactly one stream in the channel" in the current code snapshot, so that appears to be mainly a client UX rule.

## Diagnostics and Observability

### Client-Side Stats

The diagnostics summarizer already extracts a lot of useful WebRTC stats, including:

- Sent and received FPS
- Frame dimensions
- RTT
- Available bitrates
- Encoder and decoder implementation names
- Power-efficient encoder and decoder flags
- `freezeCount`
- `pauseCount`

This is promising, because the raw materials for deeper diagnosis are partly present.

### Diagnostics Panel Gap

There is a `VoiceDiagnosticsPanel.jsx` component in the repo, but I did not find it mounted in the current app flow.

That suggests the diagnostics panel exists in code but is not actually surfaced in the current UI.

### Server-Side Monitoring

The server runtime metrics and ops dashboard track:

- Active voice channels
- Active participants
- Active speakers
- Active screen shares
- mediasoup worker counts
- Room counts
- Transport counts
- Producer counts
- Consumer counts
- Voice event counters

### Observability Gap

The server-side monitoring does not currently look like a strong source of per-stream quality history.

In other words:

- It can tell you that streaming infrastructure is active
- It does not appear to give you a great view into why a specific screen share dropped to 15 FPS or froze for 10 seconds

For a consulting engagement, this observability gap matters a lot.

## Confirmed Mismatches Between Current Code and Older Notes

### Old docs mention 1080p30, current code targets 45 FPS

Some older handoff notes describe the stream target more like `1920x1080 @ 30 FPS`.

The current code is more aggressive:

- Capture requests go up to `1920x1080`
- Profile targets start at `1600x900 @ 45 FPS`

That is a meaningful difference.

### Old docs mention staging AV1 preference, current code does not clearly reflect that

Older notes discuss AV1 preference on Windows staging.

The current client code snapshot only treats experimental codec enablement as dev-mode gated.

The firm should work from the actual code path, not from historical notes.

### Diagnostics overlay instructions appear stale

Older notes reference an on-screen sender diagnostics overlay.

The current repo does contain diagnostics UI code, but I did not find it wired into the present app.

### macOS source prefetch path appears inconsistent

There is also a likely mismatch in the current macOS source prefetch path:

- The join flow calls desktop source prefetch only when the platform is not macOS
- The Electron prefetch implementation itself returns early unless the platform is macOS

This looks inverted in the current repo snapshot.

It is more likely to affect source picker responsiveness than live stream FPS, but it is still worth flagging because it suggests the capture stack has at least one stale platform-specific branch.

## Potential Pressure Points and Likely Failure Areas

The following items are my informed interpretation of the current implementation. They should be treated as hypotheses to validate, not as proven root causes.

### 1. Default sender profile may be too aggressive

The stream starts at `1600x900 @ 45 FPS` with up to `9 Mbps`.

For screen share, that can be expensive on:

- Mid-tier laptops
- External-display workflows
- Hardware encoder paths with Electron/Chromium quirks
- CPU-constrained devices
- Weak or unstable uplinks

If the sender cannot sustain that starting profile, a user can easily observe degraded real-world frame rate even before adaptation has time to react.

### 2. No simulcast means poor conditions affect everyone

Because screen share currently publishes a single main encoding, the system lacks a flexible multi-layer quality ladder.

That means:

- Per-receiver optimization is limited
- One stream quality decision is shared broadly
- Recovery options are thinner than in a modern simulcast-based screen-share stack

### 3. Freeze recovery may depend too much on natural keyframes

The code clearly requests keyframes when a video consumer is resumed.

I did not see the same kind of explicit keyframe request after adaptation/profile changes.

Given the symptom of repeated freezes lasting around 10 seconds, the firm should inspect whether some stalls persist until a natural keyframe arrives.

### 4. No clearly represented TURN layer is a risk

If there is truly no TURN path in production, then network traversal and path stability may be weaker than expected for some users or enterprise networks.

Even if connectivity succeeds, borderline paths can contribute to instability and stall behavior.

### 5. Adaptation may be too slow to save bad starts cleanly

With:

- 1.5 second stat polling
- 8 second hold after changes
- several samples required to downgrade

the sender may remain in a bad state longer than users will tolerate.

### 6. E2EE transform cost may be non-trivial

Insertable Streams E2EE is valuable, but it adds work to the send and receive path.

The firm should measure its cost specifically on:

- Windows screen share
- macOS screen share
- high-motion content
- text-heavy content
- integrated GPU vs discrete GPU devices

### 7. Server worker cap may become a bottleneck

The 2-worker cap may be fine for light load, but it is a firm review item if many rooms or heavy screen-share usage are expected.

### 8. Narrow RTP port range should be reviewed

The `10000-10100` default range is narrow enough that the firm should sanity-check it against actual concurrency and infrastructure behavior.

## Questions the External Firm Should Answer

I would frame the consulting engagement around these questions:

1. What is the real bottleneck behind the observed `~15 FPS` and `~10 second freezes`?
2. Is the bottleneck primarily sender CPU, sender encode path, receiver decode path, SFU/network path, or keyframe/recovery behavior?
3. Should the stack stay on VP8 for now, or should H264 or AV1 be introduced more deliberately for screen share?
4. Should screen share move to proper simulcast or another multi-layer strategy?
5. Should the default startup profile be reduced so the stream begins in a safer mode and upgrades only when the sender proves it can handle it?
6. Do we need TURN or a more explicit ICE/networking strategy?
7. Do we need better production telemetry before making architectural changes?
8. Is the current Electron/Chromium version part of the performance problem?
9. Is the E2EE transform layer materially affecting screen-share smoothness?
10. Do we need more explicit keyframe control or recovery logic?

## Concrete Improvement Ideas to Evaluate

These are not final recommendations. They are the most obvious candidate workstreams for the firm to test.

### Lower the default startup profile

Possible direction:

- Start at `1280x720 @ 30 FPS` or similar
- Upgrade only after healthy stats

This is likely the fastest way to reduce visible pain if the current startup profile is simply too ambitious.

### Add real multi-layer screen-share delivery

Possible direction:

- Simulcast or another robust layered strategy
- Receiver-specific quality selection

This would improve flexibility, especially when channel participants have mixed device/network quality.

### Review keyframe strategy

Possible direction:

- Force or request keyframes after major sender profile changes
- Instrument keyframe intervals and freeze correlation

This is especially relevant to the repeated freeze symptom.

### Add or document TURN

Possible direction:

- Confirm whether TURN exists today outside the repo
- If not, test a TURN-backed deployment path

### Improve production diagnostics

Possible direction:

- Surface sender and receiver stream stats in production-safe diagnostics
- Capture FPS, freeze count, RTT, bitrate, codec, encoder implementation, and adaptation events per stream

Without this, many architecture decisions will be guesswork.

### Measure E2EE overhead directly

Possible direction:

- A/B measure with and without encoded transforms in controlled environments
- Separate capture, encode, encrypt, transport, decode, and render timing as much as possible

### Reassess worker and port sizing

Possible direction:

- Review mediasoup worker cap
- Review port range size
- Review CPU saturation under expected concurrency

## Recommended Deliverables From the Firm

I would ask the firm for the following:

1. A reproduction report for the current `15 FPS` / `10 second freeze` symptom.
2. A bottleneck attribution report separating sender, receiver, SFU, and network causes.
3. A prioritized improvement plan with "fastest relief" vs "best long-term architecture" options.
4. Concrete codec guidance: VP8 vs H264 vs AV1 for this app, on this Electron baseline.
5. Concrete transport guidance: whether TURN or ICE changes are needed.
6. Concrete layering guidance: whether to implement simulcast, SVC changes, or another approach for screen share.
7. A telemetry plan so future regressions are measurable in production.

## Bottom Line

The current stack is a serious real-time media implementation, but it is not yet structured like a highly resilient modern screen-share system.

The big confirmed facts are:

- Aggressive starting screen-share profile
- Single outbound screen encoding
- mediasoup SFU with default VP8 path
- E2EE insertable-stream transforms
- No obvious repo-level TURN config
- Thin production-quality diagnostics

The most important symptom to center is:

- Users report around `15 FPS`
- Users report repeated freezes lasting about `10 seconds`

If the external firm can isolate whether that is mainly a startup-profile problem, a keyframe/recovery problem, a network traversal problem, or a single-layer delivery problem, they should be able to come back with a practical improvement plan rather quickly.
