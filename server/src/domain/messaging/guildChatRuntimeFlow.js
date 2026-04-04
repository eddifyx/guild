function createGuildChatRuntimeFlow({
  deleteUploadedFileRecord,
  unlinkStoredFile,
  maxLiveMessages = 200,
  graceMs = 60 * 1000,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
} = {}) {
  const guildChatRuntime = new Map();
  const guildChatCleanupTimers = new Map();

  function getGuildChatState(guildId, autoCreate = false) {
    if (!guildChatRuntime.has(guildId)) {
      if (!autoCreate) return null;
      guildChatRuntime.set(guildId, {
        messageOrder: [],
        attachmentsByMessageId: new Map(),
      });
    }
    return guildChatRuntime.get(guildId);
  }

  function deleteGuildChatUploads(entries = []) {
    for (const entry of entries) {
      if (!entry?.uploadId || !entry?.storedName) continue;
      try { unlinkStoredFile(entry.storedName); } catch {}
      try { deleteUploadedFileRecord.run(entry.uploadId); } catch {}
    }
  }

  function trackAttachments(guildId, messageId, attachments = []) {
    if (!guildId || !messageId) return;
    const state = getGuildChatState(guildId, true);
    state.messageOrder.push(messageId);
    state.attachmentsByMessageId.set(
      messageId,
      attachments
        .map((attachment) => ({
          uploadId: attachment.uploaded_file_id,
          storedName: attachment._storedName || '',
        }))
        .filter((entry) => entry.uploadId && entry.storedName)
    );

    while (state.messageOrder.length > maxLiveMessages) {
      const evictedMessageId = state.messageOrder.shift();
      if (!evictedMessageId) continue;
      const staleEntries = state.attachmentsByMessageId.get(evictedMessageId) || [];
      state.attachmentsByMessageId.delete(evictedMessageId);
      deleteGuildChatUploads(staleEntries);
    }
  }

  function cleanupGuild(guildId) {
    const state = getGuildChatState(guildId, false);
    if (!state) return;
    for (const entries of state.attachmentsByMessageId.values()) {
      deleteGuildChatUploads(entries);
    }
    guildChatRuntime.delete(guildId);
  }

  function cancelCleanup(guildId) {
    const timeoutId = guildChatCleanupTimers.get(guildId);
    if (!timeoutId) return;
    clearTimeoutFn(timeoutId);
    guildChatCleanupTimers.delete(guildId);
  }

  function scheduleCleanup(io, guildId, guildChatRoom) {
    if (!guildId) return;
    cancelCleanup(guildId);
    const timeoutId = setTimeoutFn(() => {
      guildChatCleanupTimers.delete(guildId);
      const room = io?.sockets?.adapter?.rooms?.get?.(guildChatRoom(guildId));
      if (!room || room.size === 0) {
        cleanupGuild(guildId);
      }
    }, graceMs);
    guildChatCleanupTimers.set(guildId, timeoutId);
  }

  return {
    cancelCleanup,
    cleanupGuild,
    scheduleCleanup,
    trackAttachments,
  };
}

module.exports = {
  createGuildChatRuntimeFlow,
};
