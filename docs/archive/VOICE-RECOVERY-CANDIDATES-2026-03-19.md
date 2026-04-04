# Voice Recovery Candidates

Date: March 19, 2026

## Staging Server

Staging server has the audio-consumer simplification patch live:

- audio consumers no longer start paused
- screen-video consumers still start paused

Server file changed:

- `/Users/eddifyx/Documents/Projects/guild-main/server/src/voice/mediasoupManager.js`

## Candidate Builds

All candidate apps are staging builds.

### Candidate A

Change set:

- audio consumers start unpaused
- current voice safe mode kept otherwise

Mac:

- `/Users/eddifyx/Documents/Projects/guild-main/client/out/voice-recovery-candidates/candidate-a/guild-staging-voice-candidate-a.app`

Windows:

- `C:\voicecand\a`

### Candidate B

Change set:

- candidate A changes
- force fresh raw mic capture every time
- disable Opus DTX

Mac:

- `/Users/eddifyx/Documents/Projects/guild-main/client/out/voice-recovery-candidates/candidate-b/guild-staging-voice-candidate-b.app`

Windows:

- `C:\voicecand\b`

### Candidate C

Change set:

- candidate B changes
- disable insertable-stream transport settings for voice

Mac:

- `/Users/eddifyx/Documents/Projects/guild-main/client/out/voice-recovery-candidates/candidate-c/guild-staging-voice-candidate-c.app`

Windows:

- `C:\voicecand\c`

## Test Order

1. Candidate A
2. Candidate B
3. Candidate C

Use the same candidate on both Mac and Windows for each test.

## What To Check

For each candidate:

1. full quit and relaunch on both machines
2. join the same staging voice channel
3. speak both directions
4. verify whether:
   - remote voice is audible
   - mic indicators still move
   - screen share still works

## Current Read

Most likely failure buckets, in order:

1. audio consumer paused/resume path
2. live mic producer path / no packets
3. insertable-stream voice transport interaction

## Workspace State

Current checked-out source is left on candidate A:

- audio consumers start unpaused
- fresh-capture, Opus DTX, and transport changes are off in source
