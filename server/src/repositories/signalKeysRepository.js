function createSignalKeysRepository({ db }) {
  const upsertIdentityKey = db.prepare(
    `INSERT INTO identity_keys (user_id, identity_key_public, signing_key_public, registration_id, bundle_signature_event)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       identity_key_public = excluded.identity_key_public,
       signing_key_public = excluded.signing_key_public,
       registration_id = excluded.registration_id,
       bundle_signature_event = excluded.bundle_signature_event,
       updated_at = datetime('now')`
  );
  const getIdentityKey = db.prepare('SELECT * FROM identity_keys WHERE user_id = ?');

  const upsertDeviceIdentityKey = db.prepare(
    `INSERT INTO signal_device_identity_keys (
        user_id,
        device_id,
        identity_key_public,
        signing_key_public,
        registration_id,
        bundle_signature_event
      )
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, device_id) DO UPDATE SET
       identity_key_public = excluded.identity_key_public,
       signing_key_public = excluded.signing_key_public,
       registration_id = excluded.registration_id,
       bundle_signature_event = excluded.bundle_signature_event,
       updated_at = datetime('now')`
  );
  const getDeviceIdentityKey = db.prepare(
    'SELECT * FROM signal_device_identity_keys WHERE user_id = ? AND device_id = ?'
  );
  const getUserDeviceIdentityKeys = db.prepare(
    'SELECT * FROM signal_device_identity_keys WHERE user_id = ? ORDER BY updated_at DESC, device_id ASC'
  );

  const upsertSignedPreKey = db.prepare(
    `INSERT INTO signed_prekeys (user_id, key_id, public_key, signature)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, key_id) DO UPDATE SET
       public_key = excluded.public_key,
       signature = excluded.signature,
       created_at = datetime('now')`
  );
  const getLatestSignedPreKey = db.prepare(
    'SELECT * FROM signed_prekeys WHERE user_id = ? ORDER BY key_id DESC LIMIT 1'
  );

  const upsertDeviceSignedPreKey = db.prepare(
    `INSERT INTO signal_device_signed_prekeys (user_id, device_id, key_id, public_key, signature)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, device_id, key_id) DO UPDATE SET
       public_key = excluded.public_key,
       signature = excluded.signature,
       created_at = datetime('now')`
  );
  const getLatestDeviceSignedPreKey = db.prepare(
    'SELECT * FROM signal_device_signed_prekeys WHERE user_id = ? AND device_id = ? ORDER BY key_id DESC LIMIT 1'
  );

  const insertOneTimePreKey = db.prepare(
    'INSERT OR IGNORE INTO one_time_prekeys (user_id, key_id, public_key) VALUES (?, ?, ?)'
  );
  const insertDeviceOneTimePreKey = db.prepare(
    'INSERT OR IGNORE INTO signal_device_one_time_prekeys (user_id, device_id, key_id, public_key) VALUES (?, ?, ?, ?)'
  );
  const getAndClaimOneTimePreKey = db.transaction((userId) => {
    const key = db.prepare(
      'SELECT * FROM one_time_prekeys WHERE user_id = ? AND used = 0 ORDER BY key_id LIMIT 1'
    ).get(userId);
    if (key) {
      db.prepare('UPDATE one_time_prekeys SET used = 1 WHERE user_id = ? AND key_id = ?')
        .run(userId, key.key_id);
    }
    return key || null;
  });
  const countAvailableOTPs = db.prepare(
    'SELECT COUNT(*) as count FROM one_time_prekeys WHERE user_id = ? AND used = 0'
  );
  const getAndClaimDeviceOneTimePreKey = db.transaction((userId, deviceId) => {
    const key = db.prepare(
      'SELECT * FROM signal_device_one_time_prekeys WHERE user_id = ? AND device_id = ? AND used = 0 ORDER BY key_id LIMIT 1'
    ).get(userId, deviceId);
    if (key) {
      db.prepare(
        'UPDATE signal_device_one_time_prekeys SET used = 1 WHERE user_id = ? AND device_id = ? AND key_id = ?'
      ).run(userId, deviceId, key.key_id);
    }
    return key || null;
  });
  const countAvailableDeviceOTPs = db.prepare(
    'SELECT COUNT(*) as count FROM signal_device_one_time_prekeys WHERE user_id = ? AND device_id = ? AND used = 0'
  );

  const insertKyberPreKey = db.prepare(
    'INSERT OR IGNORE INTO kyber_prekeys (user_id, key_id, public_key, signature) VALUES (?, ?, ?, ?)'
  );
  const insertDeviceKyberPreKey = db.prepare(
    'INSERT OR IGNORE INTO signal_device_kyber_prekeys (user_id, device_id, key_id, public_key, signature) VALUES (?, ?, ?, ?, ?)'
  );
  const getAndClaimKyberPreKey = db.transaction((userId) => {
    const key = db.prepare(
      'SELECT * FROM kyber_prekeys WHERE user_id = ? AND used = 0 ORDER BY key_id LIMIT 1'
    ).get(userId);
    if (key) {
      db.prepare('UPDATE kyber_prekeys SET used = 1 WHERE user_id = ? AND key_id = ?')
        .run(userId, key.key_id);
    }
    return key || null;
  });
  const countAvailableKyberPreKeys = db.prepare(
    'SELECT COUNT(*) as count FROM kyber_prekeys WHERE user_id = ? AND used = 0'
  );
  const getAndClaimDeviceKyberPreKey = db.transaction((userId, deviceId) => {
    const key = db.prepare(
      'SELECT * FROM signal_device_kyber_prekeys WHERE user_id = ? AND device_id = ? AND used = 0 ORDER BY key_id LIMIT 1'
    ).get(userId, deviceId);
    if (key) {
      db.prepare(
        'UPDATE signal_device_kyber_prekeys SET used = 1 WHERE user_id = ? AND device_id = ? AND key_id = ?'
      ).run(userId, deviceId, key.key_id);
    }
    return key || null;
  });
  const countAvailableDeviceKyberPreKeys = db.prepare(
    'SELECT COUNT(*) as count FROM signal_device_kyber_prekeys WHERE user_id = ? AND device_id = ? AND used = 0'
  );

  const upsertSenderKeyDistribution = db.prepare(
    `INSERT INTO sender_key_distributions (
        id,
        room_id,
        sender_user_id,
        recipient_user_id,
        distribution_id,
        envelope
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(room_id, sender_user_id, recipient_user_id, distribution_id) DO UPDATE SET
        id = excluded.id,
        envelope = excluded.envelope,
        created_at = datetime('now'),
        delivered_at = NULL`
  );
  const getPendingSenderKeyDistributionsForRecipientInRoom = db.prepare(`
    SELECT skd.id,
           skd.room_id,
           skd.sender_user_id,
           skd.distribution_id,
           skd.envelope,
           skd.created_at,
           u.npub AS sender_npub
    FROM sender_key_distributions skd
    JOIN users u ON u.id = skd.sender_user_id
    WHERE skd.recipient_user_id = ?
      AND skd.room_id = ?
      AND skd.delivered_at IS NULL
    ORDER BY skd.created_at ASC
  `);
  const getRecentSenderKeyDistributionsForRecipientInRoom = db.prepare(`
    SELECT skd.id,
           skd.room_id,
           skd.sender_user_id,
           skd.distribution_id,
           skd.envelope,
           skd.created_at,
           u.npub AS sender_npub
    FROM sender_key_distributions skd
    JOIN users u ON u.id = skd.sender_user_id
    WHERE skd.recipient_user_id = ?
      AND skd.room_id = ?
    ORDER BY skd.created_at DESC
    LIMIT ?
  `);
  const acknowledgeSenderKeyDistribution = db.prepare(
    `UPDATE sender_key_distributions
     SET delivered_at = COALESCE(delivered_at, datetime('now'))
     WHERE id = ? AND recipient_user_id = ? AND room_id = ?`
  );
  const deleteSenderKeyDistributionsForRoom = db.prepare(
    'DELETE FROM sender_key_distributions WHERE room_id = ?'
  );
  const deleteSenderKeyDistributionsForRecipientInRoom = db.prepare(
    'DELETE FROM sender_key_distributions WHERE room_id = ? AND recipient_user_id = ?'
  );
  const acknowledgeSenderKeyDistributions = db.transaction((recipientUserId, roomId, ids) => {
    let acknowledged = 0;
    for (const id of ids) {
      const result = acknowledgeSenderKeyDistribution.run(id, recipientUserId, roomId);
      acknowledged += result.changes || 0;
    }
    return acknowledged;
  });

  const deleteUserIdentityKey = db.prepare('DELETE FROM identity_keys WHERE user_id = ?');
  const deleteUserSignedPreKeys = db.prepare('DELETE FROM signed_prekeys WHERE user_id = ?');
  const deleteUserOneTimePreKeys = db.prepare('DELETE FROM one_time_prekeys WHERE user_id = ?');
  const deleteUserKyberPreKeys = db.prepare('DELETE FROM kyber_prekeys WHERE user_id = ?');
  const deleteUserDeviceIdentityKeys = db.prepare('DELETE FROM signal_device_identity_keys WHERE user_id = ?');
  const deleteUserDeviceSignedPreKeys = db.prepare('DELETE FROM signal_device_signed_prekeys WHERE user_id = ?');
  const deleteUserDeviceOneTimePreKeys = db.prepare('DELETE FROM signal_device_one_time_prekeys WHERE user_id = ?');
  const deleteUserDeviceKyberPreKeys = db.prepare('DELETE FROM signal_device_kyber_prekeys WHERE user_id = ?');
  const resetUserKeys = db.transaction((userId) => {
    deleteUserIdentityKey.run(userId);
    deleteUserSignedPreKeys.run(userId);
    deleteUserOneTimePreKeys.run(userId);
    deleteUserKyberPreKeys.run(userId);
    deleteUserDeviceIdentityKeys.run(userId);
    deleteUserDeviceSignedPreKeys.run(userId);
    deleteUserDeviceOneTimePreKeys.run(userId);
    deleteUserDeviceKyberPreKeys.run(userId);
  });

  return {
    acknowledgeSenderKeyDistributions,
    countAvailableDeviceKyberPreKeys,
    countAvailableDeviceOTPs,
    countAvailableKyberPreKeys,
    countAvailableOTPs,
    deleteSenderKeyDistributionsForRecipientInRoom,
    deleteSenderKeyDistributionsForRoom,
    getAndClaimDeviceKyberPreKey,
    getAndClaimDeviceOneTimePreKey,
    getAndClaimKyberPreKey,
    getAndClaimOneTimePreKey,
    getDeviceIdentityKey,
    getIdentityKey,
    getLatestDeviceSignedPreKey,
    getLatestSignedPreKey,
    getPendingSenderKeyDistributionsForRecipientInRoom,
    getRecentSenderKeyDistributionsForRecipientInRoom,
    getUserDeviceIdentityKeys,
    insertDeviceKyberPreKey,
    insertDeviceOneTimePreKey,
    insertKyberPreKey,
    insertOneTimePreKey,
    resetUserKeys,
    upsertDeviceIdentityKey,
    upsertDeviceSignedPreKey,
    upsertIdentityKey,
    upsertSenderKeyDistribution,
    upsertSignedPreKey,
  };
}

module.exports = {
  createSignalKeysRepository,
};
