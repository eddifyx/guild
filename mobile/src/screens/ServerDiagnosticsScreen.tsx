import React from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Card } from '../components/Card';
import { PrimaryButton } from '../components/PrimaryButton';
import { SectionListRow } from '../components/SectionListRow';
import { useServerDiagnostics } from '../features/server/useServerDiagnostics';
import { palette } from '../theme/palette';

function DiagnosticValue({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.diagnosticBlock}>
      <Text style={styles.diagnosticLabel}>{label}</Text>
      <Text style={styles.diagnosticValue}>{value}</Text>
    </View>
  );
}

export function ServerDiagnosticsScreen({
  initialServerUrl = '',
}: {
  initialServerUrl?: string;
}) {
  const {
    serverUrl,
    setServerUrl,
    iosVersion,
    androidVersion,
    challenge,
    loadingKey,
    error,
    readiness,
    checkIos,
    checkAndroid,
    checkChallenge,
  } = useServerDiagnostics(initialServerUrl);

  return (
    <View style={styles.wrapper}>
      <Card eyebrow="Connectivity" title="Check the mobile backend path">
        <Text style={styles.copy}>
          Point the app at the server you plan to use for TestFlight and
          Zapstore builds, then verify the version and auth challenge endpoints.
        </Text>

        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>API base URL</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="https://your-guild-server.example"
            placeholderTextColor={palette.placeholder}
            selectionColor={palette.accent}
            style={styles.input}
            value={serverUrl}
            onChangeText={setServerUrl}
          />
        </View>

        <View style={styles.buttonGrid}>
          <PrimaryButton
            label="Check iOS version"
            onPress={() => { void checkIos(); }}
            loading={loadingKey === 'ios'}
          />
          <PrimaryButton
            label="Check Android version"
            onPress={() => { void checkAndroid(); }}
            loading={loadingKey === 'android'}
          />
          <PrimaryButton
            label="Check auth challenge"
            onPress={() => { void checkChallenge(); }}
            loading={loadingKey === 'challenge'}
          />
        </View>
      </Card>

      <Card eyebrow="Readiness" title="Server checks">
        {readiness.map((item) => (
          <SectionListRow
            key={item.label}
            value={`${item.label}: ${item.detail}`}
            tone={item.ok ? 'success' : 'warning'}
          />
        ))}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </Card>

      <Card eyebrow="Response" title="Version endpoint payloads">
        <DiagnosticValue
          label="iOS"
          value={iosVersion ? JSON.stringify(iosVersion, null, 2) : 'No iOS payload yet'}
        />
        <DiagnosticValue
          label="Android"
          value={androidVersion ? JSON.stringify(androidVersion, null, 2) : 'No Android payload yet'}
        />
      </Card>

      <Card eyebrow="Auth" title="Nostr challenge diagnostics">
        <DiagnosticValue
          label="Challenge"
          value={challenge?.challenge || 'No challenge fetched yet'}
        />
        <DiagnosticValue
          label="Auth pubkey"
          value={challenge?.authPubkey || 'No auth pubkey returned yet'}
        />
      </Card>
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
  buttonGrid: {
    gap: 10,
  },
  error: {
    color: palette.warning,
    fontSize: 14,
    lineHeight: 22,
  },
  diagnosticBlock: {
    gap: 6,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#081008',
    borderWidth: 1,
    borderColor: palette.border,
  },
  diagnosticLabel: {
    color: palette.muted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  diagnosticValue: {
    color: palette.text,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
  },
});
