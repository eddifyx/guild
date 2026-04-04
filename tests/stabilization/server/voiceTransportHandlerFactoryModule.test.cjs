const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

test('voice transport handler factory delegates join, transport, and media owners to dedicated modules', async () => {
  const root = path.resolve(__dirname, '../../../server/src/domain/voice');
  const factorySource = await fs.readFile(path.join(root, 'voiceTransportHandlerFactory.js'), 'utf8');
  const joinSource = await fs.readFile(path.join(root, 'voiceTransportJoinHandler.js'), 'utf8');
  const connectionSource = await fs.readFile(path.join(root, 'voiceTransportConnectionHandlers.js'), 'utf8');
  const mediaSource = await fs.readFile(path.join(root, 'voiceTransportMediaHandlers.js'), 'utf8');

  assert.match(factorySource, /require\('\.\/voiceTransportJoinHandler'\)/);
  assert.match(factorySource, /require\('\.\/voiceTransportConnectionHandlers'\)/);
  assert.match(factorySource, /require\('\.\/voiceTransportMediaHandlers'\)/);
  assert.doesNotMatch(factorySource, /async handleJoin\(/);
  assert.doesNotMatch(factorySource, /async handleCreateTransport\(/);
  assert.doesNotMatch(factorySource, /async handleProduce\(/);

  assert.match(joinSource, /createVoiceJoinHandler/);
  assert.match(connectionSource, /createVoiceTransportConnectionHandlers/);
  assert.match(mediaSource, /createVoiceTransportMediaHandlers/);
});
