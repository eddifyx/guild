const crypto = require('crypto');

function encryptAtRest(masterKey, data, aad, { cryptoRef = crypto } = {}) {
  const nonce = cryptoRef.randomBytes(12);
  const cipher = cryptoRef.createCipheriv('aes-256-gcm', masterKey, nonce);
  if (aad) cipher.setAAD(Buffer.from(aad));
  const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([nonce, tag, ciphertext]);
}

function decryptAtRest(masterKey, blob, aad, { cryptoRef = crypto } = {}) {
  const nonce = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const ciphertext = blob.subarray(28);
  const decipher = cryptoRef.createDecipheriv('aes-256-gcm', masterKey, nonce);
  decipher.setAuthTag(tag);
  if (aad) decipher.setAAD(Buffer.from(aad));
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

module.exports = {
  decryptAtRest,
  encryptAtRest,
};
