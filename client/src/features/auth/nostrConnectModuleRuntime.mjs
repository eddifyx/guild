import { BunkerSigner, parseBunkerInput, createNostrConnectURI } from 'nostr-tools/nip46';
import { SimplePool } from 'nostr-tools/pool';
import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools';
import { encrypt as nip04Encrypt } from 'nostr-tools/nip04';
import { encrypt as nip44Encrypt, getConversationKey as getNip44ConversationKey } from 'nostr-tools/nip44';
import { nip19 } from 'nostr-tools';
import { bytesToHex } from '@noble/hashes/utils';

import { pushNip46Trace, redactTraceValue, summarizeError, summarizeNostrEvent } from '../../utils/nip46Trace.js';
import {
  buildNostrSignerParams,
  buildTracingPool as buildNip46TracingPool,
  emitNostrAuthChallenge,
  instrumentSigner as instrumentNip46Signer,
  resolveSignerPublicKey as resolveNip46SignerPublicKey,
  summarizeSignerArgs,
  summarizeSignerResult,
  waitForNip46RelayCooldown as waitForNip46RelayCooldownRuntime,
  withTimeout,
  zeroNostrConnectKey,
} from './nostrConnectRuntime.mjs';
import {
  connectWithBunkerFlow,
  createNostrConnectSessionDescriptor,
  resetNostrConnectSignerState,
  waitForNostrConnectSessionConnection,
} from './nostrConnectFlow.mjs';
import { createNostrConnectFacadeRuntime } from './nostrConnectFacadeRuntime.mjs';
import { NIP46_SIGNER_PUBLIC_KEY_TIMEOUT_MS } from './nostrConnectTimeouts.mjs';
import {
  activateNsecState,
  buildNsecSigner,
  clearNostrConnectSessionStorage,
  clearPersistedNsec,
  disconnectNostrConnectState,
  loadPersistedNip46Session,
  loadPersistedNsec,
  persistNip46Session,
  persistNsec as persistNsecState,
  reconnectNostrConnectState,
} from './nostrConnectSessionState.mjs';

const NOSTRCONNECT_RELAYS = ['wss://nos.lol'];
const NOSTRCONNECT_PERMS = [
  'get_public_key',
  'ping',
  'sign_event:0',
  'sign_event:1',
  'sign_event:13',
  'sign_event:24242',
  'sign_event:27235',
  'nip04_encrypt',
  'nip44_encrypt',
];
const NIP46_RELAY_COOLDOWN_MS = 500;
const AUTH_CHALLENGE_EVENT = 'nostr-connect-auth-challenge';

function buildSignerTraceOptions(source) {
  return {
    source,
    pushTraceFn: pushNip46Trace,
    summarizeErrorFn: summarizeError,
    summarizeSignerArgsFn: (methodName, args) => summarizeSignerArgs(methodName, args, {
      redactTraceValueFn: redactTraceValue,
      summarizeNostrEventFn: summarizeNostrEvent,
    }),
    summarizeSignerResultFn: (methodName, result) => summarizeSignerResult(methodName, result, {
      redactTraceValueFn: redactTraceValue,
      summarizeNostrEventFn: summarizeNostrEvent,
    }),
  };
}

function buildPersistedSessionHelpers(localStorageObject, signerStatePersistence) {
  const clearSignerStateFn = () => signerStatePersistence?.signerStateClear?.();

  return {
    clearSessionFn: () => clearNostrConnectSessionStorage({
      localStorageObject,
      clearSignerStateFn,
    }),
    clearNsecFn: () => clearPersistedNsec({
      localStorageObject,
      clearSignerStateFn,
    }),
    readSignerStateFn: () => signerStatePersistence?.signerStateGet?.(),
    writeSignerStateFn: (signerState) => signerStatePersistence?.signerStateSet?.(signerState),
  };
}

