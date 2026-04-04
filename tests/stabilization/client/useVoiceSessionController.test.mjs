import test from 'node:test';
import assert from 'node:assert/strict';

import { buildVoiceSessionActionContract } from '../../../client/src/features/voice/voiceControllerRuntimeContracts.mjs';

test('voice session controller contract preserves the canonical session wiring shape', () => {
  const refs = {
    channelIdRef: { current: 'channel-1' },
    joinGenRef: { current: 2 },
  };
  const setters = {
    setJoinErrorFn: () => {},
    setMutedFn: () => {},
  };
  const runtime = {
    emitAsyncFn: async () => ({}),
    setTimeoutFn: () => {},
    clearTimeoutFn: () => {},
  };

  const contract = buildVoiceSessionActionContract({
    socket: { id: 'socket-1' },
    refs,
    setters,
    runtime,
    constants: { voiceSessionErrorTimeoutMs: 8000 },
  });

  assert.equal(contract.socket.id, 'socket-1');
  assert.equal(contract.refs.channelIdRef, refs.channelIdRef);
  assert.equal(contract.setters.setMutedFn, setters.setMutedFn);
  assert.equal(contract.runtime.emitAsyncFn, runtime.emitAsyncFn);
  assert.equal(contract.constants.voiceSessionErrorTimeoutMs, 8000);
});
