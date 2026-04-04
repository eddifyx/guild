# /guild Observability Conventions

## Goal

When a user reports “feature X is broken,” we should be able to identify the failing lane quickly instead of guessing across client, socket, and packaging layers.

## Conventions

### Auth / Session / Secure Startup

Log with:

- lane: `auth`
- event: `secure_startup_begin`
- event: `secure_startup_blocked`
- event: `secure_startup_recoverable`
- event: `secure_startup_ready`

Always include:

- platform
- appVersion
- userId when available
- blocking reason or recovery reason

### Guild / Permissions

Log with:

- lane: `guild`
- event: `capability_snapshot_computed`
- event: `guild_permission_denied`

Always include:

- guildId
- userId
- permissionKey
- rankOrder

### Messaging / Guild Chat / Mentions

Log with:

- lane: `messaging`
- event: `guildchat_join_denied`
- event: `guildchat_post_denied`
- event: `guildchat_mention_emitted`
- event: `notification_suppressed`

Always include:

- guildId or roomId
- userId
- messageId when relevant
- suppression reason when relevant

### Voice

Log with:

- lane: `voice`
- event: `voice_join_requested`
- event: `voice_transport_failed`
- event: `voice_consumer_stalled`
- event: `voice_media_ready`

Always include:

- channelId
- userId
- platform
- safeMode state

### Build / Release / Update

Log with:

- lane: `release`
- event: `artifact_validation_started`
- event: `artifact_validation_failed`
- event: `artifact_validation_passed`
- event: `version_manifest_invalid`
- event: `metadata_flip_ready`

Always include:

- platform
- version
- artifact path or URL

## Rule

Do not add logs that only say “failed.” Emit lane, event, stable identifiers, and the concrete reason so the next production issue can be traced without a guessing loop.