export async function buildSessionReconnectSigner(session, {
  state = {},
  BunkerSignerCtor = BunkerSigner,
  SimplePoolCtor = SimplePool,
  buildSignerParamsFn,
  instrumentSignerFn = instrumentNip46Signer,
  buildSignerTraceOptionsFn = buildSignerTraceOptions,
  buildTracingPoolFn = buildNip46TracingPool,
  connectTimeoutMs = NIP46_SIGNER_PUBLIC_KEY_TIMEOUT_MS,
  withTimeoutFn = withTimeout,
  summarizeErrorFn = summarizeError,
  pushTraceFn = pushNip46Trace,
  redactTraceValueFn = redactTraceValue,
} = {}) {
  state.clientSecretKey = session.clientSecretKey;

  const signer = instrumentSignerFn(
    BunkerSignerCtor.fromBunker(state.clientSecretKey, session.bunkerPointer, {
      ...buildSignerParamsFn?.(),
      pool: buildTracingPoolFn({
        source: 'session_reconnect',
        SimplePoolCtor,
        pushTraceFn,
        redactTraceValueFn,
      }),
    }),
    buildSignerTraceOptionsFn('session_reconnect'),
  );

  if (!session?.bunkerPointer?.secret || typeof signer?.connect !== 'function') {
    pushTraceFn('session.reconnect.nip46.connect.skipped', {
      bunkerPubkey: redactTraceValueFn(session?.bunkerPointer?.pubkey),
      reason: session?.bunkerPointer?.secret ? 'connect_method_unavailable' : 'missing_bunker_secret',
    });
    return signer;
  }

  pushTraceFn('session.reconnect.nip46.connect.start', {
    bunkerPubkey: redactTraceValueFn(session.bunkerPointer.pubkey),
    relays: session.bunkerPointer.relays || [],
  });

  try {
    await withTimeoutFn(
      Promise.resolve(signer.connect()),
      connectTimeoutMs,
      'Timed out waiting for the signer to restore its bunker session.',
    );
    pushTraceFn('session.reconnect.nip46.connect.success', {
      bunkerPubkey: redactTraceValueFn(session.bunkerPointer.pubkey),
    });
  } catch (error) {
    pushTraceFn('session.reconnect.nip46.connect.error', {
      bunkerPubkey: redactTraceValueFn(session.bunkerPointer.pubkey),
      error: summarizeErrorFn(error),
    }, 'warn');
    throw error;
  }

  return signer;
}

