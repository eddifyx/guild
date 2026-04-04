import React, { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { palette } from '../theme/palette';

export function Card({
  eyebrow,
  title,
  children,
  tone = 'neutral',
}: {
  eyebrow?: string;
  title: string;
  children: ReactNode;
  tone?: 'neutral' | 'warning' | 'success';
}) {
  return (
    <View
      style={[
        styles.card,
        tone === 'warning' ? styles.warning : null,
        tone === 'success' ? styles.success : null,
      ]}
    >
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 14,
    padding: 20,
    borderRadius: 24,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  warning: {
    backgroundColor: palette.surfaceRaised,
  },
  success: {
    borderColor: 'rgba(64, 255, 64, 0.28)',
  },
  eyebrow: {
    color: palette.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: {
    color: palette.text,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
  },
  content: {
    gap: 12,
  },
});
