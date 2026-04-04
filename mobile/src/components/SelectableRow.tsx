import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { palette } from '../theme/palette';

export function SelectableRow({
  title,
  subtitle = null,
  selected = false,
  onPress,
}: {
  title: string;
  subtitle?: string | null;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.86}
      onPress={onPress}
      style={[styles.row, selected ? styles.rowSelected : null]}
    >
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#081008',
  },
  rowSelected: {
    backgroundColor: palette.accentMuted,
    borderColor: 'rgba(64, 255, 64, 0.3)',
  },
  copy: {
    gap: 4,
  },
  title: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '700',
  },
  subtitle: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 19,
  },
});
