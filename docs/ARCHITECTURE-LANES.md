# /guild Release Lanes

## Goal

Define where each critical behavior lives, who owns the rule, and what must be
proven before we ship a desktop build.

## 1. Auth / Session / Secure Startup

Source of truth:

- server auth/session rules
- client secure-startup state machine

Must be owned here:

- login modes
- restored session behavior
- blocked vs recoverable startup

Required release proof:

- fresh login
- restored session relaunch
- no startup crash on packaged clients

## 2. Guild Domain

Source of truth:

- server capability resolver

Must be owned here:

- membership
- ranks
- effective permissions
- per-member overrides
- universal `/guildchat` access policy

Required release proof:

- lowest-rank member can read `/guildchat`
- lowest-rank member can post in `/guildchat`
- client uses server-provided capabilities, not local guesses

## 3. Messaging Domain

Source of truth:

- server mention and delivery rules
- client messaging state and rendering

Must be owned here:

- boards
- DMs
- `/guildchat`
- mention extraction and delivery
- unread mention state

Required release proof:

- `/guildchat` mention autocomplete works
- `/guildchat` mention reaches the target user
- DM send/receive works
- DM notification path works

## 4. Notifications Domain

Source of truth:

- Electron platform bridge
- client notification coordinator

Must be owned here:

- OS notification eligibility
- hidden/minimized notification path
- notification click routing

Required release proof:

- hidden app receives DM notification
- hidden app receives `/guildchat` mention notification
- click returns to the correct surface

## 5. Voice / Stream Media

Source of truth:

- server voice session lifecycle
- client media/session lifecycle

Must be owned here:

- join/leave
- send/receive transports
- consume path
- mute/deafen state

Required release proof:

- affected platform pairs can hear each other
- mute/unmute works
- no silent join regressions

## 6. Build / Release / Update Platform

Source of truth:

- packaged artifact validators
- release manifest
- target-OS startup proof

Must be owned here:

- updater zip correctness
- packaged runtime file presence
- version manifest correctness
- publish and rollback-forward rules

Required release proof:

- artifact validators pass
- packaged runtime validator passes
- target-OS startup is proven on the actual platform
- version API serves the intended artifact

## Lane Rules

1. DB stores state, not policy.
2. Server owns canonical business rules.
3. Routes and sockets adapt contracts, not invent rules.
4. Client renders and orchestrates, but does not become the authority for critical permissions.
5. Build success never overrides missing lane proof.
