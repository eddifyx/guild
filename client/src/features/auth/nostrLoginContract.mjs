export const AUTH_EVENT_RELAY_HINT = 'wss://nos.lol/';
export const LOGIN_COMPAT_KIND = 1;
export const LOGIN_COMPAT_CONTENT = '/guild login';
export const LOGIN_COMPAT_CLIENT = '/guild';
export const PREFER_NIP42_LOGIN_PROOF = true;

export function buildLoginAuthEvent(challenge, { compatibilityMode = false, pubkey = null } = {}) {
  if (compatibilityMode) {
    return {
      kind: LOGIN_COMPAT_KIND,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['challenge', challenge],
        ['client', LOGIN_COMPAT_CLIENT],
        ['relay', AUTH_EVENT_RELAY_HINT],
      ],
      content: LOGIN_COMPAT_CONTENT,
      ...(pubkey ? { pubkey } : {}),
    };
  }

  return {
    kind: 22242,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['relay', AUTH_EVENT_RELAY_HINT],
      ['challenge', challenge],
    ],
    content: '',
    ...(pubkey ? { pubkey } : {}),
  };
}
