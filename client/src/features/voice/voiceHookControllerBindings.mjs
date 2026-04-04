export function buildUseVoiceHookScreenShareControllerOptions({
  socket = null,
  state = {},
  refs = {},
  runtime = {},
} = {}) {
  return {
    socket,
    state,
    refs,
    runtime,
  };
}

export function buildUseVoiceHookSecurityControllerOptions({
  socket = null,
  userId = null,
  state = {},
  refs = {},
  runtime = {},
} = {}) {
  return {
    socket,
    userId,
    state,
    refs,
    runtime,
  };
}

export function buildUseVoiceHookCaptureControllerOptions({
  socket = null,
  state = {},
  refs = {},
  runtime = {},
} = {}) {
  return {
    socket,
    state,
    refs,
    runtime,
  };
}

export function buildUseVoiceHookMediaTransportControllerOptions({
  socket = null,
  currentUserId = null,
  state = {},
  refs = {},
  runtime = {},
} = {}) {
  return {
    socket,
    currentUserId,
    state,
    refs,
    runtime,
  };
}

export function buildUseVoiceHookSessionControllerOptions({
  socket = null,
  state = {},
  refs = {},
  runtime = {},
  constants = {},
  deps = [],
} = {}) {
  return {
    socket,
    state,
    refs,
    runtime,
    constants,
    deps,
  };
}

export function buildUseVoiceHookUiControllerOptions({
  socket = null,
  state = {},
  refs = {},
  runtime = {},
} = {}) {
  return {
    socket,
    state,
    refs,
    runtime,
  };
}

export function buildUseVoiceHookRuntimeBindingsControllerOptions({
  state = {},
  refs = {},
  runtime = {},
} = {}) {
  return {
    state,
    refs,
    runtime,
  };
}
