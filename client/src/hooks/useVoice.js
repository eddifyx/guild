import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import {
  useVoiceControllerRefs,
  useVoiceControllerState,
} from '../features/voice/useVoiceControllerState.mjs';
import { useVoiceHookRuntime } from '../features/voice/useVoiceHookRuntime.mjs';

export function useVoice() {
  const { socket } = useSocket();
  const { user } = useAuth();
  const voiceState = useVoiceControllerState();
  const voiceRefs = useVoiceControllerRefs({
    voiceProcessingMode: voiceState.voiceProcessingMode,
  });

  return useVoiceHookRuntime({
    socket,
    userId: user?.userId,
    voiceState,
    voiceRefs,
  });
}
