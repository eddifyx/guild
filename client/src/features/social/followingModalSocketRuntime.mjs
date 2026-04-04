import { mergeFollowingModalIncomingRequests } from './followingModalRuntime.mjs';

export function bindFollowingModalSocketRuntime({
  socket,
  setIncomingFn,
  reloadContactsFn,
  mergeIncomingFn = mergeFollowingModalIncomingRequests,
}) {
  if (!socket) {
    return () => {};
  }

  const handleRequestReceived = (data) => {
    setIncomingFn((previous) => mergeIncomingFn(previous, data));
  };
  const handleRequestAccepted = () => {
    void reloadContactsFn();
  };

  socket.on('friend:request-received', handleRequestReceived);
  socket.on('friend:request-accepted', handleRequestAccepted);

  return () => {
    socket.off('friend:request-received', handleRequestReceived);
    socket.off('friend:request-accepted', handleRequestAccepted);
  };
}
