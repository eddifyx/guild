import process from 'node:process';

import { finalizeEvent, generateSecretKey, getPublicKey, verifyEvent } from '../client/node_modules/nostr-tools/lib/esm/pure.js';
import { SimplePool } from '../client/node_modules/nostr-tools/lib/esm/pool.js';
import { encrypt as nip04Encrypt } from '../client/node_modules/nostr-tools/lib/esm/nip04.js';
import { decrypt as nip44Decrypt, encrypt as nip44Encrypt, getConversationKey } from '../client/node_modules/nostr-tools/lib/esm/nip44.js';

const NOSTR_CONNECT_KIND = 24133;
const SESSION_READY_DELAY_MS = 500;

function usage() {
  console.log('Usage: node scripts/mock-nip46-signer.mjs "<nostrconnect://...>"');
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

async function main() {
  const connectionUri = process.argv[2];
  if (!connectionUri || !connectionUri.startsWith('nostrconnect://')) {
    usage();
    process.exit(1);
  }

  const uri = new URL(connectionUri);
  const clientPubkey = uri.host || uri.hostname || uri.pathname.replace(/^\//, '');
  const relays = uri.searchParams.getAll('relay');
  const secret = uri.searchParams.get('secret') || '';

  if (!clientPubkey || relays.length === 0 || !secret) {
    throw new Error('URI is missing client pubkey, relay, or secret.');
  }

  const signerSecretKey = generateSecretKey();
  const signerPubkey = getPublicKey(signerSecretKey);
  const conversationKey = getConversationKey(signerSecretKey, clientPubkey);
  const pool = new SimplePool({
    onRelayConnectionSuccess(url) {
      console.log(`[mock-signer] relay connected: ${url}`);
    },
    onRelayConnectionFailure(url) {
      console.warn(`[mock-signer] relay failed: ${url}`);
    },
  });

  let closed = false;
  let subscription;

  async function publishResponse(id, result, error = '') {
    const responsePayload = JSON.stringify({ id, result, error });
    const encrypted = nip44Encrypt(responsePayload, conversationKey);
    const event = makeEvent(signerSecretKey, signerPubkey, [['p', clientPubkey]], encrypted);
    const results = await Promise.allSettled(pool.publish(relays, event));
    const rejected = results.filter((item) => item.status === 'rejected');
    if (rejected.length === results.length) {
      throw new Error(`All relays rejected response for ${id}`);
    }
    console.log('[mock-signer] response published', {
      id,
      result: typeof result === 'string' ? result.slice(0, 120) : result,
      error,
      statuses: results.map((item) => item.status),
    });
  }

  async function handleRequest(event) {
    if (event.pubkey !== clientPubkey) return;

    let request;
    try {
      const decrypted = nip44Decrypt(event.content, conversationKey);
      request = JSON.parse(decrypted);
    } catch (error) {
      console.error('[mock-signer] failed to decrypt request:', error);
      return;
    }

    const { id, method, params = [] } = request;
    console.log(`[mock-signer] ${method}`, params);

    try {
      switch (method) {
        case 'connect':
          await publishResponse(id, 'ack');
          return;
        case 'ping':
          await publishResponse(id, 'pong');
          return;
        case 'get_public_key':
          await publishResponse(id, signerPubkey);
          return;
        case 'switch_relays':
          await publishResponse(id, JSON.stringify(relays));
          return;
        case 'sign_event': {
          const rawEvent = params[0];
          if (typeof rawEvent !== 'string' || !rawEvent) {
            await publishResponse(id, '', 'missing event json');
            return;
          }
          const template = JSON.parse(rawEvent);
          delete template.id;
          delete template.sig;
          if (!template.pubkey) template.pubkey = signerPubkey;
          const signedEvent = finalizeEvent(template, signerSecretKey);
          if (!verifyEvent(signedEvent)) {
            throw new Error('locally signed event failed verification');
          }
          await publishResponse(id, JSON.stringify(signedEvent));
          return;
        }
        case 'nip04_encrypt': {
          const [thirdPartyPubkey, plaintext] = params;
          if (typeof thirdPartyPubkey !== 'string' || typeof plaintext !== 'string') {
            await publishResponse(id, '', 'invalid nip04 params');
            return;
          }
          const ciphertext = await nip04Encrypt(signerSecretKey, thirdPartyPubkey, plaintext);
          await publishResponse(id, ciphertext);
          return;
        }
        default:
          await publishResponse(id, '', `unsupported method: ${method}`);
      }
    } catch (error) {
      console.error(`[mock-signer] ${method} failed:`, error);
      await publishResponse(id, '', error?.message || String(error));
    }
  }

  async function sendSessionReady() {
    const payload = JSON.stringify({ id: secret, result: secret });
    const encrypted = nip44Encrypt(payload, conversationKey);
    const event = makeEvent(signerSecretKey, signerPubkey, [['p', clientPubkey]], encrypted);
    const results = await Promise.allSettled(pool.publish(relays, event));
    const rejected = results.filter((item) => item.status === 'rejected');
    if (rejected.length === results.length) {
      throw new Error('All relays rejected session_ready');
    }
    console.log('[mock-signer] session_ready sent', {
      statuses: results.map((item) => item.status),
    });
  }

  console.log('[mock-signer] signer pubkey:', signerPubkey);
  console.log('[mock-signer] client pubkey:', clientPubkey);
  console.log('[mock-signer] relays:', relays.join(', '));

  subscription = pool.subscribe(relays, {
    kinds: [NOSTR_CONNECT_KIND],
    '#p': [signerPubkey],
    limit: 0,
  }, {
    onevent: handleRequest,
    onclose(reason) {
      if (!closed) {
        console.warn('[mock-signer] subscription closed:', reason);
      }
    },
    maxWait: 60_000,
  });

  setTimeout(() => {
    sendSessionReady().catch((error) => {
      console.error('[mock-signer] session_ready failed:', error);
    });
  }, SESSION_READY_DELAY_MS);

  const cleanup = async () => {
    if (closed) return;
    closed = true;
    try {
      await subscription?.close?.('mock signer shutdown');
    } catch {}
    pool.destroy();
  };

  process.on('SIGINT', async () => {
    await cleanup();
    process.exit(0);
  });
  process.on('SIGTERM', async () => {
    await cleanup();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('[mock-signer] fatal:', error);
  process.exit(1);
});