export function createNostrConnectRuntime({
  localStorageObject = globalThis.localStorage,
  signerStatePersistence = globalThis.window?.electronAPI,
  facadeFactory = createNostrConnectFacadeRuntime,
} = {}) {
  const state = {
    signer: null,
    clientSecretKey: null,
    userPubkey: null,
    nsecKey: null,
    loginMode: null,
  };

  function buildSignerParams() {
    return buildNostrSignerParams({
      eventName: AUTH_CHALLENGE_EVENT,
      pushTraceFn: pushNip46Trace,
      emitAuthChallengeFn: emitNostrAuthChallenge,
      warnFn: console.warn,
    });
  }

  async function resolveSignerPublicKey(signer, {
    source,
    knownPubkey = null,
    timeoutMessage,
  } = {}) {
    return resolveNip46SignerPublicKey(signer, {
      source,
      knownPubkey,
      timeoutMessage,
      timeoutMs: NIP46_SIGNER_PUBLIC_KEY_TIMEOUT_MS,
      pushTraceFn: pushNip46Trace,
      redactTraceValueFn: redactTraceValue,
      withTimeoutFn: withTimeout,
    });
  }

  async function persistSession(bunkerPointer, clientSecretKey, userPubkey = null) {
    return persistNip46Session(bunkerPointer, clientSecretKey, userPubkey, {
      ...buildPersistedSessionHelpers(localStorageObject, signerStatePersistence),
      localStorageObject,
      pushTraceFn: pushNip46Trace,
      redactTraceValueFn: redactTraceValue,
    });
  }

  async function loadSession() {
    return loadPersistedNip46Session({
      ...buildPersistedSessionHelpers(localStorageObject, signerStatePersistence),
      localStorageObject,
    });
  }

  const facade = facadeFactory({
    state,
    deps: {
      connectWithBunkerFlowFn: connectWithBunkerFlow,
      parseBunkerInputFn: parseBunkerInput,
      pushTraceFn: pushNip46Trace,
      redactTraceValueFn: redactTraceValue,
      generateSecretKeyFn: generateSecretKey,
      createSignerFromBunkerFn: async (clientSecretKey, bunkerPointer) => {
        const signer = instrumentNip46Signer(BunkerSigner.fromBunker(clientSecretKey, bunkerPointer, {
          ...buildSignerParams(),
          pool: buildNip46TracingPool({
            source: 'bunker_uri',
            SimplePoolCtor: SimplePool,
            pushTraceFn: pushNip46Trace,
            redactTraceValueFn: redactTraceValue,
          }),
        }), buildSignerTraceOptions('bunker_uri'));
        await signer.connect();
        return signer;
      },
      waitForCooldownFn: waitForNip46RelayCooldownRuntime,
      resolveSignerPublicKeyFn: resolveSignerPublicKey,
      persistSessionFn: persistSession,
      nip19EncodeFn: nip19.npubEncode,
      resetSignerStateFn: ({ signer, clientSecretKey }) => (
        resetNostrConnectSignerState({
          signer,
          clientSecretKey,
          zeroKeyFn: zeroNostrConnectKey,
        })
      ),
      reconnectNostrConnectStateFn: reconnectNostrConnectState,
      summarizeErrorFn: summarizeError,
      consoleWarnFn: console.warn,
      createNostrConnectSessionDescriptorFn: createNostrConnectSessionDescriptor,
      waitForNostrConnectSessionConnectionFn: waitForNostrConnectSessionConnection,
      createSignerFromURIFn: async (clientSecretKey, uri, abortSignal) => {
        const signer = await BunkerSigner.fromURI(
          clientSecretKey,
          uri,
          {
            ...buildSignerParams(),
            pool: buildNip46TracingPool({
              source: 'qr_session',
              SimplePoolCtor: SimplePool,
              pushTraceFn: pushNip46Trace,
              redactTraceValueFn: redactTraceValue,
            }),
          },
          abortSignal,
        );
        return instrumentNip46Signer(signer, buildSignerTraceOptions('qr_session'));
      },
      activateNsecStateFn: activateNsecState,
      getPublicKeyFn: getPublicKey,
      disconnectNostrConnectStateFn: disconnectNostrConnectState,
      loadNsecFn: () => loadPersistedNsec({
        ...buildPersistedSessionHelpers(localStorageObject, signerStatePersistence),
        localStorageObject,
      }),
      loadSessionFn: loadSession,
      persistSessionFn: persistSession,
      buildSignerFromSessionFn: (session) => buildSessionReconnectSigner(session, {
        state,
        BunkerSignerCtor: BunkerSigner,
        SimplePoolCtor: SimplePool,
        buildSignerParamsFn: buildSignerParams,
        instrumentSignerFn: instrumentNip46Signer,
        buildSignerTraceOptionsFn: buildSignerTraceOptions,
        buildTracingPoolFn: buildNip46TracingPool,
        pushTraceFn: pushNip46Trace,
        redactTraceValueFn: redactTraceValue,
      }),
      clearSessionFn: buildPersistedSessionHelpers(localStorageObject, signerStatePersistence).clearSessionFn,
      clearNsecFn: buildPersistedSessionHelpers(localStorageObject, signerStatePersistence).clearNsecFn,
      zeroKeyFn: zeroNostrConnectKey,
      bytesToHexFn: bytesToHex,
      createNostrConnectURIFn: createNostrConnectURI,
    },
    constants: {
      signTimeoutMs: NIP46_SIGNER_PUBLIC_KEY_TIMEOUT_MS,
      relayCooldownMs: NIP46_RELAY_COOLDOWN_MS,
      relays: NOSTRCONNECT_RELAYS,
      perms: NOSTRCONNECT_PERMS,
      appName: '/guild',
    },
  });

  function getSigner() {
    if (state.loginMode === 'nsec' && state.nsecKey) {
      return buildNsecSigner(state.nsecKey, {
        finalizeEventFn: finalizeEvent,
        getPublicKeyFn: getPublicKey,
        nip04EncryptFn: nip04Encrypt,
        nip44EncryptFn: nip44Encrypt,
        getNip44ConversationKeyFn: getNip44ConversationKey,
      });
    }
    return state.signer;
  }

  async function persistNsec(nsecInput) {
    let secretKey = nsecInput;
    if (typeof nsecInput === 'string') {
      const decoded = nip19.decode(nsecInput);
      if (decoded.type !== 'nsec') {
        throw new Error('Invalid nsec — expected nsec1... format');
      }
      secretKey = decoded.data;
    }

    return persistNsecState(secretKey, {
      ...buildPersistedSessionHelpers(localStorageObject, signerStatePersistence),
      localStorageObject,
      getPublicKeyFn: getPublicKey,
    });
  }

  async function loadNsec() {
    return loadPersistedNsec({
      ...buildPersistedSessionHelpers(localStorageObject, signerStatePersistence),
      localStorageObject,
    });
  }

  async function activateAndPersistNsec(secretKey) {
    const persisted = await persistNsec(secretKey);
    if (!persisted) {
      throw new Error('Failed to persist signer session');
    }
    facade.activateNsec(secretKey);
  }

  return {
    state,
    getAuthChallengeEventName: () => AUTH_CHALLENGE_EVENT,
    waitForNip46RelayCooldown: (stage, delayMs = NIP46_RELAY_COOLDOWN_MS) => (
      waitForNip46RelayCooldownRuntime({
        stage,
        delayMs,
        pushTraceFn: pushNip46Trace,
      })
    ),
    connectWithBunkerURI: (bunkerInput) => facade.connectWithBunkerURI(bunkerInput),
    reconnect: () => facade.reconnect(),
    getSigner,
    getUserPubkey: () => state.userPubkey,
    getLoginMode: () => state.loginMode,
    isConnected: () => state.userPubkey !== null && (state.signer !== null || state.nsecKey !== null),
    createNostrConnectSession: ({ abortSignal, onConnected } = {}) => facade.createNostrConnectSession({ abortSignal, onConnected }),
    signWithNsec: (secretKey, eventTemplate) => finalizeEvent(eventTemplate, secretKey),
    decodeNsec: (nsecStr) => {
      const decoded = nip19.decode(nsecStr);
      if (decoded.type !== 'nsec') {
        throw new Error('Invalid nsec — expected nsec1... format');
      }
      const secretKey = decoded.data;
      const pubkey = getPublicKey(secretKey);
      const npub = nip19.npubEncode(pubkey);
      return { secretKey, pubkey, npub };
    },
    activateNsec: activateAndPersistNsec,
    persistNsec,
    loadNsec,
    getNsecSigner: (secretKey) => buildNsecSigner(secretKey, {
      finalizeEventFn: finalizeEvent,
      getPublicKeyFn: getPublicKey,
      nip04EncryptFn: nip04Encrypt,
      nip44EncryptFn: nip44Encrypt,
      getNip44ConversationKeyFn: getNip44ConversationKey,
    }),
    disconnect: () => facade.disconnect(),
  };
}

const defaultRuntime = createNostrConnectRuntime();

export const getAuthChallengeEventName = defaultRuntime.getAuthChallengeEventName;
export const waitForNip46RelayCooldown = defaultRuntime.waitForNip46RelayCooldown;
export const connectWithBunkerURI = defaultRuntime.connectWithBunkerURI;
export const reconnect = defaultRuntime.reconnect;
export const getSigner = defaultRuntime.getSigner;
export const getUserPubkey = defaultRuntime.getUserPubkey;
export const getLoginMode = defaultRuntime.getLoginMode;
export const isConnected = defaultRuntime.isConnected;
export const createNostrConnectSession = defaultRuntime.createNostrConnectSession;
export const signWithNsec = defaultRuntime.signWithNsec;
export const decodeNsec = defaultRuntime.decodeNsec;
export const activateNsec = defaultRuntime.activateNsec;
export const persistNsec = defaultRuntime.persistNsec;
export const loadNsec = defaultRuntime.loadNsec;
export const getNsecSigner = defaultRuntime.getNsecSigner;
export const disconnect = defaultRuntime.disconnect;
