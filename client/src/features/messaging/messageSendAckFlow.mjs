export const MESSAGE_SEND_TIMEOUT_MS = 10_000;

export function createAckEmitter({
  socket = null,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
  timeoutMs = MESSAGE_SEND_TIMEOUT_MS,
} = {}) {
  return (eventName, payload) => new Promise((resolve, reject) => {
    const timeoutId = setTimeoutFn(() => {
      reject(new Error('Secure send timed out. Try again.'));
    }, timeoutMs);

    socket.emit(eventName, payload, (response) => {
      clearTimeoutFn(timeoutId);
      if (response?.ok) {
        resolve(response);
        return;
      }
      reject(new Error(response?.error || 'Secure send failed.'));
    });
  });
}
