const fs = require('fs');
const path = require('path');

const version = '1.0.73';
const buildNumber = '2';
const versionCode = 2;

function readLocalEnvFile() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) {
    return {};
  }

  const entries = {};
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (key && !process.env[key]) {
      entries[key] = value;
    }
  }

  return entries;
}

const fileEnv = readLocalEnvFile();

function getEnvValue(name, fallback) {
  return process.env[name] || fileEnv[name] || fallback;
}

module.exports = () => {
  const bundleIdentifier = getEnvValue('GUILD_MOBILE_BUNDLE_ID', 'com.guild.mobile');
  const androidPackage = getEnvValue('GUILD_MOBILE_ANDROID_PACKAGE', bundleIdentifier);
  const projectId = getEnvValue('EAS_PROJECT_ID', undefined);
  const owner = getEnvValue('EXPO_OWNER', undefined);

  return {
    expo: {
      name: getEnvValue('GUILD_MOBILE_APP_NAME', '/guild'),
      owner,
      slug: getEnvValue('GUILD_MOBILE_SLUG', 'guild-mobile'),
      version,
      orientation: 'portrait',
      userInterfaceStyle: 'dark',
      scheme: getEnvValue('GUILD_MOBILE_SCHEME', 'guild'),
      icon: './assets/icon.png',
      splash: {
        image: './assets/splash-icon.png',
        resizeMode: 'contain',
        backgroundColor: '#050705'
      },
      assetBundlePatterns: ['**/*'],
      ios: {
        bundleIdentifier,
        buildNumber,
        supportsTablet: false,
        infoPlist: {
          ITSAppUsesNonExemptEncryption: false
        }
      },
      android: {
        package: androidPackage,
        versionCode,
        adaptiveIcon: {
          foregroundImage: './assets/adaptive-icon.png',
          backgroundColor: '#050705'
        },
        edgeToEdgeEnabled: true,
        softwareKeyboardLayoutMode: 'pan'
      },
      extra: {
        apiBaseUrl: getEnvValue('EXPO_PUBLIC_GUILD_API_BASE_URL', ''),
        eas: {
          projectId
        }
      },
      plugins: [
        'expo-secure-store',
        [
          'expo-splash-screen',
          {
            backgroundColor: '#050705',
            image: './assets/splash-icon.png',
            imageWidth: 160
          }
        ]
      ]
    }
  };
};
