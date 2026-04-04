import { useRef, useState } from 'react';

export function useMainLayoutControllerState() {
  const [conversation, setConversation] = useState(null);
  const [conversationName, setConversationName] = useState('');
  const [conversationOpenTraceId, setConversationOpenTraceId] = useState(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersionInfo, setLatestVersionInfo] = useState(null);
  const [appVersion, setAppVersion] = useState('');
  const [showUpdateOverlay, setShowUpdateOverlay] = useState(false);
  const [versionToast, setVersionToast] = useState(null);
  const [showPiP, setShowPiP] = useState(false);
  const [e2eWarning, setE2eWarning] = useState(false);
  const [showVerifyIdentity, setShowVerifyIdentity] = useState(false);
  const [guildChatCompact, setGuildChatCompact] = useState(false);
  const [guildChatExpanded, setGuildChatExpanded] = useState(false);
  const [streamImmersive, setStreamImmersive] = useState(false);

  const guildChatInitialFocusAppliedRef = useRef(false);
  const prevConversationRef = useRef(undefined);
  const prevConversationNameRef = useRef(undefined);
  const prevJoinedVoiceChannelIdRef = useRef(null);
  const prevConvTypeRef = useRef(conversation?.type);
  const conversationOpenTraceRef = useRef(null);

  return {
    conversation,
    setConversation,
    conversationName,
    setConversationName,
    conversationOpenTraceId,
    setConversationOpenTraceId,
    updateAvailable,
    setUpdateAvailable,
    latestVersionInfo,
    setLatestVersionInfo,
    appVersion,
    setAppVersion,
    showUpdateOverlay,
    setShowUpdateOverlay,
    versionToast,
    setVersionToast,
    showPiP,
    setShowPiP,
    e2eWarning,
    setE2eWarning,
    showVerifyIdentity,
    setShowVerifyIdentity,
    guildChatCompact,
    setGuildChatCompact,
    guildChatExpanded,
    setGuildChatExpanded,
    streamImmersive,
    setStreamImmersive,
    guildChatInitialFocusAppliedRef,
    prevConversationRef,
    prevConversationNameRef,
    prevJoinedVoiceChannelIdRef,
    prevConvTypeRef,
    conversationOpenTraceRef,
  };
}
