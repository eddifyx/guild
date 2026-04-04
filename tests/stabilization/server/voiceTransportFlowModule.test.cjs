const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

test('voice transport flow delegates support owners to the dedicated support module', async () => {
  const root = path.resolve(__dirname, '../../../server/src/domain/voice');
  const flowSource = await fs.readFile(path.join(root, 'voiceTransportFlow.js'), 'utf8');
  const supportSource = await fs.readFile(path.join(root, 'voiceTransportSupport.js'), 'utf8');
  const handlerFactorySource = await fs.readFile(path.join(root, 'voiceTransportHandlerFactory.js'), 'utf8');

  assert.match(flowSource, /require\('\.\/voiceTransportSupport'\)/);
  assert.match(flowSource, /require\('\.\/voiceTransportHandlerFactory'\)/);
  assert.doesNotMatch(flowSource, /function hasAvailableVoiceWorkers\(/);
  assert.doesNotMatch(flowSource, /function getVoiceSocketError\(/);
  assert.doesNotMatch(flowSource, /function verifyVoiceChannelAccess\(/);
  assert.doesNotMatch(flowSource, /function listExistingRoomProducers\(/);
  assert.doesNotMatch(flowSource, /function buildProducerPayload\(/);
  assert.doesNotMatch(flowSource, /function attachProducerCloseBroadcast\(/);
  assert.doesNotMatch(flowSource, /function createVoiceTransportFlow\(/);

  assert.match(supportSource, /function hasAvailableVoiceWorkers\(/);
  assert.match(supportSource, /function getVoiceSocketError\(/);
  assert.match(supportSource, /function verifyVoiceChannelAccess\(/);
  assert.match(supportSource, /function listExistingRoomProducers\(/);
  assert.match(supportSource, /function buildProducerPayload\(/);
  assert.match(supportSource, /function attachProducerCloseBroadcast\(/);
  assert.match(handlerFactorySource, /function createVoiceTransportFlow\(/);
});
