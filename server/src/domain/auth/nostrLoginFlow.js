function issueLoginChallenge({ challenges, maxChallenges, ttlMs, randomBytes, now = Date.now() } = {}) {
  if (challenges.size >= maxChallenges) {
    return { ok: false, status: 429, error: 'Too many pending challenges. Try again later.' };
  }

  const challenge = randomBytes(32).toString('hex');
  challenges.set(challenge, { expiresAt: now + ttlMs });
  return { ok: true, challenge };
}

function resolveVerifiedLoginProof({
  body = {},
  verifyNostrEvent,
  isAcceptedLoginProofEvent,
  decryptNip04,
} = {}) {
  const { signedEvent, pubkey, nip04Ciphertext } = body;

  const isEventLogin = signedEvent && typeof signedEvent === 'object';
  const isNip04Login = typeof pubkey === 'string' && typeof nip04Ciphertext === 'string';

  if (!isEventLogin && !isNip04Login) {
    return { ok: false, status: 400, error: 'signedEvent or NIP-04 auth proof is required' };
  }

  if (isEventLogin) {
    if (!verifyNostrEvent(signedEvent)) {
      return { ok: false, status: 401, error: 'Invalid event signature' };
    }

    if (!isAcceptedLoginProofEvent(signedEvent)) {
      return { ok: false, status: 400, error: 'Invalid login proof event' };
    }

    const challengeTag = signedEvent.tags.find((tag) => Array.isArray(tag) && tag[0] === 'challenge');
    if (!challengeTag || typeof challengeTag[1] !== 'string') {
      return { ok: false, status: 400, error: 'Missing challenge tag in event' };
    }

    return {
      ok: true,
      verifiedPubkey: signedEvent.pubkey,
      challenge: challengeTag[1],
      signedEvent,
    };
  }

  const challenge = body.challenge;
  if (typeof challenge !== 'string') {
    return { ok: false, status: 400, error: 'challenge is required for NIP-04 auth proof' };
  }

  try {
    const decryptedChallenge = decryptNip04(nip04Ciphertext, pubkey);
    if (decryptedChallenge !== challenge) {
      return { ok: false, status: 401, error: 'Invalid NIP-04 auth proof' };
    }
  } catch {
    return { ok: false, status: 401, error: 'Invalid NIP-04 auth proof' };
  }

  return {
    ok: true,
    verifiedPubkey: pubkey,
    challenge,
    signedEvent: null,
  };
}

function consumeValidatedLoginChallenge({
  challenges,
  challenge,
  signedEvent = null,
  validateLoginChallenge,
  validateLoginProofTimestamp,
} = {}) {
  const storedChallenge = challenges.get(challenge);
  const challengeValidation = validateLoginChallenge({ storedChallenge });
  if (!challengeValidation.ok) {
    if (storedChallenge && challengeValidation.error === 'Challenge expired') {
      challenges.delete(challenge);
    }
    return challengeValidation;
  }

  challenges.delete(challenge);

  if (signedEvent) {
    const timestampValidation = validateLoginProofTimestamp(signedEvent);
    if (!timestampValidation.ok) {
      return timestampValidation;
    }
  }

  return { ok: true };
}

function resolveOrCreateNostrUser({
  npub,
  displayName,
  lud16,
  profilePicture,
  getUserByNpub,
  createUserWithNpub,
  updateUserLud16,
  updateUserProfilePicture,
  buildNewUserRecord,
  resolveExistingUserProfileUpdates,
  hashColor,
  createId,
} = {}) {
  let user = getUserByNpub.get(npub);

  if (!user) {
    const nextUser = buildNewUserRecord({
      id: createId(),
      npub,
      displayName,
      lud16,
      profilePicture,
      hashColor,
    });

    try {
      createUserWithNpub.run(
        nextUser.id,
        nextUser.username,
        nextUser.avatarColor,
        nextUser.npub,
        nextUser.lud16,
        nextUser.profilePicture
      );
    } catch (insertErr) {
      if (insertErr?.message?.includes('UNIQUE constraint failed')) {
        user = getUserByNpub.get(npub);
        if (!user) {
          throw insertErr;
        }
      } else {
        throw insertErr;
      }
    }

    if (!user) {
      user = {
        id: nextUser.id,
        username: nextUser.username,
        avatar_color: nextUser.avatarColor,
        npub: nextUser.npub,
        lud16: nextUser.lud16,
        profile_picture: nextUser.profilePicture,
      };
    }

    return user;
  }

  const profileUpdates = resolveExistingUserProfileUpdates({
    user,
    lud16,
    profilePicture,
  });
  if (profileUpdates.lud16) {
    updateUserLud16.run(profileUpdates.lud16, user.id);
    user.lud16 = profileUpdates.lud16;
  }
  if (profileUpdates.profilePicture) {
    updateUserProfilePicture.run(profileUpdates.profilePicture, user.id);
    user.profile_picture = profileUpdates.profilePicture;
  }

  return user;
}

function addUserToJoinedGuildRooms({ userId, getUserGuilds, addUserToGuildRooms } = {}) {
  const userGuilds = getUserGuilds.all(userId);
  for (const guild of userGuilds) {
    addUserToGuildRooms(guild.id, userId);
  }
}

function createSessionToken({
  userId,
  createSession,
  hashToken,
  randomBytes,
} = {}) {
  const token = randomBytes(32).toString('hex');
  createSession.run(hashToken(token), userId);
  return token;
}

module.exports = {
  addUserToJoinedGuildRooms,
  consumeValidatedLoginChallenge,
  createSessionToken,
  issueLoginChallenge,
  resolveOrCreateNostrUser,
  resolveVerifiedLoginProof,
};
