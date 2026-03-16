import process from 'node:process';

import { BunkerSigner, createNostrConnectURI } from '../client/node_modules/nostr-tools/lib/esm/nip46.js';
import { finalizeEvent, generateSecretKey, getPublicKey, verifyEvent } from '../client/node_modules/nostr-tools/lib/esm/pure.js';
import { SimplePool } from '../client/node_modules/nostr-tools/lib/esm/pool.js';
import { encrypt as nip04Encrypt } from '../client/node_modules/nostr-tools/lib/esm/nip04.js';
import { decrypt as nip44Decrypt, encrypt as nip44Encrypt, getConversationKey } from '../client/node_modules/nostr-tools/lib/esm/nip44.js';

const DEFAULT_RELAY = 'wss://nos.lol';
const NOSTR_CONNECT_KIND = 24133;
const SESSION_READY_DELAY_MS = 400;

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function makeEvent(secretKey, pubkey, tags, content) {
  return finalizeEvent({
    kind: NOSTR_CONNECT_KIND,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content,
    pubkey,
  }, secretKey);
}

function withTimeout(promise, timeoutMs, label) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

async function main() {
  const relay = process.argv[2] || DEFAULT_RELAY;
  const clientSecretKey = generateSecretKey();
  const clientPubkey = getPublicKey(clientSecretKey);
  const handshakeSecret = bytesToHex(generateSecretKey());
  const signerSecretKey = generateSecretKey();
  const signerPubkey = getPublicKey(signerSecretKey);
  const conversationKey = getConversationKey(signerSecretKey, clientPubkey);

  const clientPool = new SimplePool({
    onRelayConnectionSuccess(url) {
      console.log('[roundtrip-client] relay connected:', url);
    },
    onRelayConnectionFailure(url) {
      console.warn('[roundtrip-client] relay failed:', url);
    },
  });

  const signerPool = new SimplePool({
    onRelayConnectionSuccess(url) {
      console.log('[roundtrip-signer] relay connected:', url);
    },
    onRelayConnectionFailure(url) {
      console.warn('[roundtrip-signer] relay failed:', url);
    },
  });

  const uri = createNostrConnectURI({
    clientPubkey,
    relays: [relay],
    secret: handshakeSecret,
    perms: [
      'get_public_key',
      'sign_event',
      'sign_event:22242',
      'sign_event:1',
      'sign_event:4',
      'nip04_encrypt',
    ],
    name: '/guild-roundtrip',
  });

  console.log('[roundtrip] uri:', uri);
  console.log('[roundtrip] signer pubkey:', signerPubkey);

  let signerSub;

  async function publishResponse(id, result, error = '') {
    const responsePayload = JSON.stringify({ id, result, error });
    const encrypted = nip44Encrypt(responsePayload, conversationKey);
    const event = makeEvent(signerSecretKey, signerPubkey, [['p', clientPubkey]], encrypted);
    const statuses = await Promise.allSettled(signerPool.publish([relay], event));
    console.log('[roundtrip-signer] response published', {
      id,
      result: typeof result === 'string' ? result.slice(0, 120) : result,
      error,
      statuses: statuses.map((entry) => entry.status),
    });
  }

  async function handleRequest(event) {
    if (event.pubkey !== clientPubkey) return;

    let request;
    try {
      const decrypted = nip44Decrypt(event.content, conversationKey);
      request = JSON.parse(decrypted);
    } catch (error) {
      console.error('[roundtrip-signer] failed to decode request:', error);
      return;
    }

    const { id, method, params = [] } = request;
    console.log('[roundtrip-signer] request', method, params);

    switch (method) {
      case 'switch_relays':
        await publishResponse(id, JSON.stringify([relay]));
        return;
      case 'connect':
        await publishResponse(id, 'ack');
        return;
      case 'ping':
        await publishResponse(id, 'pong');
        return;
      case 'get_public_key':
        await publishResponse(id, signerPubkey);
        return;
      case 'sign_event': {
        const rawEvent = params[0];
        const template = JSON.parse(rawEvent);
        delete template.id;
        delete template.sig;
        const signedEvent = finalizeEvent(template, signerSecretKey);
        if (!verifyEvent(signedEvent)) {
          throw new Error('signed event did not verify');
        }
        await publishResponse(id, JSON.stringify(signedEvent));
        return;
      }
      case 'nip04_encrypt': {
        const [peerPubkey, plaintext] = params;
        const ciphertext = await nip04Encrypt(signerSecretKey, peerPubkey, plaintext);
        await publishResponse(id, ciphertext);
        return;
      }
      default:
        await publishResponse(id, '', `unsupported method: ${method}`);
    }
  }

  signerSub = signerPool.subscribe([relay], {
    kinds: [NOSTR_CONNECT_KIND],
    '#p': [signerPubkey],
    limit: 0,
  }, {
    onevent: handleRequest,
    onclose(reason) {
      console.warn('[roundtrip-signer] subscription closed:', reason);
    },
    maxWait: 60_000,
  });

  setTimeout(async () => {
    const payload = JSON.stringify({ id: handshakeSecret, result: handshakeSecret });
    const encrypted = nip44Encrypt(payload, conversationKey);
    const event = makeEvent(signerSecretKey, signerPubkey, [['p', clientPubkey]], encrypted);
    const statuses = await Promise.allSettled(signerPool.publish([relay], event));
    console.log('[roundtrip-signer] session_ready published', statuses.map((entry) => entry.status));
  }, SESSION_READY_DELAY_MS);

  let remoteSigner;

  try {
    remoteSigner = await withTimeout(
      BunkerSigner.fromURI(clientSecretKey, uri, { pool: clientPool }),
      20_000,
      'fromURI',
    );
    console.log('[roundtrip-client] fromURI resolved');

    await withTimeout(remoteSigner.connect(), 10_000, 'connect');
    console.log('[roundtrip-client] connect resolved');

    const remotePubkey = await withTimeout(remoteSigner.getPublicKey(), 10_000, 'getPublicKey');
    console.log('[roundtrip-client] getPublicKey resolved:', remotePubkey);

    const signedEvent = await withTimeout(remoteSigner.signEvent({
      kind: 22242,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['relay', `${relay}/`],
        ['challenge', 'roundtrip-challenge'],
      ],
      content: '',
      pubkey: remotePubkey,
    }), 10_000, 'signEvent');
    console.log('[roundtrip-client] signEvent resolved:', {
      id: signedEvent.id,
      kind: signedEvent.kind,
      pubkey: signedEvent.pubkey,
    });

    const peerSecretKey = generateSecretKey();
    const peerPubkey = getPublicKey(peerSecretKey);
    const ciphertext = await withTimeout(
      remoteSigner.nip04Encrypt(peerPubkey, 'roundtrip-secret'),
      10_000,
      'nip04Encrypt',
    );
    console.log('[roundtrip-client] nip04Encrypt resolved:', ciphertext.slice(0, 80));

    console.log('[roundtrip] success');
  } finally {
    try {
      await remoteSigner?.close?.();
    } catch {}
    try {
      await signerSub?.close?.('roundtrip complete');
    } catch {}
    clientPool.destroy();
    signerPool.destroy();
  }
}

main().catch((error) => {
  console.error('[roundtrip] fatal:', error);
  process.exit(1);
});
