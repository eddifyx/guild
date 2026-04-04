const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

test('guild management flow delegates pure owners to dedicated modules', async () => {
  const root = path.resolve(__dirname, '../../../server/src/domain/guild');
  const flowSource = await fs.readFile(path.join(root, 'guildManagementFlow.js'), 'utf8');
  const coreSource = await fs.readFile(path.join(root, 'guildManagementCore.js'), 'utf8');
  const memberSource = await fs.readFile(path.join(root, 'guildManagementMemberPlans.js'), 'utf8');
  const rankSource = await fs.readFile(path.join(root, 'guildManagementRankPlans.js'), 'utf8');

  assert.match(flowSource, /require\('\.\/guildManagementCore'\)/);
  assert.match(flowSource, /require\('\.\/guildManagementMemberPlans'\)/);
  assert.match(flowSource, /require\('\.\/guildManagementRankPlans'\)/);
  assert.doesNotMatch(flowSource, /function buildGuildCreateInput\(/);
  assert.doesNotMatch(flowSource, /function buildMemberPermissionOverrideUpdate\(/);
  assert.doesNotMatch(flowSource, /function buildRankCreateInput\(/);

  assert.match(coreSource, /function buildGuildCreateInput\(/);
  assert.match(coreSource, /function buildGuildUpdateInput\(/);
  assert.match(coreSource, /function buildMotdUpdate\(/);
  assert.match(memberSource, /function buildMemberPermissionOverrideUpdate\(/);
  assert.match(memberSource, /function buildLeadershipTransferPlan\(/);
  assert.match(memberSource, /function buildRankAssignmentPlan\(/);
  assert.match(rankSource, /function buildRankCreateInput\(/);
  assert.match(rankSource, /function buildRankUpdateInput\(/);
  assert.match(rankSource, /function buildRankDeletionPlan\(/);
});
