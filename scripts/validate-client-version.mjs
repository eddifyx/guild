#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const manifestPath = path.resolve(process.argv[2] || 'server/client-version.json');

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(manifestPath)) {
  fail(`manifest not found: ${manifestPath}`);
}

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
} catch (error) {
  fail(`invalid JSON in ${manifestPath}: ${error.message}`);
}

if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
  fail('manifest must be a JSON object');
}

const semverLike = /^\d+\.\d+\.\d+$/;

function expectString(fieldName, value, { required = true, pattern = null } = {}) {
  if (value == null || value === '') {
    if (required) fail(`${fieldName} is required`);
    return;
  }
  if (typeof value !== 'string') {
    fail(`${fieldName} must be a string`);
  }
  if (pattern && !pattern.test(value)) {
    fail(`${fieldName} has invalid format: ${value}`);
  }
}

function expectStringArray(fieldName, value) {
  if (value == null) return;
  if (!Array.isArray(value)) {
    fail(`${fieldName} must be an array`);
  }
  for (const entry of value) {
    if (typeof entry !== 'string' || !semverLike.test(entry)) {
      fail(`${fieldName} entries must be semver-like strings`);
    }
  }
}

function validatePatchNotes(fieldName, patchNotes) {
  if (patchNotes == null) return;
  if (!patchNotes || typeof patchNotes !== 'object' || Array.isArray(patchNotes)) {
    fail(`${fieldName} must be an object`);
  }

  expectString(`${fieldName}.headline`, patchNotes.headline);
  expectString(`${fieldName}.summary`, patchNotes.summary);

  if (patchNotes.sections != null) {
    if (!Array.isArray(patchNotes.sections)) {
      fail(`${fieldName}.sections must be an array`);
    }
    for (const [index, section] of patchNotes.sections.entries()) {
      if (!section || typeof section !== 'object' || Array.isArray(section)) {
        fail(`${fieldName}.sections[${index}] must be an object`);
      }
      expectString(`${fieldName}.sections[${index}].title`, section.title);
      if (!Array.isArray(section.items)) {
        fail(`${fieldName}.sections[${index}].items must be an array`);
      }
      for (const item of section.items) {
        if (typeof item !== 'string' || !item.trim()) {
          fail(`${fieldName}.sections[${index}].items entries must be non-empty strings`);
        }
      }
    }
  }
}

function validatePlatformOverride(fieldName, override) {
  if (!override || typeof override !== 'object' || Array.isArray(override)) {
    fail(`${fieldName} must be an object`);
  }

  expectString(`${fieldName}.version`, override.version, { required: false, pattern: semverLike });
  expectString(`${fieldName}.url`, override.url, { required: false });
  expectString(`${fieldName}.minimumSupportedVersion`, override.minimumSupportedVersion, {
    required: false,
    pattern: semverLike,
  });
  expectString(`${fieldName}.minimumSupportedMessage`, override.minimumSupportedMessage, {
    required: false,
  });
  expectString(`${fieldName}.blockedMessage`, override.blockedMessage, { required: false });
  expectStringArray(`${fieldName}.blockedVersions`, override.blockedVersions);
  validatePatchNotes(`${fieldName}.patchNotes`, override.patchNotes);
}

expectString('version', manifest.version, { pattern: semverLike });
expectString('releasedAt', manifest.releasedAt);
expectString('minimumSupportedVersion', manifest.minimumSupportedVersion, {
  required: false,
  pattern: semverLike,
});
expectString('minimumSupportedMessage', manifest.minimumSupportedMessage, { required: false });
expectString('blockedMessage', manifest.blockedMessage, { required: false });
expectStringArray('blockedVersions', manifest.blockedVersions);
validatePatchNotes('patchNotes', manifest.patchNotes);

if (manifest.platformOverrides != null) {
  if (!manifest.platformOverrides || typeof manifest.platformOverrides !== 'object' || Array.isArray(manifest.platformOverrides)) {
    fail('platformOverrides must be an object');
  }

  for (const [platform, override] of Object.entries(manifest.platformOverrides)) {
    if (!platform.trim()) {
      fail('platformOverrides keys must be non-empty');
    }
    validatePlatformOverride(`platformOverrides.${platform}`, override);
  }
}

console.log(`client-version manifest validation passed:\n  ${manifestPath}`);
