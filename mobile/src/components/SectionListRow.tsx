import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { palette } from '../theme/palette';

export function SectionListRow({
  value,
  tone = 'neutral',
}: {
  value: string;
  tone?: 'neutral' | 'warning' | 'success';
}) {
  return (
    <View style={styles.row}>
      <View
        style={[
          styles.dot,
          tone === 'warning' ? styles.dotWarning : null,
          tone === 'success' ? styles.dotSuccess : null,
        ]}
      />
      <Text style={styles.text}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  dot: {
    marginTop: 7,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.accent,
  },
  dotWarning: {
    backgroundColor: palette.warning,
  },
  dotSuccess: {
    backgroundColor: palette.accent,
  },
  text: {
    flex: 1,
    color: palette.text,
    fontSize: 15,
    lineHeight: 22,
  },
});
