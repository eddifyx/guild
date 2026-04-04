# Guild System — Discord-style Servers

## Overview

/guild now supports **guilds** — the equivalent of Discord servers. Each guild is a fully isolated community with its own text rooms, voice channels, members, and rank-based permission system.

## Architecture

### Database Tables

| Table | Purpose |
|-------|---------|
| `guilds` | Guild metadata (name, description, image, theme colors, public/private) |
| `guild_ranks` | Custom ranks per guild with permission flags (JSON) |
| `guild_members` | Membership join table with rank assignment and notes |

Existing `rooms` and `voice_channels` tables gained a `guild_id` foreign key. A migration runs on first startup, creating a default "/guild" guild and migrating all existing data into it.

### Rank & Permission System

Each guild has custom ranks ordered by hierarchy (0 = Guild Master, highest). 24 permission flags are grouped into categories:

- **Membership**: invite, kick, promote/demote, manage applications
- **Communication**: guild chat speak/listen, officer chat, modify MotD
- **Events & Content**: create events, edit public/officer notes
- **Asset Dump**: view, upload, download, delete files, manage storage
- **Administration**: modify ranks, set permissions, manage rooms/theme, disband, transfer leadership

Guild Master (rank 0) always has all permissions. Members can only affect ranks strictly below their own.

### Default Ranks

| Order | Name | Key Permissions |
|-------|------|----------------|
| 0 | Guild Master | All (immutable) |
| 1 | Officer | invite, remove, promote/demote, officer chat, manage rooms/theme |
| 2 | Veteran | invite, guild chat, edit public note, upload/download files |
| 3 | Member | guild chat, edit public note, view/download files |
| 4 | Initiate | guild chat, view asset dump |

## Server Routes

All guild routes are in `server/src/routes/guilds.js`, prefixed with `/api/guilds`.

### Core
- `GET /` — List user's guilds
- `GET /public` — Browse public guilds
- `POST /` — Create guild (max 1 per user)
- `GET /:id` — Guild details + ranks
- `PUT /:id` — Update guild info
- `DELETE /:id` — Disband guild

### Membership
- `POST /:id/join` — Join public guild
- `POST /join/:inviteCode` — Join by invite code
- `POST /:id/leave` — Leave guild
- `GET /:id/members` — List members with ranks
- `PUT /:id/members/:userId/rank` — Promote/demote
- `PUT /:id/members/:userId/note` — Update notes
- `DELETE /:id/members/:userId` — Kick member

### Ranks
- `GET /:id/ranks` — List ranks
- `POST /:id/ranks` — Create rank
- `PUT /:id/ranks/:rankId` — Update rank
- `DELETE /:id/ranks/:rankId` — Delete rank

### Other
- `POST /:id/invite` / `POST /:id/regenerate-invite` — Invite management
- `GET /:id/motd` / `PUT /:id/motd` — Message of the Day
- `POST /:id/transfer` — Transfer leadership

## Client Components

### New Files

| File | Purpose |
|------|---------|
| `contexts/GuildContext.jsx` | Current guild state, theme application |
| `hooks/useGuilds.js` | Guild CRUD operations |
| `components/Guild/GuildSelectionScreen.jsx` | Post-login guild grid |
| `components/Guild/CreateGuildModal.jsx` | Form guild flow |
| `components/Guild/JoinGuildModal.jsx` | Browse + invite code |
| `components/Guild/GuildSettingsModal.jsx` | Full guild management (5 tabs) |
| `components/Guild/GuildSwitcher.jsx` | Left sidebar icon strip |
| `components/Profile/ProfileSettingsModal.jsx` | Nostr kind:0 profile editor |
| `nostr/profilePublisher.js` | Build, sign, publish kind:0 events |

### Modified Files

- `App.jsx` — Guild gate after login (LoginScreen → CodeRain → GuildSelectionScreen → MainLayout)
- `MainLayout.jsx` — GuildSwitcher column, guild-scoped room fetching
- `Sidebar.jsx` — Guild header with settings gear, profile avatar
- `useRooms.js` — Accepts `guildId`, scopes fetches and socket events
- `useVoiceChannels.js` — Accepts `guildId`, scopes fetches and socket events
- `VoiceContext.jsx` — Passes `currentGuild` to voice channel hook

## Guild Theming

Each guild stores `accent_color` and `bg_color`. When a user enters a guild, CSS custom properties are updated on `document.documentElement`:

```js
document.documentElement.style.setProperty('--accent', guild.accent_color);
document.documentElement.style.setProperty('--bg-primary', guild.bg_color);
```

All existing components use CSS variables, so theming works automatically.

## Nostr Profile (kind:0)

Users can set their Nostr identity (name, bio, picture) from within the app. The client:
1. Builds a kind:0 metadata event
2. Signs with the user's nsec/NIP-46 signer
3. Publishes to relays: `relay.damus.io`, `nos.lol`, `relay.nostr.band`
4. Images uploaded to `nostr.build` API

Profiles are visible in any Nostr client (Primal, Damus, etc.).

## App Flow

```
Login → CodeRain → GuildSelectionScreen
                        ├── Browse "My Guilds" grid
                        ├── "Form Guild" → CreateGuildModal
                        ├── "Join Guild" → JoinGuildModal
                        └── Click guild card → MainLayout (guild-scoped)
                                                    ├── GuildSwitcher (left icon strip)
                                                    ├── Sidebar (guild rooms/voice)
                                                    └── Content area
```
