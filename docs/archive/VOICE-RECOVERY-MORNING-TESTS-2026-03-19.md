Voice Recovery Morning Tests
Date: March 19, 2026

Goal
- Identify whether live voice is failing because of the producer path, the voice-audio secure/bypass path, or both.

What I changed overnight
- Restored the live mic send path to publish an AudioContext destination track again instead of the raw source track in safe mode.
- Added an optional voice-audio fail-open path so audio frames are not silently dropped if a voice key is missing.
- Added an optional forced diagnostics flag for test builds.

Primary hypothesis
- The most likely regression is the live mic producer path diverging from the mic-test path.
- Secondary hypothesis: voice audio frames can still get silently dropped if the transform path attaches without a usable voice key.

Test order
1. Producer-path build
2. Audio-bypass build
3. Diagnostic build

Interpretation
- If test 1 works:
  - Root cause was most likely the live producer path.
- If test 1 fails but test 2 works:
  - Root cause was most likely voice-audio bypass / missing-key frame drops.
- If test 1 and test 2 both fail:
  - Run test 3 and capture the on-screen diagnostics immediately.

Mac artifacts
- Producer-path app:
  - /Users/eddifyx/Documents/Projects/guild-main/client/out/voice-lab/producer-path/guild-producer-path.app
- Producer-path DMG:
  - /Users/eddifyx/Documents/Projects/guild-main/client/out/voice-lab/producer-path/guild-producer-path.dmg
- Producer-path ZIP:
  - /Users/eddifyx/Documents/Projects/guild-main/client/out/voice-lab/producer-path/guild-producer-path.zip
- Audio-bypass app:
  - /Users/eddifyx/Documents/Projects/guild-main/client/out/voice-lab/audio-bypass/guild-audio-bypass.app
- Audio-bypass DMG:
  - /Users/eddifyx/Documents/Projects/guild-main/client/out/voice-lab/audio-bypass/guild-audio-bypass.dmg
- Audio-bypass ZIP:
  - /Users/eddifyx/Documents/Projects/guild-main/client/out/voice-lab/audio-bypass/guild-audio-bypass.zip
- Diagnostic app:
  - /Users/eddifyx/Documents/Projects/guild-main/client/out/voice-lab/diagnostic/guild-diagnostic.app
- Diagnostic DMG:
  - /Users/eddifyx/Documents/Projects/guild-main/client/out/voice-lab/diagnostic/guild-diagnostic.dmg
- Diagnostic ZIP:
  - /Users/eddifyx/Documents/Projects/guild-main/client/out/voice-lab/diagnostic/guild-diagnostic.zip

Windows artifacts
- Producer-path ZIP:
  - /Users/eddifyx/Documents/Projects/guild-main/client/out/voice-lab/windows/producer-path/guild-win-producer-path.zip
- Audio-bypass ZIP:
  - /Users/eddifyx/Documents/Projects/guild-main/client/out/voice-lab/windows/audio-bypass/guild-win-audio-bypass.zip
- Diagnostic ZIP:
  - /Users/eddifyx/Documents/Projects/guild-main/client/out/voice-lab/windows/diagnostic/guild-win-diagnostic.zip

Flags in each variant
- Producer-path:
  - VITE_FORCE_VOICE_AUDIO_BYPASS=0
  - VITE_VOICE_AUDIO_FAIL_OPEN=0
  - VITE_FORCE_VOICE_DIAGNOSTICS=0
- Audio-bypass:
  - VITE_FORCE_VOICE_AUDIO_BYPASS=1
  - VITE_VOICE_AUDIO_FAIL_OPEN=1
  - VITE_FORCE_VOICE_DIAGNOSTICS=0
- Diagnostic:
  - VITE_FORCE_VOICE_AUDIO_BYPASS=1
  - VITE_VOICE_AUDIO_FAIL_OPEN=1
  - VITE_FORCE_VOICE_DIAGNOSTICS=1

Notes
- The three Mac ZIPs were recreated without AppleDouble `._*` files.
- The Mac test apps are signed local builds but not notarized test releases. Launching the `.app` bundles directly from disk is the safest local test path.
- I did not push any of these three variants to production.
