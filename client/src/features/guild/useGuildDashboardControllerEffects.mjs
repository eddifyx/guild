import { useEffect } from 'react';

export function useGuildDashboardControllerEffects({
  currentGuild = null,
  fetchMembers = async () => [],
  setMembers = () => {},
  onlineUsers = [],
  currentUserId = null,
  setMyStatus = () => {},
  editingStatus = false,
  statusInputRef = { current: null },
  onRosterViewChange = null,
  isRosterExpanded = false,
  setShowExpandedRoster = () => {},
  setShowOffline = () => {},
  headerImage = '',
  setGuildImgFailed = () => {},
} = {}) {
  useEffect(() => {
    if (!currentGuild) return;
    fetchMembers(currentGuild).then(setMembers).catch(() => setMembers([]));
  }, [currentGuild, fetchMembers, setMembers]);

  useEffect(() => {
    const me = onlineUsers.find((onlineUser) => onlineUser.userId === currentUserId);
    if (me) setMyStatus(me.customStatus || '');
  }, [currentUserId, onlineUsers, setMyStatus]);

  useEffect(() => {
    if (editingStatus && statusInputRef.current) {
      statusInputRef.current.focus();
    }
  }, [editingStatus, statusInputRef]);

  useEffect(() => {
    onRosterViewChange?.(isRosterExpanded);
  }, [isRosterExpanded, onRosterViewChange]);

  useEffect(() => () => {
    onRosterViewChange?.(false);
  }, [onRosterViewChange]);

  useEffect(() => {
    setShowExpandedRoster(false);
    setShowOffline(false);
  }, [currentGuild, setShowExpandedRoster, setShowOffline]);

  useEffect(() => {
    setGuildImgFailed(false);
  }, [headerImage, setGuildImgFailed]);
}
