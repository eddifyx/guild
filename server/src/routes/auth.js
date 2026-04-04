const express = require('express');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { secp256k1, schnorr } = require('@noble/curves/secp256k1');
const { bytesToHex } = require('@noble/hashes/utils');
const {
  hashColor,
  getUserByNpub,
  createUserWithNpub,
  updateUserLud16,
  updateUserProfilePicture,
  addUserToGuildRooms,
  getUserGuilds,
  createSession,
  deleteSession,
  hashToken,
} = require('../db');
const { verifyNostrEvent, pubkeyToNpub } = require('../utils/nostrVerify');
const authMiddleware = require('../middleware/authMiddleware');
const { createNostrAuthRuntime } = require('../domain/auth/nostrAuthRuntime');
const {
  buildAuthResponsePayload,
  buildNewUserRecord,
  isAcceptedLoginProofEvent,
  resolveExistingUserProfileUpdates,
  validateLoginChallenge,
  validateLoginProofTimestamp,
} = require('../domain/auth/nostrSession');
const {
  addUserToJoinedGuildRooms,
  consumeValidatedLoginChallenge,
  createSessionToken,
  issueLoginChallenge,
  resolveOrCreateNostrUser,
  resolveVerifiedLoginProof,
} = require('../domain/auth/nostrLoginFlow');

const router = express.Router();
const authRuntime = createNostrAuthRuntime({
  cryptoModule: crypto,
  secp256k1,
  schnorr,
  bytesToHex,
  issueLoginChallenge,
  consumeValidatedLoginChallenge,
});

// Clean up expired challenges every minute
setInterval(() => {
  authRuntime.cleanupExpiredChallenges();
}, authRuntime.cleanupIntervalMs);

// ---------------------------------------------------------------------------
// GET /nostr/challenge â€” Issue a random challenge for login
// ---------------------------------------------------------------------------

router.get('/nostr/challenge', (req, res) => {
  const challengeResult = authRuntime.issueChallenge();
  if (!challengeResult.ok) {
    return res.status(challengeResult.status).json({ error: challengeResult.error });
  }

  res.json({
    challenge: challengeResult.challenge,
    authPubkey: authRuntime.authPubkey,
  });
});

// ---------------------------------------------------------------------------
// POST /nostr â€” Verify signed Nostr event + issue session token
// ---------------------------------------------------------------------------

router.post('/nostr', async (req, res) => {
  try {
    const proofResult = resolveVerifiedLoginProof({
      body: req.body,
      verifyNostrEvent,
      isAcceptedLoginProofEvent,
      decryptNip04: authRuntime.decryptNip04,
    });
    if (!proofResult.ok) {
      return res.status(proofResult.status).json({ error: proofResult.error });
    }

    const challengeResult = authRuntime.consumeValidatedChallenge({
      challenge: proofResult.challenge,
      signedEvent: proofResult.signedEvent,
      validateLoginChallenge,
      validateLoginProofTimestamp,
    });
    if (!challengeResult.ok) {
      return res.status(challengeResult.status).json({ error: challengeResult.error });
    }

    const npub = await pubkeyToNpub(proofResult.verifiedPubkey);
    const user = resolveOrCreateNostrUser({
      npub,
      displayName: req.body.displayName,
      lud16: req.body.lud16,
      profilePicture: req.body.profilePicture,
      getUserByNpub,
      createUserWithNpub,
      updateUserLud16,
      updateUserProfilePicture,
      buildNewUserRecord,
      resolveExistingUserProfileUpdates,
      hashColor,
      createId: uuidv4,
    });

    addUserToJoinedGuildRooms({
      userId: user.id,
      getUserGuilds,
      addUserToGuildRooms,
    });

    const token = createSessionToken({
      userId: user.id,
      createSession,
      hashToken,
      randomBytes: crypto.randomBytes,
    });

    res.json(buildAuthResponsePayload({ user, token }));
  } catch (err) {
    console.error('Nostr login error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// ---------------------------------------------------------------------------
// POST /logout â€” Invalidate session token
// ---------------------------------------------------------------------------

router.post('/logout', authMiddleware, (req, res) => {
  const token = req.headers.authorization.slice(7);
  deleteSession.run(hashToken(token));
  res.json({ success: true });
});

module.exports = router;
