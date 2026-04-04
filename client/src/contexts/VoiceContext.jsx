import React, { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { useVoice } from '../hooks/useVoice';
import { useVoiceChannels } from '../hooks/useVoiceChannels';
import { useVoiceStatus } from '../hooks/useVoiceStatus';
import { useAudioDevices } from '../hooks/useAudioDevices';
import { useAuth } from './AuthContext';
import { useGuild } from './GuildContext';
import { playJoinChime, playLeaveChime, playStreamStartChime, playStreamStopChime } from '../utils/chime';
import { setVoiceChannelParticipants } from '../crypto/voiceEncryption';
import { resolveVoiceContextValue } from './voiceContextFallback.mjs';

const VoiceContext = createContext(null);
const VoicePresenceContext = createContext(null);
const VoiceSettingsContext = createContext(null);

export function VoiceProvider({ children }) {
  const { user } = useAuth();
  const { currentGuild } = useGuild();
  const voice = useVoice();
  const channels = useVoiceChannels(currentGuild);
  const status = useVoiceStatus(!!currentGuild);
  const devices = useAudioDevices();

  const prevChannelIdRef = useRef(null);
  const prevCountRef = useRef(null);
  const prevSharersRef = useRef(null);
  const suppressPeerChimesUntilRef = useRef(0);

  useEffect(() => {
    if (!voice.channelId) {
      setVoiceChannelParticipants([]);
      prevChannelIdRef.current = null;
      prevCountRef.current = null;
      prevSharersRef.current = null;
      suppressPeerChimesUntilRef.current = 0;
      return;
    }

    const ch = channels.voiceChannels.find(c => c.id === voice.channelId);
    const participantIds = [
      ...(user?.userId ? [user.userId] : []),
      ...((ch?.participants || []).map(p => p.userId)),
    ];
    setVoiceChannelParticipants(Array.from(new Set(participantIds)));

    const count = ch?.participants?.length ?? 0;
    const sharers = new Set((ch?.participants || []).filter(p => p.screenSharing).map(p => p.userId));

    // Reset local peer-chime baselines when we switch channels so a one-click swap
    // only plays the self connect tone instead of sounding like leave+join.
    if (prevChannelIdRef.current !== voice.channelId) {
      prevChannelIdRef.current = voice.channelId;
      prevCountRef.current = count;
      prevSharersRef.current = sharers;
      suppressPeerChimesUntilRef.current = Date.now() + 1200;
      return;
    }

    if (prevCountRef.current === null) {
      prevCountRef.current = count;
      prevSharersRef.current = sharers;
      return;
    }

    const peerChimesSuppressed = Date.now() < suppressPeerChimesUntilRef.current;

    if (!peerChimesSuppressed) {
      if (count > prevCountRef.current) {
        playJoinChime();
      } else if (count < prevCountRef.current) {
        playLeaveChime();
      }
    }

    if (!peerChimesSuppressed && prevSharersRef.current) {
      for (const uid of sharers) {
        if (!prevSharersRef.current.has(uid) && uid !== user?.userId) {
          playStreamStartChime();
          break;
        }
      }
      for (const uid of prevSharersRef.current) {
        if (!sharers.has(uid) && uid !== user?.userId) {
          playStreamStopChime();
          break;
        }
      }
    }

    prevCountRef.current = count;
    prevSharersRef.current = sharers;
  }, [voice.channelId, channels.voiceChannels, user?.userId]);

  useEffect(() => {
    voice.setOutputDevice(devices.selectedOutput);
  }, [devices.selectedOutput, voice.setOutputDevice]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const bridge = {
      leaveForUpdate: async () => {
        if (voice.screenSharing) {
          voice.stopScreenShare();
        }
        if (voice.channelId) {
          await voice.leaveChannel();
        }
      },
    };

    window.__guildVoiceBridge = bridge;

    return () => {
      if (window.__guildVoiceBridge === bridge) {
        delete window.__guildVoiceBridge;
      }
    };
  }, [voice.channelId, voice.leaveChannel, voice.screenSharing, voice.stopScreenShare]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const debugState = {
      userId: user?.userId || null,
      userName: user?.name || null,
      channelId: voice.channelId,
      muted: voice.muted,
      deafened: voice.deafened,
      speaking: voice.speaking,
      joinError: voice.joinError,
      voiceProcessingMode: voice.voiceProcessingMode,
      liveVoiceFallbackReason: voice.liveVoiceFallbackReason,
      voiceDiagnostics: voice.voiceDiagnostics,
      voiceE2E: voice.voiceE2E,
      e2eWarning: voice.e2eWarning,
      read() {
        return {
          userId: user?.userId || null,
          userName: user?.name || null,
          channelId: voice.channelId,
          muted: voice.muted,
          deafened: voice.deafened,
          speaking: voice.speaking,
          joinError: voice.joinError,
          voiceProcessingMode: voice.voiceProcessingMode,
          liveVoiceFallbackReason: voice.liveVoiceFallbackReason,
          voiceDiagnostics: voice.voiceDiagnostics,
          voiceE2E: voice.voiceE2E,
          e2eWarning: voice.e2eWarning,
        };
      },
    };

    window.__guildVoiceDebug = debugState;

    return () => {
      if (window.__guildVoiceDebug === debugState) {
        delete window.__guildVoiceDebug;
      }
    };
  }, [
    user?.userId,
    user?.name,
    voice.channelId,
    voice.deafened,
    voice.e2eWarning,
    voice.joinError,
    voice.liveVoiceFallbackReason,
    voice.muted,
    voice.speaking,
    voice.voiceDiagnostics,
    voice.voiceE2E,
    voice.voiceProcessingMode,
  ]);

  const voiceValue = useMemo(() => ({
    channelId: voice.channelId,
    muted: voice.muted,
    deafened: voice.deafened,
    joinError: voice.joinError,
    joinChannel: voice.joinChannel,
    leaveChannel: voice.leaveChannel,
    toggleMute: voice.toggleMute,
    toggleDeafen: voice.toggleDeafen,
    setUserVolume: voice.setUserVolume,
    voiceDiagnostics: voice.voiceDiagnostics,
    screenSharing: voice.screenSharing,
    screenShareStream: voice.screenShareStream,
    screenShareDiagnostics: voice.screenShareDiagnostics,
    startScreenShare: voice.startScreenShare,
    stopScreenShare: voice.stopScreenShare,
    incomingScreenShares: voice.incomingScreenShares,
    showSourcePicker: voice.showSourcePicker,
    confirmScreenShare: voice.confirmScreenShare,
    cancelSourcePicker: voice.cancelSourcePicker,
    screenShareError: voice.screenShareError,
    clearScreenShareError: voice.clearScreenShareError,
    voiceE2E: voice.voiceE2E,
    e2eWarning: voice.e2eWarning,
    voiceStatus: status.voiceStatus,
    refreshVoiceStatus: status.refreshVoiceStatus,
    voiceChannels: channels.voiceChannels,
    createVoiceChannel: channels.createVoiceChannel,
    renameVoiceChannel: channels.renameVoiceChannel,
    deleteVoiceChannel: channels.deleteVoiceChannel,
  }), [
    voice.channelId,
    voice.muted,
    voice.deafened,
    voice.joinError,
    voice.joinChannel,
    voice.leaveChannel,
    voice.toggleMute,
    voice.toggleDeafen,
    voice.setUserVolume,
    voice.voiceDiagnostics,
    voice.screenSharing,
    voice.screenShareStream,
    voice.screenShareDiagnostics,
    voice.startScreenShare,
    voice.stopScreenShare,
    voice.incomingScreenShares,
    voice.showSourcePicker,
    voice.confirmScreenShare,
    voice.cancelSourcePicker,
    voice.screenShareError,
    voice.clearScreenShareError,
    voice.voiceE2E,
    voice.e2eWarning,
    status.voiceStatus,
    status.refreshVoiceStatus,
    channels.voiceChannels,
    channels.createVoiceChannel,
    channels.renameVoiceChannel,
    channels.deleteVoiceChannel,
  ]);

  const voicePresenceValue = useMemo(() => ({
    peers: voice.peers,
    speaking: voice.speaking,
  }), [voice.peers, voice.speaking]);

  const settingsValue = useMemo(() => ({
    inputDevices: devices.inputDevices,
    outputDevices: devices.outputDevices,
    selectedInput: devices.selectedInput,
    selectedOutput: devices.selectedOutput,
    selectInput: devices.selectInput,
    selectOutput: devices.selectOutput,
    refreshDevices: devices.refreshDevices,
    setOutputDevice: voice.setOutputDevice,
    setUserVolume: voice.setUserVolume,
    setMicGain: voice.setMicGain,
    voiceProcessingMode: voice.voiceProcessingMode,
    setVoiceProcessingMode: voice.setVoiceProcessingMode,
    liveVoiceFallbackReason: voice.liveVoiceFallbackReason,
  }), [
    devices.inputDevices,
    devices.outputDevices,
    devices.selectedInput,
    devices.selectedOutput,
    devices.selectInput,
    devices.selectOutput,
    devices.refreshDevices,
    voice.setOutputDevice,
    voice.setUserVolume,
    voice.setMicGain,
    voice.voiceProcessingMode,
    voice.setVoiceProcessingMode,
    voice.liveVoiceFallbackReason,
  ]);

  return (
    <VoiceContext.Provider value={voiceValue}>
      <VoicePresenceContext.Provider value={voicePresenceValue}>
        <VoiceSettingsContext.Provider value={settingsValue}>
          {children}
        </VoiceSettingsContext.Provider>
      </VoicePresenceContext.Provider>
    </VoiceContext.Provider>
  );
}

export function useVoiceContext() {
  const ctx = useContext(VoiceContext);
  return resolveVoiceContextValue(ctx, { kind: 'voice' });
}

export function useVoicePresenceContext() {
  const ctx = useContext(VoicePresenceContext);
  return resolveVoiceContextValue(ctx, { kind: 'presence' });
}

export function useVoiceSettingsContext() {
  const ctx = useContext(VoiceSettingsContext);
  return resolveVoiceContextValue(ctx, { kind: 'settings' });
}
