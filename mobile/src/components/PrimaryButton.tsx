import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';

import { palette } from '../theme/palette';

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.86}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        disabled || loading ? styles.buttonDisabled : null,
      ]}
    >
      {loading ? <ActivityIndicator color={palette.background} /> : <Text style={styles.label}>{label}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: palette.accent,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  label: {
    color: palette.background,
    fontSize: 15,
    fontWeight: '800',
  },
});
