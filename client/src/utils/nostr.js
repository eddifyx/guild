import { SimplePool } from 'nostr-tools/pool';
import { nip19 } from 'nostr-tools';

const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://purplepag.es',
  'wss://relay.primal.net',
];

// Relays that support NIP-50 search
const SEARCH_RELAYS = [
  'wss://relay.nostr.band',
  'wss://search.nos.today',
];

/**
 * Fetch a Nostr profile (kind:0 metadata) from relays.
 * Returns { name, picture, lud16 } or null if not found.
 */
export async function fetchProfile(pkHex) {
  const pool = new SimplePool();
  try {
    const event = await pool.get(DEFAULT_RELAYS, {
      kinds: [0],
      authors: [pkHex],
    });
    if (!event) return null;
    const profile = JSON.parse(event.content);
    return {
      name: profile.display_name || profile.name || null,
      picture: profile.picture || null,
      lud16: profile.lud16 || null,
    };
  } catch {
    return null;
  } finally {
    pool.close(DEFAULT_RELAYS);
  }
}

/**
 * Fetch profiles for multiple pubkeys in batch.
 * Returns a Map of pkHex → { name, picture, about, npub }.
 */
export async function fetchProfiles(pkHexArray) {
  const results = new Map();
  if (!pkHexArray.length) return results;

  const pool = new SimplePool();
  try {
    const BATCH = 100;
    for (let i = 0; i < pkHexArray.length; i += BATCH) {
      const batch = pkHexArray.slice(i, i + BATCH);
      const events = await pool.querySync(DEFAULT_RELAYS, {
        kinds: [0],
        authors: batch,
      });
      for (const event of events) {
        if (results.has(event.pubkey)) continue;
        try {
          const p = JSON.parse(event.content);
          results.set(event.pubkey, {
            name: p.display_name || p.name || null,
            picture: p.picture || null,
            about: p.about || null,
            npub: nip19.npubEncode(event.pubkey),
          });
        } catch { /* skip malformed */ }
      }
    }
  } catch { /* relay errors */ } finally {
    pool.close(DEFAULT_RELAYS);
  }
  return results;
}

/**
 * Parse a raw nostr event into a note item for display.
 */
function parseNoteEvent(e) {
  if (e.kind === 1) {
    const isReply = e.tags.some(t => t[0] === 'e');
    if (isReply) return null;
    return { id: e.id, content: e.content, created_at: e.created_at, kind: 1 };
  } else if (e.kind === 6) {
    let original = null;
    try { original = JSON.parse(e.content); } catch {}
    return {
      id: e.id,
      content: original?.content || '',
      created_at: e.created_at,
      kind: 6,
      repost: original ? {
        pubkey: original.pubkey,
        npub: nip19.npubEncode(original.pubkey),
        created_at: original.created_at,
      } : null,
    };
  }
  return null;
}

/**
 * Fetch recent posts and reposts for a given pubkey.
 * Uses raw WebSocket for reliability in Electron.
 * Calls onUpdate with partial results as they stream in.
 * onDebug receives status strings for visible diagnostics.
 *
 * Each item: { id, content, created_at, kind, repost? }
 */
export async function fetchNotes(pkHex, limit = 40, onUpdate, onDebug) {
  const debug = (msg) => { if (onDebug) onDebug(msg); };
  const seen = new Set();
  const items = [];

  debug(`Fetching notes for ${pkHex.slice(0, 8)}...`);

  // Query each relay via raw WebSocket for maximum reliability
  const promises = DEFAULT_RELAYS.map(url => new Promise((resolve) => {
    const relayName = url.split('//')[1];
    try {
      const ws = new WebSocket(url);
      const timer = setTimeout(() => {
        debug(`${relayName}: timeout`);
        ws.close();
        resolve();
      }, 8000);

      ws.onopen = () => {
        const req = JSON.stringify(['REQ', 'notes1', { kinds: [1, 6], authors: [pkHex], limit }]);
        ws.send(req);
      };

      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);
          if (data[0] === 'EVENT' && data[2]) {
            const ev = data[2];
            if (!seen.has(ev.id)) {
              seen.add(ev.id);
              const item = parseNoteEvent(ev);
              if (item) {
                items.push(item);
                if (onUpdate) {
                  onUpdate([...items].sort((a, b) => b.created_at - a.created_at));
                }
              }
            }
          } else if (data[0] === 'EOSE') {
            debug(`${relayName}: ${items.length} notes`);
            clearTimeout(timer);
            ws.close();
            resolve();
          }
        } catch {}
      };

      ws.onerror = () => {
        debug(`${relayName}: error`);
        clearTimeout(timer);
        resolve();
      };
    } catch {
      debug(`${relayName}: failed`);
      resolve();
    }
  }));

  await Promise.all(promises);
  items.sort((a, b) => b.created_at - a.created_at);
  debug(`Done: ${items.length} total notes`);
  return items;
}

/**
 * Search for Nostr profiles by name.
 * Uses Primal cache API (reliable), falls back to WebSocket NIP-50.
 * Returns an array of { npub, name, picture, about }.
 */
export async function searchProfiles(query, limit = 20) {
  if (!query || query.trim().length < 2) return [];

  // Method 1: Primal cache API (fast and reliable)
  try {
    const res = await fetch('https://primal.net/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(['user_search', { query: query.trim(), limit }]),
    });
    if (res.ok) {
      const events = await res.json();
      return events
        .filter(e => e.kind === 0 && e.pubkey)
        .map(e => {
          let meta = {};
          try { meta = JSON.parse(e.content || '{}'); } catch {}
          return {
            npub: nip19.npubEncode(e.pubkey),
            name: meta.display_name || meta.name || null,
            picture: meta.picture || null,
            about: (meta.about || '').slice(0, 120),
          };
        })
        .filter(p => p.name);
    }
  } catch {}

  // Method 2: WebSocket NIP-50 search as fallback
  const seen = new Set();
  const results = [];

  const promises = SEARCH_RELAYS.map(url => new Promise((resolve) => {
    try {
      const ws = new WebSocket(url);
      const timer = setTimeout(() => { ws.close(); resolve(); }, 8000);

      ws.onopen = () => {
        ws.send(JSON.stringify(['REQ', 'search1', {
          kinds: [0],
          search: query.trim(),
          limit,
        }]));
      };

      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);
          if (data[0] === 'EVENT' && data[2]) {
            const ev = data[2];
            if (!seen.has(ev.pubkey)) {
              seen.add(ev.pubkey);
              try {
                const p = JSON.parse(ev.content);
                results.push({
                  npub: nip19.npubEncode(ev.pubkey),
                  name: p.display_name || p.name || null,
                  picture: p.picture || null,
                  about: (p.about || '').slice(0, 120),
                });
              } catch {}
            }
          } else if (data[0] === 'EOSE') {
            clearTimeout(timer);
            ws.close();
            resolve();
          }
        } catch {}
      };

      ws.onerror = () => { clearTimeout(timer); resolve(); };
    } catch { resolve(); }
  }));

  await Promise.all(promises);
  return results;
}
