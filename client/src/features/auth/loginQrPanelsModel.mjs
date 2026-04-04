import {
  LOGIN_QR_ADVANCED_LABEL,
  LOGIN_QR_HIDE_ADVANCED_LABEL,
  LOGIN_QR_HIDE_BUNKER_LABEL,
  LOGIN_QR_USE_BUNKER_LABEL,
} from './loginQrModel.mjs';

export function getLoginQrAdvancedToggleLabel(showQrAdvanced = false) {
  return showQrAdvanced ? LOGIN_QR_HIDE_ADVANCED_LABEL : LOGIN_QR_ADVANCED_LABEL;
}

export function getLoginQrBunkerToggleLabel(showBunkerInput = false) {
  return showBunkerInput ? LOGIN_QR_HIDE_BUNKER_LABEL : LOGIN_QR_USE_BUNKER_LABEL;
}

export function buildLoginQrInstallState({
  connectURI = '',
  qrStatusMessage = '',
} = {}) {
  return {
    connectURI,
    qrStatusMessage,
    showQrCode: Boolean(connectURI),
  };
}

export function buildLoginQrAdvancedState({
  qrBusy = false,
  showQrAdvanced = false,
  canCopyQrUri = false,
  showBunkerInput = false,
  canSubmitBunker = false,
  loading = false,
  qrUriCopyState = '',
} = {}) {
  return {
    refreshDisabled: qrBusy,
    advancedToggleLabel: getLoginQrAdvancedToggleLabel(showQrAdvanced),
    copyDisabled: !canCopyQrUri,
    bunkerToggleLabel: getLoginQrBunkerToggleLabel(showBunkerInput),
    submitDisabled: !canSubmitBunker,
    submitLabel: loading ? 'Connecting...' : 'Connect with bunker URI',
    qrUriCopyState,
    showCopyState: Boolean(qrUriCopyState),
  };
}
