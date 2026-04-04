# Windows Codex Stream Baseline Prompt for v1.0.44

Paste the prompt below directly into Codex on the Windows machine.

```text
Use the current local /guild v1.0.44 setup on this Windows machine to baseline screen share quality against the staging server before any AV1 implementation work starts.

Do not change code yet. This is a baseline QA and capability-check pass only.

Environment:
- staging server: https://staging.82.221.100.187.sslip.io
- Windows app profile to use: staging-v1-0-44-win-av1

Tasks:

1. Launch the current Windows /guild build against staging with:
   --profile=staging-v1-0-44-win-av1
   --server-url=https://staging.82.221.100.187.sslip.io

2. Confirm the app connects to staging and can join voice successfully.

3. Use the Windows machine as the sender and have the Mac receive.

4. Run a 90-second screen-share baseline test from Windows with a realistic moving source.
   Preferred source order:
   - a game in borderless-windowed mode
   - a browser tab with moving video
   - a busy desktop/app window if needed

5. During the 90-second run, capture and report the sender overlay values for:
   - Codec
   - Captured resolution/fps
   - Sent resolution/fps
   - Bitrate
   - RTT
   - Limitation reason
   - Active profile if shown

6. Report the:
   - best observed sent fps
   - lowest observed sent fps
   - best observed sent resolution
   - lowest observed sent resolution
   - whether voice stayed stable during the stream
   - whether the receiver ever saw a black frame or long frozen first frame

7. Check codec capability support on this Windows machine and report whether AV1 appears available for WebRTC send.
   If Node and Electron tooling are available, inspect the runtime capability path rather than guessing.
   A valid answer is whether the runtime exposes AV1 in video sender capabilities, plus any H264/VP8 support seen.

8. Stop after the baseline report. Do not implement AV1 yet.

At the end, report in this exact shape:

- staging connection: success or failure
- sender machine: Windows build details if available
- receiver machine: Mac staging client
- baseline codec used:
- best sent resolution/fps:
- lowest sent resolution/fps:
- average behavior summary:
- RTT range:
- limitation reasons seen:
- voice stability during streaming:
- black frame or frozen join issue:
- AV1 send capability detected: yes/no/unclear
- recommended next step:

Constraints:
- Do not modify production.
- Do not modify code.
- Do not rebuild unless the current Windows artifact is missing or broken.
```
