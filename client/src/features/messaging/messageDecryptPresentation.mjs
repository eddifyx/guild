export function getConversationDecryptFailureMessage(bucket = null) {
  switch (bucket) {
    case 'missing-dm-copy':
      return 'This secure message was not sent to this device';
    case 'missing-session':
      return 'Secure session data was unavailable for this message';
    case 'missing-sender-key':
      return 'Secure room keys were unavailable for this message';
    case 'untrusted-identity':
      return 'Identity verification is still required for this message';
    case 'e2e-not-ready':
      return 'Secure messaging was not ready for this message';
    default:
      return 'Message could not be decrypted';
  }
}
