import { StatusBar } from 'expo-status-bar';
import React, { useMemo, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { AppHeader } from './components/AppHeader';
import { AppWorkspaceScreen } from './screens/AppWorkspaceScreen';
import { BuildLaneScreen } from './screens/BuildLaneScreen';
import { PortPlanScreen } from './screens/PortPlanScreen';
import { ServerDiagnosticsScreen } from './screens/ServerDiagnosticsScreen';
import { useMobileSession } from './features/session/useMobileSession';
import { palette } from './theme/palette';

type TabId = 'app' | 'release' | 'server' | 'port';

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'app', label: 'App' },
  { id: 'release', label: 'Release' },
  { id: 'server', label: 'Server' },
  { id: 'port', label: 'Port Plan' },
];

export function MobileApp() {
  const [activeTab, setActiveTab] = useState<TabId>('app');
  const sessionState = useMobileSession();

  const activeScreen = useMemo(() => {
    switch (activeTab) {
      case 'app':
        return <AppWorkspaceScreen sessionState={sessionState} />;
      case 'server':
        return <ServerDiagnosticsScreen initialServerUrl={sessionState.session?.serverUrl || sessionState.serverUrlDraft} />;
      case 'port':
        return <PortPlanScreen />;
      case 'release':
      default:
        return <BuildLaneScreen />;
    }
  }, [activeTab, sessionState]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.orbTop} />
        <View style={styles.orbBottom} />

        <AppHeader />

        <View style={styles.tabBar}>
          {tabs.map((tab) => {
            const selected = tab.id === activeTab;
            return (
              <TouchableOpacity
                key={tab.id}
                activeOpacity={0.86}
                onPress={() => setActiveTab(tab.id)}
                style={[styles.tabButton, selected ? styles.tabButtonActive : null]}
              >
                <Text style={[styles.tabLabel, selected ? styles.tabLabelActive : null]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {activeScreen}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
  },
  scrollContent: {
    minHeight: '100%',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    gap: 18,
    backgroundColor: palette.background,
  },
  orbTop: {
    position: 'absolute',
    top: -70,
    right: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(64, 255, 64, 0.08)',
  },
  orbBottom: {
    position: 'absolute',
    bottom: 40,
    left: -60,
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(64, 255, 64, 0.05)',
  },
  tabBar: {
    flexDirection: 'row',
    gap: 10,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  tabButtonActive: {
    backgroundColor: palette.accentMuted,
    borderColor: 'rgba(64, 255, 64, 0.3)',
  },
  tabLabel: {
    color: palette.muted,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
  },
  tabLabelActive: {
    color: palette.text,
  },
});
