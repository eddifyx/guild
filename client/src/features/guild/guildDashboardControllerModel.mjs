export function buildGuildDashboardStatusSubmit({
  statusDraft = '',
  maxLength,
} = {}) {
  return String(statusDraft || '').trim().slice(0, maxLength);
}

export function buildGuildDashboardProfileCardPayload({
  member,
  event,
  currentUserId,
} = {}) {
  if (!member || member.id === currentUserId) return null;
  return {
    user: member,
    position: {
      x: event?.clientX ?? 0,
      y: event?.clientY ?? 0,
    },
  };
}

export function buildGuildDashboardStatusDraft({
  editingStatus = false,
  statusDraft = '',
  myStatus = '',
} = {}) {
  return editingStatus ? statusDraft : myStatus;
}

export function buildGuildDashboardHeaderState({
  currentGuildData = null,
  guildImgFailed = false,
  getFileUrlFn = (value) => value,
} = {}) {
  const guildImage = currentGuildData?.image_url || null;
  return {
    guildName: currentGuildData?.name || 'Guild',
    guildMotd: String(currentGuildData?.motd || '').trim(),
    guildDescription: currentGuildData?.description || '',
    guildImage,
    guildImageUrl: guildImage && !guildImgFailed ? getFileUrlFn(guildImage) : null,
  };
}
