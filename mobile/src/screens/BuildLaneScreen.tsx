import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '../components/Card';
import { SectionListRow } from '../components/SectionListRow';
import { getReleaseCommands } from '../config/mobileConfig';
import { mobileReadyNow } from '../features/port/mobileRoadmap';
import { palette } from '../theme/palette';

const commands = getReleaseCommands();

function CommandBlock({ title, command }: { title: string; command: string }) {
  return (
    <View style={styles.commandBlock}>
      <Text style={styles.commandTitle}>{title}</Text>
      <Text style={styles.commandValue}>{command}</Text>
    </View>
  );
}

export function BuildLaneScreen() {
  return (
    <View style={styles.wrapper}>
      <Card eyebrow="Release Plan" title="Build targets locked in" tone="success">
        {mobileReadyNow.map((item) => (
          <SectionListRow key={item} value={item} tone="success" />
        ))}
      </Card>

      <Card eyebrow="iOS" title="TestFlight release lane">
        <CommandBlock title="Build archive" command={commands.iosBuild} />
        <CommandBlock title="Submit to TestFlight" command={commands.iosSubmit} />
      </Card>

      <Card eyebrow="Android" title="Zapstore publication lane">
        <CommandBlock title="Build signed APK" command={commands.androidBuild} />
        <CommandBlock title="Publish with Zapstore CLI" command={commands.androidPublish} />
        <Text style={styles.note}>
          Zapstore uses APK-based publishing. Google Play AAB submission is not
          the primary Android release lane for this project.
        </Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 16,
  },
  commandBlock: {
    gap: 6,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#081008',
    borderWidth: 1,
    borderColor: palette.border,
  },
  commandTitle: {
    color: palette.muted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  commandValue: {
    color: palette.text,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
  },
  note: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 22,
  },
});
