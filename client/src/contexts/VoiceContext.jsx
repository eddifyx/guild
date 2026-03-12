import { createContext, useContext, useEffect, useRef } from 'react';
import { useVoice } from '../hooks/useVoice';
import { useVoiceChannels } from '../hooks/useVoiceChannels';
import { useAudioDevices } from '../hooks/useAudioDevices';
import { useAuth } from './AuthContext';
import { useGuild } from './GuildContext';
import { playJoinChime, playLeaveChime, playStreamStartChime, playStreamStopChime } from '../utils/chime';
import { setVoiceChannelParticipants } from '../crypto/voiceEncryption';

const VoiceContext = createContext(null);

export function VoiceProvider({ children }) {
  const { user } = useAuth();
  const { currentGuild } = useGuild();
  const voice = useVoice();
  const channels = useVoiceChannels(currentGuild);
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

  return (
    <VoiceContext.Provider value={{ ...voice, ...channels, ...devices }}>
      {children}
    </VoiceContext.Provider>
  );
}

export function useVoiceContext() {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error('useVoiceContext must be inside VoiceProvider');
  return ctx;
}
