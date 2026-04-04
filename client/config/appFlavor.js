const fs = require('fs');
const path = require('path');

const FLAVORS = {
  production: {
    id: 'production',
    appName: 'guild',
    menuName: 'guild',
    uiName: '/guild',
    executableName: 'guild',
    productSlug: 'guild',
    macBundleId: 'is.1984.guild',
    legacyUpdateSlug: 'Byzantine',
    assetSuffix: null,
  },
  staging: {
    id: 'staging',
    appName: 'guild-staging',
    menuName: 'guild Staging',
    uiName: '/guild Staging',
    executableName: 'guild-staging',
    productSlug: 'guild-staging',
    macBundleId: 'is.1984.guild.staging',
    legacyUpdateSlug: 'Byzantine-staging',
    assetSuffix: 'staging',
  },
};

function normalizeAppFlavor(rawFlavor = process.env.GUILD_APP_FLAVOR || '') {
  const normalized = String(rawFlavor || '').trim().toLowerCase();

  if (normalized === 'staging' || normalized === 'stage') {
    return 'staging';
  }

  return 'production';
}

function getAppFlavor(rawFlavor = process.env.GUILD_APP_FLAVOR) {
  const flavorId = normalizeAppFlavor(rawFlavor);
  const flavor = FLAVORS[flavorId];

  return {
    ...flavor,
    helperBundleId: `${flavor.macBundleId}.helper`,
    packageDirName: flavor.executableName,
    appBundleName: `${flavor.appName}.app`,
  };
}

function resolveFlavorAsset(clientDir, appFlavor, assetStem, extension) {
  const suffix = appFlavor?.assetSuffix;
  const candidates = [];

  if (suffix) {
    candidates.push(path.join(clientDir, 'assets', `${assetStem}-${suffix}${extension}`));
  }
  candidates.push(path.join(clientDir, 'assets', `${assetStem}${extension}`));

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[candidates.length - 1];
}

function resolveFlavorIconBase(clientDir, appFlavor) {
  const suffix = appFlavor?.assetSuffix;
  const candidates = [];

  if (suffix) {
    candidates.push(path.join(clientDir, 'assets', `icon-${suffix}`));
  }
  candidates.push(path.join(clientDir, 'assets', 'icon'));

  for (const candidate of candidates) {
    if (
      fs.existsSync(`${candidate}.icns`)
      || fs.existsSync(`${candidate}.ico`)
      || fs.existsSync(`${candidate}.png`)
    ) {
      return candidate;
    }
  }

  return candidates[candidates.length - 1];
}

module.exports = {
  getAppFlavor,
  normalizeAppFlavor,
  resolveFlavorAsset,
  resolveFlavorIconBase,
};
