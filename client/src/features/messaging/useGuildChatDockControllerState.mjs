import { useEffect, useRef, useState } from 'react';

export function useGuildChatDockControllerState({
  hidden = false,
} = {}) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [localError, setLocalError] = useState('');
  const [composerSelection, setComposerSelection] = useState({ start: 0, end: 0 });
  const [selectedMentionSuggestionIndex, setSelectedMentionSuggestionIndex] = useState(0);
  const [dragActive, setDragActive] = useState(false);

  const typingActiveRef = useRef(false);
  const typingTimeoutRef = useRef(null);
  const feedRef = useRef(null);
  const inputRef = useRef(null);
  const stickToBottomRef = useRef(true);
  const pendingFilesRef = useRef([]);
  const dragDepthRef = useRef(0);
  const collapseScrollTimeoutRef = useRef(null);
  const previousHiddenRef = useRef(hidden);
  const previousFullscreenRef = useRef(false);
  const initialFocusAppliedRef = useRef(false);

  useEffect(() => {
    pendingFilesRef.current = pendingFiles;
  }, [pendingFiles]);

  return {
    draft,
    setDraft,
    sending,
    setSending,
    pendingFiles,
    setPendingFiles,
    localError,
    setLocalError,
    composerSelection,
    setComposerSelection,
    selectedMentionSuggestionIndex,
    setSelectedMentionSuggestionIndex,
    dragActive,
    setDragActive,
    typingActiveRef,
    typingTimeoutRef,
    feedRef,
    inputRef,
    stickToBottomRef,
    pendingFilesRef,
    dragDepthRef,
    collapseScrollTimeoutRef,
    previousHiddenRef,
    previousFullscreenRef,
    initialFocusAppliedRef,
  };
}
