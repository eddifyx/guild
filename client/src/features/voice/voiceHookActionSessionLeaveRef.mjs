export function syncUseVoiceHookActionSessionLeaveRef({
  refs = {},
  leaveChannel,
} = {}) {
  const { leaveChannelRef } = refs;
  if (leaveChannelRef) {
    leaveChannelRef.current = leaveChannel;
  }
}
