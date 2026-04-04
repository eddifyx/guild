import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Card } from '../components/Card';
import { PrimaryButton } from '../components/PrimaryButton';
import { SectionListRow } from '../components/SectionListRow';
import { SurfaceButton } from '../components/SurfaceButton';
import type { MobileSessionState } from '../features/session/mobileSessionTypes';
import type {
  MobileDmConversation,
  MobileGuildSummary,
  MobileMessage,
  MobileRoom,
} from '../features/workspace/mobileWorkspaceTypes';
import { useMobileWorkspace } from '../features/workspace/useMobileWorkspace';
import { palette } from '../theme/palette';

function formatMessagePreview(message: MobileMessage) {
  if (message.encrypted) {
    return 'Encrypted message. Mobile decryption lands in the secure-runtime milestone.';
  }
  if (message.content) {
    return message.content;
  }
  if (message.attachments?.length) {
    return `${message.attachments.length} attachment(s)`;
  }
  return 'Empty message';
}

function ConversationButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return <SurfaceButton label={label} selected={selected} onPress={onPress} />;
}

function LoginScreen({ sessionState }: { sessionState: MobileSessionState }) {
  const [nsecValue, setNsecValue] = useState('');

  return (
    <View style={styles.wrapper}>
      <Card eyebrow="Sign In" title="Mobile MVP login">
        <Text style={styles.copy}>
          This first mobile slice supports `nsec` login against the existing
          `/api/auth/nostr/challenge` and `/api/auth/nostr` flow.
        </Text>

        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>Server URL</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="https://your-guild-server.example"
            placeholderTextColor={palette.placeholder}
            selectionColor={palette.accent}
            style={styles.input}
            value={sessionState.serverUrlDraft}
            onChangeText={sessionState.setServerUrlDraft}
          />
        </View>

        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>Nsec</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="nsec1..."
            placeholderTextColor={palette.placeholder}
            selectionColor={palette.accent}
            secureTextEntry
            style={[styles.input, styles.secretInput]}
            value={nsecValue}
            onChangeText={setNsecValue}
          />
        </View>

        {sessionState.loginError ? <Text style={styles.error}>{sessionState.loginError}</Text> : null}

        <PrimaryButton
          label="Sign in with nsec"
          disabled={!nsecValue.trim() || !sessionState.serverUrlDraft.trim()}
          loading={sessionState.loggingIn}
          onPress={() => {
            void sessionState.loginWithNsec(nsecValue, sessionState.serverUrlDraft);
          }}
        />
      </Card>
    </View>
  );
}

function buildConversationTitle(dm: MobileDmConversation) {
  return dm.other_username || dm.other_npub || dm.other_user_id;
}

