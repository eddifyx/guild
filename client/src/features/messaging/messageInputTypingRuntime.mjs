import { getMessageInputTypingPayload } from './messageInputModel.mjs';

export function emitMessageInputTyping({
  socket,
  conversation,
  start,
}) {
  const payload = getMessageInputTypingPayload(conversation);
  if (!socket || !payload) return;
  socket.emit(start ? 'typing:start' : 'typing:stop', payload);
}
