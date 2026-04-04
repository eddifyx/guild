import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import { palette } from '../theme/palette';

export function SurfaceButton({
  label,
  onPress,
  selected = false,
}: {
  label: string;
  onPress: () => void;
  selected?: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.86}
      onPress={onPress}
      style={[styles.button, selected ? styles.buttonSelected : null]}
    >
      <Text style={[styles.label, selected ? styles.labelSelected : null]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#081008',
  },
  buttonSelected: {
    backgroundColor: palette.accentMuted,
    borderColor: 'rgba(64, 255, 64, 0.28)',
  },
  label: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '600',
  },
  labelSelected: {
    color: palette.accent,
  },
});
