import { useCallback, useMemo } from 'react';
import { checkLatestVersion } from '../../api';
import { BOARDS_DISABLED } from '../messaging/boardAvailability.mjs';
import {
  applyConversationName,
  applyConversationState,
  createConversationSelectionActions,
} from '../messaging/conversationNavigationFlow.mjs';
import {
  focusGuildChatComposer as focusGuildChatComposerRuntime,
  queueGuildChatComposerFocus as queueGuildChatComposerFocusRuntime,
} from './layoutGuildChatRuntime.mjs';
import { handleMainLayoutUpdateAction } from './mainLayoutUpdateFlow.mjs';
import { cancelPerfTrace, startPerfTrace } from '../../utils/devPerf';
import {
  clearMainLayoutConversationPerfTrace,
  deriveMainLayoutConversationState,
  deriveMainLayoutLatestVersionState,
  updateMainLayoutConversationPerfTrace,
} from './mainLayoutControllerRuntimeUtils.mjs';

export function useMainLayoutControllerRuntime({
  socket = null,
  user = null,
  clearUnreadFn = () => {},
  clearUnreadRoomFn = () => {},
  clearGuildChatUnreadMentionsFn = () => {},
  conversationOpenTraceRef,
  setConversationFn = () => {},
  setConversationNameFn = () => {},
  setConversationOpenTraceIdFn = () => {},
  setLatestVersionInfoFn = () => {},
  setUpdateAvailableFn = () => {},
  setShowUpdateOverlayFn = () => {},
  setVersionToastFn = () => {},
  setGuildChatExpandedFn = () => {},
  updateState = {},
} = {}) {
  const refreshLatestVersionInfo = useCallback(async () => {
    const info = await checkLatestVersion();
    const nextState = deriveMainLayoutLatestVersionState(info);
    setLatestVersionInfoFn(nextState.latestVersionInfo);
    setUpdateAvailableFn(nextState.updateAvailable);
    return info;
  }, [setLatestVersionInfoFn, setUpdateAvailableFn]);

  const setConversationState = useCallback((nextConversation, nextConversationName = '') => {
    setConversationFn((previousConversation) => (
      deriveMainLayoutConversationState({
        previousConversation,
        previousConversationName: updateState.getConversationName?.() || '',
        nextConversation,
        nextConversationName,
        applyConversationStateFn: applyConversationState,
        applyConversationNameFn: applyConversationName,
      }).conversation
    ));
    setConversationNameFn((previousConversationName) => (
      deriveMainLayoutConversationState({
        previousConversation: updateState.getConversation?.() || null,
        previousConversationName,
        nextConversation,
        nextConversationName,
        applyConversationStateFn: applyConversationState,
        applyConversationNameFn: applyConversationName,
      }).conversationName
    ));
  }, [setConversationFn, setConversationNameFn, updateState]);

  const setConversationPerfTrace = useCallback((nextTraceId) => {
    const updatedTraceId = updateMainLayoutConversationPerfTrace({
      currentTraceId: conversationOpenTraceRef.current,
      nextTraceId,
      cancelPerfTraceFn: cancelPerfTrace,
    });
    conversationOpenTraceRef.current = updatedTraceId;
    setConversationOpenTraceIdFn(updatedTraceId);
  }, [conversationOpenTraceRef, setConversationOpenTraceIdFn]);

  const clearConversationPerfTrace = useCallback((reason = 'navigated-away') => {
    const clearedTraceId = clearMainLayoutConversationPerfTrace({
      currentTraceId: conversationOpenTraceRef.current,
      reason,
      cancelPerfTraceFn: cancelPerfTrace,
    });
    conversationOpenTraceRef.current = clearedTraceId;
    setConversationOpenTraceIdFn(clearedTraceId);
  }, [conversationOpenTraceRef, setConversationOpenTraceIdFn]);

  const focusGuildChatComposer = useCallback(() => {
    focusGuildChatComposerRuntime({
      windowObj: typeof window !== 'undefined' ? window : null,
    });
  }, []);

  const queueGuildChatComposerFocus = useCallback(() => {
    queueGuildChatComposerFocusRuntime({
      windowObj: typeof window !== 'undefined' ? window : null,
      focusGuildChatComposerFn: focusGuildChatComposer,
    });
  }, [focusGuildChatComposer]);

  const selectionActions = useMemo(() => createConversationSelectionActions({
    clearConversationPerfTrace,
    setConversationState,
    setConversationPerfTrace,
    clearUnreadRoom: clearUnreadRoomFn,
    clearUnread: clearUnreadFn,
    socket,
    user,
    startTrace: startPerfTrace,
    setGuildChatExpanded: setGuildChatExpandedFn,
    clearGuildChatUnreadMentions: clearGuildChatUnreadMentionsFn || (() => {}),
    queueGuildChatComposerFocus,
    boardsDisabled: BOARDS_DISABLED,
  }), [
    clearConversationPerfTrace,
    setConversationState,
    setConversationPerfTrace,
    clearUnreadRoomFn,
    clearUnreadFn,
    socket,
    user,
    setGuildChatExpandedFn,
    clearGuildChatUnreadMentionsFn,
    queueGuildChatComposerFocus,
  ]);

  const handleUpdateButtonClick = useCallback(async () => {
    await handleMainLayoutUpdateAction({
      updateAvailable: updateState.getUpdateAvailable?.() || false,
      latestVersionInfo: updateState.getLatestVersionInfo?.() || null,
      appVersion: updateState.getAppVersion?.() || '',
      refreshLatestVersionInfoFn: refreshLatestVersionInfo,
      setShowUpdateOverlayFn,
      setVersionToastFn,
      setTimeoutFn: (callback, duration) => setTimeout(callback, duration),
    });
  }, [
    updateState,
    refreshLatestVersionInfo,
    setShowUpdateOverlayFn,
    setVersionToastFn,
  ]);

  return {
    refreshLatestVersionInfo,
    setConversationState,
    setConversationPerfTrace,
    clearConversationPerfTrace,
    focusGuildChatComposer,
    queueGuildChatComposerFocus,
    handleUpdateButtonClick,
    ...selectionActions,
  };
}
