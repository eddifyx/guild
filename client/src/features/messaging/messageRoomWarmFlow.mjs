export const MESSAGE_ROOM_WARM_LIMIT = 10;

export async function warmRoomMessageCache({
  rooms,
  userId,
  maxRooms = 3,
  concurrency = 1,
  roomWarmLimit = MESSAGE_ROOM_WARM_LIMIT,
  isE2EInitializedFn,
  getCachedConversationStateFn,
  fetchConversationMessagesFn,
  cacheConversationStateFn,
  warnFn = console.warn,
} = {}) {
  if (!Array.isArray(rooms) || rooms.length === 0 || !userId || !isE2EInitializedFn?.()) return;

  const normalizedMaxRooms = Math.max(0, Number(maxRooms) || 0);
  if (normalizedMaxRooms === 0) return;

  const roomsToWarm = rooms
    .filter((room) => !getCachedConversationStateFn?.({ type: 'room', id: room.id }, userId))
    .slice(0, normalizedMaxRooms);
  const workerCount = Math.min(Math.max(1, Number(concurrency) || 1), roomsToWarm.length);
  if (workerCount === 0) return;

  const warmNext = async (index) => {
    const room = roomsToWarm[index];
    if (!room) return;

    const conversation = { type: 'room', id: room.id };
    try {
      const { messages, hasMore } = await fetchConversationMessagesFn?.(conversation, userId, {
        limit: roomWarmLimit,
        quietDecrypt: true,
        fastRoomOpen: true,
      });
      cacheConversationStateFn?.(conversation, messages, hasMore, userId);
    } catch (error) {
      warnFn?.('[Rooms] Failed to warm room cache for', room?.name || room?.id, error?.message || error);
    }

    await warmNext(index + workerCount);
  };

  await Promise.all(Array.from({ length: workerCount }, (_, index) => warmNext(index)));
}
