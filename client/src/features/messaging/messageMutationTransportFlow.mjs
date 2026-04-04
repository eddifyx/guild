export function createEditMessageAction({
  socket = null,
  messages = [],
  warnFn = () => {},
} = {}) {
  return function editMessage(messageId, content) {
    if (!socket) return;

    const message = (messages || []).find((entry) => entry?.id === messageId);
    if (message?._decrypted) {
      warnFn('Editing encrypted messages is not supported');
      return;
    }

    socket.emit('message:edit', { messageId, content });
  };
}

export function createDeleteMessageAction({
  socket = null,
  warnFn = () => {},
} = {}) {
  return function deleteMessage(messageId) {
    if (!socket) return;

    socket.emit('message:delete', { messageId }, (response) => {
      if (response?.ok) return;
      warnFn('Failed to delete message:', response?.error || 'Unknown delete failure');
    });
  };
}
