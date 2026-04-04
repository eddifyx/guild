import React, { memo, useMemo, useState, useRef, useCallback } from 'react';
import { useSocket } from '../../contexts/SocketContext';
import { deleteChatAttachmentUpload, uploadChatAttachment } from '../../utils/chatUploads';
import FileUploadButton from '../Common/FileUploadButton';
import {
  getMessageInputActiveState,
  getMessageInputPlaceholder,
  revokePendingPreview,
} from '../../features/messaging/messageInputModel.mjs';
import {
  clearMessageInputDragState,
  createMessageInputAttachmentUploader,
  createMessageInputDragHandlers,
  createMessageInputSendHandler,
  createPendingFileRemovalHandler,
  emitMessageInputTyping,
} from '../../features/messaging/messageInputRuntime.mjs';
import { useMessageInputRuntimeEffects } from '../../features/messaging/useMessageInputRuntimeEffects.mjs';


function MessageInput({ onSend, conversation }) {
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [inputError, setInputError] = useState('');
  const { socket } = useSocket();
  const typingRef = useRef(false);
  const typingTimeoutRef = useRef(null);
  const textareaRef = useRef(null);
  const pendingFilesRef = useRef([]);
  const dragDepthRef = useRef(0);
  const sendingRef = useRef(false);

  const emitTyping = useCallback((start) => {
    emitMessageInputTyping({
      socket,
      conversation,
      start,
    });
  }, [socket, conversation]);

  useMessageInputRuntimeEffects({
    pendingFiles,
    pendingFilesRef,
    emitTypingFn: emitTyping,
    typingRef,
    typingTimeoutRef,
    textareaRef,
    text,
    conversation,
  });

  const handleChange = (e) => {
    setText(e.target.value);
    if (inputError) setInputError('');
    if (!typingRef.current) {
      typingRef.current = true;
      emitTyping(true);
    }
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      typingRef.current = false;
      emitTyping(false);
    }, 3000);
  };

  const handleSend = useMemo(() => createMessageInputSendHandler({
    getSending: () => sendingRef.current,
    setSendingFn: (value) => {
      sendingRef.current = value;
    },
    getText: () => text,
    getPendingFiles: () => pendingFilesRef.current,
    setInputErrorFn: setInputError,
    setTextFn: setText,
    pendingFilesRef,
    setPendingFilesFn: setPendingFiles,
    typingRef,
    typingTimeoutRef,
    emitTypingFn: emitTyping,
    clearTimeoutFn: clearTimeout,
    requestAnimationFrameFn: requestAnimationFrame,
    focusFn: () => textareaRef.current?.focus(),
    onSend,
  }), [emitTyping, onSend, text]);

  const handleKeyDown = (e) => {
    if (e.nativeEvent?.isComposing) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleFileUploaded = (fileData) => {
    setInputError('');
    setPendingFiles(prev => [...prev, fileData]);
  };

  const uploadPendingAttachments = useMemo(() => createMessageInputAttachmentUploader({
    getUploading: () => uploading,
    setUploadingFn: setUploading,
    setInputErrorFn: setInputError,
    setPendingFilesFn: setPendingFiles,
    uploadAttachmentFn: uploadChatAttachment,
  }), [uploading]);

  const handlePaste = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles = [];
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length === 0) return;

    e.preventDefault();
    await uploadPendingAttachments(imageFiles, 'Paste');
  };

  const removePendingFile = useMemo(() => createPendingFileRemovalHandler({
    getPendingFiles: () => pendingFilesRef.current,
    setPendingFilesFn: setPendingFiles,
    revokePreviewFn: revokePendingPreview,
    deleteUploadFn: deleteChatAttachmentUpload,
  }), []);

  const clearDragState = useCallback(() => {
    clearMessageInputDragState({
      dragDepthRef,
      setDragActiveFn: setDragActive,
    });
  }, []);

  const dragHandlers = useMemo(() => createMessageInputDragHandlers({
    getDragActive: () => dragActive,
    dragDepthRef,
    setDragActiveFn: setDragActive,
    clearDragStateFn: clearDragState,
    uploadPendingAttachmentsFn: uploadPendingAttachments,
  }), [clearDragState, dragActive, uploadPendingAttachments]);

  const active = getMessageInputActiveState({
    text,
    pendingFiles,
    uploading,
  });

  return (
    <div style={{
      position: 'relative',
      borderTop: '1px solid var(--border)',
      background: 'var(--bg-secondary)',
    }}
      onDragEnter={dragHandlers.handleDragEnter}
      onDragOver={dragHandlers.handleDragOver}
      onDragLeave={dragHandlers.handleDragLeave}
      onDrop={dragHandlers.handleDrop}
    >
      {dragActive && (
        <div style={{
          position: 'absolute',
          inset: 0,
          zIndex: 4,
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(64, 255, 64, 0.08)',
          borderTop: '1px solid rgba(64, 255, 64, 0.2)',
          boxShadow: 'inset 0 0 0 2px rgba(64, 255, 64, 0.4)',
          color: 'var(--accent)',
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: '0.01em',
        }}>
          Drop files to attach
        </div>
      )}
      {pendingFiles.length > 0 && (
        <div style={{
          display: 'flex',
          gap: 8,
          padding: '8px 16px 0',
          flexWrap: 'wrap',
        }}>
          {pendingFiles.map((file, i) => (
            <div key={i} style={{
              position: 'relative',
              borderRadius: 6,
              border: '1px solid var(--border)',
              overflow: 'hidden',
              background: 'var(--bg-tertiary)',
            }}>
              {(file._originalType || file.fileType || '').startsWith('image/') && file._previewUrl ? (
                <img
                  src={file._previewUrl}
                  alt={file._originalName || file.fileName}
                  style={{ height: 60, maxWidth: 120, objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text-secondary)' }}>
                  {file._originalName || file.fileName}
                </div>
              )}
              <button
                onClick={() => removePendingFile(i)}
                style={{
                  position: 'absolute',
                  top: 2,
                  right: 2,
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: 'rgba(0,0,0,0.7)',
                  border: 'none',
                  color: '#fff',
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  lineHeight: 1,
                }}
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      {inputError && (
        <div style={{
          margin: '8px 16px 0',
          padding: '8px 10px',
          borderRadius: 6,
          background: 'rgba(255, 71, 87, 0.1)',
          color: 'var(--danger)',
          fontSize: 11,
          lineHeight: 1.4,
        }}>
          {inputError}
        </div>
      )}

      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 8,
        padding: '12px 16px',
      }}>
        <FileUploadButton onUploaded={handleFileUploaded} onError={setInputError} />
        <textarea
          ref={textareaRef}
          data-primary-composer="chat"
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={getMessageInputPlaceholder({ uploading })}
          rows={1}
          style={{
            flex: 1,
            resize: 'none',
            padding: '10px 14px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--bg-input)',
            color: 'var(--text-primary)',
            fontSize: 13,
            outline: 'none',
            lineHeight: 1.5,
            maxHeight: 120,
            fontFamily: 'inherit',
            transition: 'border-color 0.2s',
            caretColor: '#40FF40',
          }}
          onFocus={e => e.target.style.borderColor = 'rgba(64, 255, 64, 0.3)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'}
        />
        <button
          onClick={handleSend}
          disabled={!active}
          style={{
            background: active ? 'var(--accent)' : 'var(--bg-tertiary)',
            border: 'none',
            borderRadius: 8,
            padding: '10px 14px',
            cursor: active ? 'pointer' : 'default',
            color: active ? '#050705' : 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            transition: 'all 0.2s',
            boxShadow: active ? '0 0 12px rgba(64, 255, 64, 0.2)' : 'none',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22,2 15,22 11,13 2,9" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default memo(MessageInput, (prevProps, nextProps) => (
  prevProps.onSend === nextProps.onSend
  && prevProps.conversation?.id === nextProps.conversation?.id
  && prevProps.conversation?.type === nextProps.conversation?.type
));
