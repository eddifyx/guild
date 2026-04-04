# /guild Gold Standard Stabilization Rules

## Why This Exists

We were fixing one issue and silently replacing adjacent behavior in the same
desktop bundle. The point of the stabilization pass is to stop guessing, stop
shipping partial proof, and stop letting users become the first runtime test.

## Core Principle

Every desktop release must be proven in three layers:

1. the source is correct
2. the packaged artifact is correct
3. the packaged artifact boots and works on the target OS

Missing any one of those means the release is not ready.

## Gold Standard Rules

1. No net-new feature work during stabilization unless it is part of recovery.
2. Structural client and server rule changes ship as a matched set.
3. Voice, mentions, `/guildchat`, notifications, secure startup, and updater runtime are release-gated lanes.
4. Production metadata flips only after artifact validation and target-OS proof.
5. Emergency hotfixes must be backported into the stabilization lane the same day.
6. Recovery packages are allowed only as higher-version forward fixes, never as quiet downgrades.

## What We Do Not Allow Anymore

- “The source diff is small so the packaged app is probably fine.”
- “The zip validator passed so startup is probably fine.”
- “Mac worked so Windows is probably fine.”
- “We can ship now and test after publish.”

## Required Proof Before Shipping

- exact artifact path that was tested
- exact server files deployed with it
- exact validator output
- exact target-OS startup proof for each affected platform
- smoke notes for each affected lane
- `npm run test:stabilization` result from the release workspace

## Recovery Release Rule

If production breaks:

1. freeze or override the broken platform immediately
2. build a new higher recovery version
3. validate the recovery artifact with the same or stricter gates
4. publish only after target-OS startup is proven

## Stop Conditions

Do not ship if any of these are true:

- the build being tested is not the build being published
- a lane regression is being guessed at instead of reproduced
- packaged runtime validation is missing
- Windows launch proof is missing for a Windows release
- Mac launch proof is missing for a Mac release

## Current Standard

The standard release path is:

1. clean release workspace
2. artifact validation
3. target-OS startup proof
4. lane smoke
5. publish full manifest
6. verify live feeds
