import Constants from 'expo-constants';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Pill } from './Pill';
import { palette } from '../theme/palette';

const version = Constants.expoConfig?.version || '1.0.72';
const bundleId =
  Constants.expoConfig?.ios?.bundleIdentifier ||
  Constants.expoConfig?.android?.package ||
  'unset';

export function AppHeader() {
  return (
    <View style={styles.wrapper}>
      <Pill label="iOS TestFlight + Zapstore" />
      <Text style={styles.title}>/guild mobile build lane</Text>
      <Text style={styles.subtitle}>
        This app now tracks the real mobile release path: TestFlight for iOS,
        APK publishing for Zapstore on Android, and a phased port plan for the
        secure runtime.
      </Text>

      <View style={styles.metaGrid}>
        <View style={styles.metaCard}>
          <Text style={styles.metaLabel}>Version</Text>
          <Text style={styles.metaValue}>{version}</Text>
        </View>
        <View style={styles.metaCard}>
          <Text style={styles.metaLabel}>Bundle / Package</Text>
          <Text style={styles.metaValue}>{bundleId}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 14,
  },
  title: {
    color: palette.text,
    fontSize: 34,
    fontWeight: '800',
    lineHeight: 38,
  },
  subtitle: {
    color: palette.muted,
    fontSize: 16,
    lineHeight: 24,
  },
  metaGrid: {
    gap: 12,
  },
  metaCard: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  metaLabel: {
    color: palette.muted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  metaValue: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '600',
  },
});
