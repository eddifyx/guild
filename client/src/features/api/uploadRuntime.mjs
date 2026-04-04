export async function uploadFormDataWithAuth({
  endpoint,
  formData,
  authHeaders = {},
  serverUrl,
  fetchFn = fetch,
  handleSessionExpiryFn = () => {},
  toServerConnectionErrorFn = (error) => error,
  failureMessage = 'Upload failed',
}) {
  let response;
  try {
    response = await fetchFn(`${serverUrl}${endpoint}`, {
      method: 'POST',
      headers: authHeaders,
      body: formData,
    });
  } catch (error) {
    throw toServerConnectionErrorFn(error);
  }

  if (!response.ok) {
    handleSessionExpiryFn(response.status);
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(err.error || failureMessage);
  }

  return response.json();
}

export function uploadFileWithXhr({
  endpoint,
  file,
  description,
  authToken,
  onProgress,
  serverUrl,
  failureMessage,
  sessionExpiredMessage = 'Session expired',
  xhrFactory = () => new XMLHttpRequest(),
  formDataFactory = () => new FormData(),
  handleSessionExpiryFn = () => {},
}) {
  return new Promise((resolve, reject) => {
    const formData = formDataFactory();
    formData.append('file', file);
    if (description) {
      formData.append('description', description);
    }

    const xhr = xhrFactory();
    xhr.open('POST', `${serverUrl}${endpoint}`);
    if (authToken) {
      xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
    }

    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status === 401) {
        handleSessionExpiryFn(401);
        reject(new Error(sessionExpiredMessage));
        return;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error('Invalid server response'));
        }
        return;
      }

      let message = failureMessage;
      try {
        message = JSON.parse(xhr.responseText).error || message;
      } catch {}
      reject(new Error(message));
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(formData);
  });
}
