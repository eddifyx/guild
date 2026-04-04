import { hasFileDrag } from './messageInputModel.mjs';

export function clearMessageInputDragState({
  dragDepthRef,
  setDragActiveFn = () => {},
}) {
  dragDepthRef.current = 0;
  setDragActiveFn(false);
}

export function createMessageInputDragHandlers({
  getDragActive = () => false,
  dragDepthRef,
  setDragActiveFn = () => {},
  clearDragStateFn = () => {},
  uploadPendingAttachmentsFn = async () => {},
  hasFileDragFn = hasFileDrag,
}) {
  return {
    handleDragEnter(event) {
      if (!hasFileDragFn(event.dataTransfer)) return;
      event.preventDefault();
      event.stopPropagation();
      dragDepthRef.current += 1;
      setDragActiveFn(true);
    },
    handleDragOver(event) {
      if (!hasFileDragFn(event.dataTransfer)) return;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = 'copy';
      if (!getDragActive()) {
        setDragActiveFn(true);
      }
    },
    handleDragLeave(event) {
      if (!hasFileDragFn(event.dataTransfer)) return;
      event.preventDefault();
      event.stopPropagation();
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) {
        setDragActiveFn(false);
      }
    },
    async handleDrop(event) {
      if (!hasFileDragFn(event.dataTransfer)) return;
      event.preventDefault();
      event.stopPropagation();
      const droppedFiles = Array.from(event.dataTransfer?.files || []);
      clearDragStateFn();
      await uploadPendingAttachmentsFn(droppedFiles, 'Drop');
    },
  };
}
