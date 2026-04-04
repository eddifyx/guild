# /guildchat Mentions Spec

## Goal

Implement `/guildchat` mentions in a Slack-like way:

- easy to type
- easy to resolve when names collide
- visible in the message body
- noisy enough to get attention when you are mentioned
- restrained enough that it does not become spam

## Slack-Style Baseline

Based on Slack's documented behavior:

1. Typing `@` while composing opens a member picker.
2. As you continue typing, the list narrows to matching members.
3. You can select a member from the list and insert the mention into the message.
4. Mentioned users receive a notification if they are actually part of that conversation.
5. If you edit a message later and add a mention, Slack does not notify the mentioned user.
6. If multiple members match the same display name, Slack requires explicit disambiguation.
7. Mentions are highlighted and also appear in the user’s notification/activity flow.

Primary sources:

- Slack Help: Use mentions in Slack
- Slack Help: Configure your Slack notifications
- Slack Help: Activity view / notification triage
- Slack Help: Manage who can notify a channel or workspace

## Locked Product Decisions

These are now fixed unless explicitly changed later:

- Mentions exist only in `/guildchat` for v1.
- Audible notifications should play only for:
  - DMs
  - `/guildchat` mentions
- Boards should no longer produce notification pings.
- The red mention indicator should clear when `/guildchat` is opened, whether the user got there from Tavern or from a voice-channel view that also exposes `/guildchat`.
- Mention pings should fire every single time the user is mentioned.
- Editing a message to add a mention should not trigger a fresh ping.

## Proposed /guildchat v1 Mention Behavior

### Composer behavior

When the user types `@` in `/guildchat`:

1. Open a floating member list anchored to the caret/composer.
2. Show guild members sorted by:
   - exact prefix match first
   - online members before offline members
   - alphabetical within each bucket
3. Continue filtering as the user types.
4. Support keyboard controls:
   - `ArrowUp` / `ArrowDown` to navigate
   - `Enter` / `Tab` to commit the highlighted member
   - `Esc` to dismiss
5. Clicking an option inserts a structured mention token, not plain text only.

### Message rendering

Mentions should render as a styled inline pill or highlighted username, not as raw IDs.

Each mention should retain:

- mentioned user id
- display label at send time
- plain-text fallback

That keeps old messages stable even if someone renames themselves later.

### Notification behavior

When a `/guildchat` message mentions a user:

1. Play an audible notification for the mentioned user.
2. Add a red unread indicator next to the Tavern button.
3. Clear that unread state as soon as `/guildchat` is opened, regardless of whether it was opened from Tavern or from voice-channel view.
4. Highlight the mention in the message body.

### MOTD behavior

When the MOTD is updated:

- inject a system-style `/guildchat` event message immediately
- do not treat that as a mention notification

### Edits

Messages should be editable by their author.

Slack-style notification rule:

- editing a message to add a mention should not create a new ping

## Proposed v1 Scope

### Include in v1

- direct user mentions only
- typeahead member picker
- keyboard navigation
- mention highlight in message body
- audible ping for mentioned user
- red Tavern unread indicator for mention
- author-only message editing
- no board notification pings

### Exclude from v1

- `@channel`
- `@here`
- `@everyone`
- user groups
- cross-guild mentions
- mentioning users who are not guild members

## Data Model Direction

Each `/guildchat` message should support a `mentions` array, for example:

```json
[
  {
    "userId": "user_123",
    "label": "nobu",
    "start": 12,
    "end": 17
  }
]
```

The renderer should prefer structured mention metadata over reparsing message text.

## Notification Rules

Fire a mention notification only when all are true:

1. the message is newly sent, not edited
2. the target user is a member of that guild
3. the target user is not the sender
4. the message was not already seen by that user

## Duplicate Name Rule

If multiple users have the same visible name:

- the picker must show extra disambiguation
- examples: avatar, role, short handle, or pubkey suffix

We should not guess silently.

## Remaining Open Product Questions

These need product decisions before implementation:

1. If multiple guild members share the same visible name, what is the preferred disambiguation format in the picker:
   - avatar + role
   - avatar + short pubkey suffix
   - avatar + both
2. Should edited `/guildchat` messages show an explicit `edited` marker?
3. Should the Tavern indicator be:
   - a binary red dot
   - or a numeric count of unseen mentions?

## Recommended First Cut

For the safest first implementation:

1. direct user mentions only in `/guildchat`
2. author-only editing
3. no re-notify on edit
4. red Tavern badge shows binary state first
5. audible ping fires every time
6. mentions clear when `/guildchat` is opened
