export function syncLoginScreenImagePreview({
  createImageFile = null,
  setCreateImagePreviewFn = () => {},
  createObjectURLFn = (file) => URL.createObjectURL(file),
  revokeObjectURLFn = (url) => URL.revokeObjectURL(url),
} = {}) {
  if (!createImageFile) {
    setCreateImagePreviewFn('');
    return undefined;
  }

  const objectUrl = createObjectURLFn(createImageFile);
  setCreateImagePreviewFn(objectUrl);
  return () => revokeObjectURLFn(objectUrl);
}
