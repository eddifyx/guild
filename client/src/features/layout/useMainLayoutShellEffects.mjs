import { useEffect } from 'react';
import { isE2EInitialized, wasE2EExpected } from '../../crypto/sessionManager';
import { routeSystemNotificationAction } from '../messaging/notificationRuntimeFlow.mjs';
import {
  focusGuildChatComposer as focusGuildChatComposerRuntime,
  scheduleInitialGuildChatComposerFocus,
  syncGuildChatDockState,
  syncGuildChatExpandedState,
  syncStreamImmersiveState,
} from './layoutGuildChatRuntime.mjs';
import {
  bindComposerShortcut,
  bindE2EWarningEvents,
  bindRoomAutoJoin,
  bindSystemNotificationActions,
  startVersionPolling,
  syncE2EWarningState,
} from './layoutShellRuntime.mjs';

export function useMainLayoutShellEffects({
  e2eWarning,
  setE2eWarningFn,
  refreshLatestVersionInfoFn,
  setAppVersionFn,
  socket = null,
  myRooms = [],
  rooms = [],
  conversation = null,
  clearConversationPerfTraceFn,
  clearGuildChatUnreadMentionsFn,
  handleSelectDM,
  handleSelectRoom,
  setConversationStateFn,
  guildChatInitialFocusAppliedRef,
  currentGuildData = null,
  showGuildChatDock = false,
  focusGuildChatComposerFn,
  streamImmersive = false,
  setStreamImmersiveFn,
  guildChatAvailable = false,
  guildChatExpanded = false,
  setGuildChatExpandedFn,
  setGuildChatCompactFn,
} = {}) {
  const windowObj = typeof window !== 'undefined' ? window : null;
  const documentObj = typeof document !== 'undefined' ? document : null;

  useEffect(() => {
    return bindE2EWarningEvents({
      windowObj,
      setE2eWarningFn,
      wasE2EExpectedFn: wasE2EExpected,
    });
  }, [setE2eWarningFn, windowObj]);

  useEffect(() => {
    syncE2EWarningState({
      e2eWarning,
      isE2EInitializedFn: isE2EInitialized,
      setE2eWarningFn,
    });
  }, [e2eWarning, setE2eWarningFn]);

  useEffect(() => {
    return startVersionPolling({
      getAppVersionFn: windowObj?.electronAPI?.getAppVersion,
      refreshLatestVersionInfoFn,
      setAppVersionFn,
    });
  }, [refreshLatestVersionInfoFn, setAppVersionFn, windowObj]);

  useEffect(() => {
    return bindRoomAutoJoin({
      socket,
      myRooms,
    });
  }, [socket, myRooms]);

  useEffect(() => {
    return bindComposerShortcut({
      windowObj,
      documentObj,
      isTextEntryTargetFn: (target) => {
        if (!(target instanceof HTMLElement)) return false;
        const tagName = target.tagName;
        if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
          return true;
        }
        return target.isContentEditable;
      },
      focusComposerFn: (composer) => {
        if (!(composer instanceof HTMLElement)) return;
        composer.focus();
        if (
          (composer instanceof HTMLInputElement || composer instanceof HTMLTextAreaElement)
          && typeof composer.value === 'string'
        ) {
          const caret = composer.value.length;
          composer.setSelectionRange(caret, caret);
        }
      },
    });
  }, [documentObj, windowObj]);

  useEffect(() => {
    return bindSystemNotificationActions({
      subscribeFn: windowObj?.electronAPI?.onSystemNotificationAction,
      handleNotificationActionFn: (payload = {}) => {
        routeSystemNotificationAction(payload, {
          myRooms,
          rooms,
          clearConversationPerfTrace: clearConversationPerfTraceFn,
          clearGuildChatUnreadMentions: clearGuildChatUnreadMentionsFn || (() => {}),
          handleSelectDM,
          handleSelectRoom,
          setConversationHome: () => setConversationStateFn(null, ''),
          focusGuildChatComposer: () => windowObj?.requestAnimationFrame(() => {
            windowObj.dispatchEvent(new CustomEvent('guildchat:focus-composer'));
          }),
        });
      },
    });
  }, [
    clearConversationPerfTraceFn,
    clearGuildChatUnreadMentionsFn,
    handleSelectDM,
    handleSelectRoom,
    myRooms,
    rooms,
    setConversationStateFn,
    windowObj,
  ]);

  useEffect(() => {
    syncGuildChatDockState({
      conversation,
      setGuildChatCompactFn,
      guildChatInitialFocusAppliedRef,
    });
  }, [conversation, guildChatInitialFocusAppliedRef, setGuildChatCompactFn]);

  useEffect(() => {
    syncStreamImmersiveState({
      conversationType: conversation?.type,
      streamImmersive,
      setStreamImmersiveFn,
    });
  }, [conversation?.type, streamImmersive, setStreamImmersiveFn]);

  useEffect(() => {
    syncGuildChatExpandedState({
      guildChatAvailable,
      guildChatExpanded,
      setGuildChatExpandedFn,
    });
  }, [guildChatAvailable, guildChatExpanded, setGuildChatExpandedFn]);

  useEffect(() => {
    return scheduleInitialGuildChatComposerFocus({
      showGuildChatDock,
      conversation,
      currentGuildData,
      guildChatInitialFocusAppliedRef,
      documentObj,
      windowObj,
      focusGuildChatComposerFn: () => {
        if (typeof focusGuildChatComposerFn === 'function') {
          focusGuildChatComposerFn();
          return;
        }
        focusGuildChatComposerRuntime({ windowObj });
      },
    });
  }, [
    showGuildChatDock,
    conversation,
    currentGuildData,
    guildChatInitialFocusAppliedRef,
    documentObj,
    windowObj,
    focusGuildChatComposerFn,
  ]);
}
