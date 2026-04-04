Use the transferred /guild v1.0.44 repo snapshot as the source of truth for the AV1 staging pass.

Goal:
- build the updated Windows client from this snapshot
- launch it against staging
- verify that screen share now prefers AV1 on Windows staging when available
- run a 90-second sender test with Windows as sender and Mac as receiver
- report whether AV1 actually improved fps stability versus the VP8 baseline

Facts:
- staging server is already updated to advertise AV1 in mediasoup
- staging URL is https://staging.82.221.100.187.sslip.io
- use the existing Windows staging profile name if present: staging-v1-0-44-win-av1

Before building, verify these code expectations:
- client/src/hooks/useVoice.js contains:
  - SCREEN_SHARE_CODEC_MODE_STORAGE_KEY
  - getRuntimeScreenShareCodecMode()
  - getPreferredScreenShareCodecCandidates()
  - logic that prefers AV1 on Windows staging by default
- client/src/crypto/voiceEncryption.js contains:
  - CODEC_UNENCRYPTED_HEADER_BYTES
  - stripAv1TemporalDelimiterObus()
  - codec-aware attachSenderEncryption / attachReceiverDecryption options
- server/src/voice/mediasoupManager.js contains video/AV1 in ROUTER_MEDIA_CODECS

Build steps:
1. Run npm install from the repo root if needed.
2. Delete client/out and client/dist.
3. Build Windows:
   cd client
   npm run make -- --platform=win32 --arch=x64
4. Confirm artifact exists at:
   client/out/make/zip/win32/x64/guild-win32-x64-1.0.44.zip
5. Extract it to a fresh test folder.
6. Launch guild.exe with:
   --profile=staging-v1-0-44-win-av1
   --server-url=https://staging.82.221.100.187.sslip.io

Test steps:
1. Sign in to staging.
2. Join the same staging voice channel as the Mac receiver.
3. Start a 90-second screen share from Windows using:
   - first choice: full display capture with a moving game in borderless windowed mode
   - fallback: a moving browser video
4. While streaming, capture the sender overlay values for:
   - Codec
   - Captured resolution/fps
   - Sent resolution/fps
   - Bitrate
   - RTT
   - Limitation reason
   - Active profile
5. Note whether the Mac receiver saw:
   - black frame
   - frozen first frame
   - long single-frame stalls
6. Note whether voice stayed stable during the stream.

Return results in this exact shape:
- build artifact:
- staging connection:
- codec used:
- captured resolution/fps best:
- captured resolution/fps lowest:
- sent resolution/fps best:
- sent resolution/fps lowest:
- bitrate range:
- RTT range:
- limitation reasons seen:
- active profile:
- voice stability during streaming:
- Mac receiver issue seen:
- comparison versus prior VP8 baseline:
- recommended next step:
