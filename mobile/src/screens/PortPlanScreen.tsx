import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '../components/Card';
import { SectionListRow } from '../components/SectionListRow';
import {
  mobileBlockers,
  mobileMvpPriority,
  mobileMvpTracks,
} from '../features/port/mobileRoadmap';
import { palette } from '../theme/palette';

export function PortPlanScreen() {
  return (
    <View style={styles.wrapper}>
      <Card eyebrow="Blockers" title="Desktop-native pieces still need a mobile port" tone="warning">
        {mobileBlockers.map((item) => (
          <SectionListRow key={item} value={item} tone="warning" />
        ))}
      </Card>

      <Card eyebrow="Execution Order" title="Mobile MVP priority stack">
        {mobileMvpPriority.map((item) => (
          <SectionListRow key={item} value={item} />
        ))}
      </Card>

      {mobileMvpTracks.map((track) => (
        <Card key={track.title} eyebrow="MVP Track" title={track.title}>
          {track.items.map((item) => (
            <SectionListRow key={item} value={item} />
          ))}
        </Card>
      ))}

      <View style={styles.footerCard}>
        <Text style={styles.footerTitle}>Current milestone and next move</Text>
        <Text style={styles.footerBody}>
          The app can already sign in with nsec, persist the session, browse
          guilds, rooms, DMs, and load message history. The next major milestone
          is secure interoperable messaging: mobile crypto, key-service sync,
          encrypted send and decrypt, then push and attachments.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 16,
  },
  footerCard: {
    padding: 18,
    borderRadius: 20,
    backgroundColor: '#081008',
    borderWidth: 1,
    borderColor: palette.border,
  },
  footerTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  footerBody: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 22,
  },
});
