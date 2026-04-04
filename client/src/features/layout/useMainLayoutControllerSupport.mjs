import { useGuildChat } from '../../hooks/useGuildChat';
import { useNotifications } from '../../hooks/useNotifications';
import { useRooms } from '../../hooks/useRooms';
import { useUnreadDMs } from '../../hooks/useUnreadDMs';
import { useUnreadRooms } from '../../hooks/useUnreadRooms';

export function useMainLayoutControllerSupport({
  currentGuild = null,
  conversation = null,
  guildChatAvailable = false,
} = {}) {
  const { rooms, myRooms, createRoom, joinRoom, renameRoom, deleteRoom } = useRooms(currentGuild);
  useNotifications(conversation, rooms);
  const { unreadCounts, clearUnread } = useUnreadDMs(conversation);
  const { unreadRoomCounts, clearUnreadRoom } = useUnreadRooms(conversation);

  const guildChat = useGuildChat({ visible: guildChatAvailable });
  const clearGuildChatUnreadMentions = guildChat.clearUnreadMentions;

  return {
    rooms,
    myRooms,
    createRoom,
    joinRoom,
    renameRoom,
    deleteRoom,
    unreadCounts,
    clearUnread,
    unreadRoomCounts,
    clearUnreadRoom,
    guildChat,
    clearGuildChatUnreadMentions,
  };
}