export function AppWorkspaceScreen({
  sessionState,
}: {
  sessionState: MobileSessionState;
}) {
  const workspace = useMobileWorkspace({
    session: sessionState.session,
    socket: sessionState.socket,
  });
  const [inviteCode, setInviteCode] = useState('');

  const selectedGuild = useMemo(
    () => workspace.guilds.find((guild) => guild.id === workspace.selectedGuildId) || null,
    [workspace.guilds, workspace.selectedGuildId]
  );

  if (sessionState.booting) {
    return (
      <View style={styles.wrapper}>
        <Card eyebrow="Booting" title="Loading stored mobile session">
          <Text style={styles.copy}>Checking secure storage and reconnecting the session.</Text>
        </Card>
      </View>
    );
  }

  if (!sessionState.session) {
    return <LoginScreen sessionState={sessionState} />;
  }

  return (
    <View style={styles.wrapper}>
      <Card eyebrow="Session" title="Authenticated mobile workspace" tone="success">
        <SectionListRow value={`User: ${sessionState.session.username || sessionState.session.userId}`} tone="success" />
        <SectionListRow value={`Server: ${sessionState.session.serverUrl}`} tone="success" />
        <SectionListRow
          value={`Socket: ${sessionState.connected ? 'connected' : 'disconnected'}`}
          tone={sessionState.connected ? 'success' : 'warning'}
        />
        <PrimaryButton label="Log out" onPress={() => { void sessionState.logout(); }} />
      </Card>

      {workspace.error ? (
        <Card eyebrow="Status" title="Current issue" tone="warning">
          <Text style={styles.error}>{workspace.error}</Text>
        </Card>
      ) : null}

      {workspace.guilds.length === 0 ? (
        <Card eyebrow="Guilds" title="Join a guild to continue">
          <Text style={styles.copy}>
            This account does not belong to a guild yet. Join one through the
            public list or with an invite code.
          </Text>

          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>Invite code</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="paste invite code"
              placeholderTextColor={palette.placeholder}
              selectionColor={palette.accent}
              style={styles.input}
              value={inviteCode}
              onChangeText={setInviteCode}
            />
          </View>

          <PrimaryButton
            label="Join by invite code"
            disabled={!inviteCode.trim() || workspace.loading}
            loading={workspace.loading}
            onPress={() => {
              void (async () => {
                const joined = await workspace.joinViaInviteCode(inviteCode);
                if (joined) {
                  setInviteCode('');
                }
              })();
            }}
          />

          {workspace.publicGuilds.map((guild: MobileGuildSummary) => (
            <View key={guild.id} style={styles.listBlock}>
              <Text style={styles.listTitle}>{guild.name}</Text>
              <Text style={styles.listMeta}>
                {guild.description || 'Public guild'}
              </Text>
              <PrimaryButton
                label={`Join ${guild.name}`}
                loading={workspace.loading}
                onPress={() => {
                  void workspace.joinPublicGuild(guild.id);
                }}
              />
            </View>
          ))}
        </Card>
      ) : null}

      {workspace.guilds.length > 0 ? (
        <>
          <Card eyebrow="Guilds" title="Your guilds">
            {workspace.guilds.map((guild) => (
              <ConversationButton
                key={guild.id}
                label={`${guild.name}${guild.member_count ? ` (${guild.member_count})` : ''}`}
                selected={guild.id === workspace.selectedGuildId}
                onPress={() => workspace.setSelectedGuildId(guild.id)}
              />
            ))}
          </Card>

          <Card eyebrow="Guild Detail" title={selectedGuild?.name || 'Selected guild'}>
            <SectionListRow value={`Description: ${workspace.guildDetail?.description || 'No description yet'}`} />
            <SectionListRow value={`Members: ${workspace.guildDetail?.members?.length || 0}`} />
            <SectionListRow value={`Rooms: ${workspace.rooms.length}`} />
            <SectionListRow value={`DM conversations: ${workspace.dmConversations.length}`} />
          </Card>

          <Card eyebrow="Rooms" title="Guild rooms">
            {workspace.rooms.length === 0 ? (
              <Text style={styles.copy}>No rooms in this guild yet.</Text>
            ) : (
              workspace.rooms.map((room: MobileRoom) => (
                <ConversationButton
                  key={room.id}
                  label={room.name}
                  selected={workspace.selectedConversation?.type === 'room' && workspace.selectedConversation.id === room.id}
                  onPress={() => workspace.setSelectedConversation({
                    id: room.id,
                    type: 'room',
                    title: room.name,
                  })}
                />
              ))
            )}
          </Card>

          <Card eyebrow="Direct Messages" title="Visible conversations">
            {workspace.dmConversations.length === 0 ? (
              <Text style={styles.copy}>No DM conversations yet.</Text>
            ) : (
              workspace.dmConversations.map((dm: MobileDmConversation) => (
                <ConversationButton
                  key={dm.other_user_id}
                  label={buildConversationTitle(dm)}
                  selected={workspace.selectedConversation?.type === 'dm' && workspace.selectedConversation.id === dm.other_user_id}
                  onPress={() => workspace.setSelectedConversation({
                    id: dm.other_user_id,
                    type: 'dm',
                    title: buildConversationTitle(dm),
                  })}
                />
              ))
            )}
          </Card>

          <Card eyebrow="Messages" title={workspace.selectedConversation?.title || 'Choose a room or DM'}>
            {workspace.selectedConversation ? (
              <>
                <SectionListRow
                  value={
                    workspace.selectedConversation.type === 'room'
                      ? 'Realtime room subscription active while selected.'
                      : 'DM history loaded from the server. Realtime DMs append when they arrive.'
                  }
                  tone="success"
                />
                <SectionListRow
                  value="Sending and decrypting secure messages still depend on the mobile crypto bridge."
                  tone="warning"
                />
              </>
            ) : (
              <Text style={styles.copy}>Select a room or DM to load its history.</Text>
            )}

            {workspace.messagesLoading ? <Text style={styles.copy}>Loading messages...</Text> : null}

            {workspace.messages.map((message) => (
              <View key={message.id} style={styles.messageCard}>
                <Text style={styles.messageAuthor}>
                  {message.sender_name || message.sender_id || 'Unknown sender'}
                </Text>
                <Text style={styles.messageBody}>{formatMessagePreview(message)}</Text>
                <Text style={styles.messageMeta}>
                  {message.created_at || 'Unknown time'}
                </Text>
              </View>
            ))}
          </Card>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 16,
  },
  copy: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  inputWrapper: {
    gap: 8,
  },
  inputLabel: {
    color: palette.muted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#081008',
    color: palette.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  secretInput: {
    fontFamily: 'monospace',
  },
  error: {
    color: palette.warning,
    fontSize: 14,
    lineHeight: 22,
  },
  listBlock: {
    gap: 10,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#081008',
    borderWidth: 1,
    borderColor: palette.border,
  },
  listTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '700',
  },
  listMeta: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  messageCard: {
    gap: 6,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#081008',
    borderWidth: 1,
    borderColor: palette.border,
  },
  messageAuthor: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '700',
  },
  messageBody: {
    color: palette.text,
    fontSize: 14,
    lineHeight: 21,
  },
  messageMeta: {
    color: palette.muted,
    fontSize: 12,
  },
});
