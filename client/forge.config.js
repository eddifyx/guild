const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { VitePlugin } = require('@electron-forge/plugin-vite');

// Native modules that must be copied into the packaged app.
// Vite externalizes these (can't bundle .node addons), and npm workspaces
// hoists them to the monorepo root — so we copy them into the build manually.
const NATIVE_DEPS = ['@signalapp/libsignal-client', 'better-sqlite3'];
const RUNTIME_SOURCE_DIRS = ['electron/crypto'];
const APPLE_VOICE_HELPER_RELATIVE_DIR = path.join('electron', 'native', 'appleVoiceProcessing');
const APPLE_VOICE_HELPER_SOURCE_NAME = 'AppleVoiceIsolationCapture.swift';
const APPLE_VOICE_HELPER_BINARY_NAME = 'apple-voice-isolation-capture';
const APP_PACKAGE_NAME = 'guild';
const MAC_APP_BUNDLE_ID = process.env.GUILD_MAC_BUNDLE_ID || 'is.1984.guild';
const MAC_HELPER_BUNDLE_ID = `${MAC_APP_BUNDLE_ID}.helper`;

function getMacSignConfig() {
  if (process.platform !== 'darwin') return undefined;
  if (process.env.GUILD_MAC_SIGN !== '1') return undefined;

  return {
    identity: process.env.GUILD_MAC_SIGN_IDENTITY || 'Developer ID Application',
    hardenedRuntime: true,
    gatekeeperAssess: false,
    preAutoEntitlements: true,
  };
}

function getMacNotarizeConfig() {
  if (process.platform !== 'darwin') return undefined;
  if (process.env.GUILD_MAC_SIGN !== '1') return undefined;

  if (process.env.APPLE_KEYCHAIN_PROFILE) {
    return {
      keychainProfile: process.env.APPLE_KEYCHAIN_PROFILE,
      ...(process.env.APPLE_KEYCHAIN ? { keychain: process.env.APPLE_KEYCHAIN } : {}),
    };
  }

  if (process.env.APPLE_API_KEY && process.env.APPLE_API_KEY_ID && process.env.APPLE_API_ISSUER) {
    return {
      appleApiKey: process.env.APPLE_API_KEY,
      appleApiKeyId: process.env.APPLE_API_KEY_ID,
      appleApiIssuer: process.env.APPLE_API_ISSUER,
    };
  }

  if (process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD && process.env.APPLE_TEAM_ID) {
    return {
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID,
    };
  }

  return undefined;
}

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function compileAppleVoiceHelper(sourceDir) {
  const sourcePath = path.join(sourceDir, APPLE_VOICE_HELPER_SOURCE_NAME);
  if (!fs.existsSync(sourcePath) || process.platform !== 'darwin') {
    return;
  }

  const binaryDir = path.join(sourceDir, 'bin');
  const binaryPath = path.join(binaryDir, APPLE_VOICE_HELPER_BINARY_NAME);
  const moduleCachePath = path.join(binaryDir, '.swift-module-cache');
  const tempDir = path.join(binaryDir, '.swift-tmp');
  fs.mkdirSync(binaryDir, { recursive: true });
  fs.mkdirSync(moduleCachePath, { recursive: true });
  fs.mkdirSync(tempDir, { recursive: true });
  execFileSync(
    'swiftc',
    ['-module-cache-path', moduleCachePath, '-O', sourcePath, '-o', binaryPath],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        SWIFT_MODULECACHE_PATH: moduleCachePath,
        TMPDIR: tempDir,
      },
    }
  );
  fs.chmodSync(binaryPath, 0o755);
}

function copyRuntimeFilesIntoBuild(buildPath) {
  const rootModules = path.resolve(__dirname, 'node_modules');
  const buildModules = path.join(buildPath, 'node_modules');
  fs.mkdirSync(buildModules, { recursive: true });

  for (const dep of NATIVE_DEPS) {
    const src = path.join(rootModules, dep);
    const dest = path.join(buildModules, dep);
    if (fs.existsSync(src)) {
      copyDirSync(src, dest);
    }
  }

  // Runtime transitive deps:
  // libsignal-client needs: node-gyp-build (loads .node), uuid, type-fest
  // better-sqlite3 needs: bindings (loads .node), file-uri-to-path
  const transitiveDeps = ['node-gyp-build', 'uuid', 'type-fest', 'bindings', 'file-uri-to-path'];
  for (const dep of transitiveDeps) {
    const src = path.join(rootModules, dep);
    const dest = path.join(buildModules, dep);
    if (fs.existsSync(src)) {
      copyDirSync(src, dest);
    }
  }

  // Keep raw main-process crypto helpers available at runtime.
  // Vite leaves the require() in main.js, so packaged builds need these files copied in.
  for (const relDir of RUNTIME_SOURCE_DIRS) {
    const src = path.join(__dirname, relDir);
    const dest = path.join(buildPath, relDir);
    if (fs.existsSync(src)) {
      copyDirSync(src, dest);
    }
  }

  const appleVoiceHelperBuildDir = path.join(buildPath, APPLE_VOICE_HELPER_RELATIVE_DIR);
  if (fs.existsSync(appleVoiceHelperBuildDir)) {
    compileAppleVoiceHelper(appleVoiceHelperBuildDir);
  }
}

function getPackagedResourcesDir(outputPath, platform) {
  if (platform === 'darwin') {
    const appBundlePath = outputPath.endsWith('.app') ? outputPath : path.join(outputPath, `${APP_PACKAGE_NAME}.app`);
    return path.join(appBundlePath, 'Contents', 'Resources');
  }

  return path.join(outputPath, 'resources');
}

function copyRuntimeFilesIntoPackagedApp(outputPath, platform) {
  const resourcesDir = getPackagedResourcesDir(outputPath, platform);
  const vendorModulesDir = path.join(resourcesDir, 'vendor', 'node_modules');
  fs.mkdirSync(vendorModulesDir, { recursive: true });

  const rootModules = path.resolve(__dirname, 'node_modules');
  const packages = [
    ...NATIVE_DEPS,
    'node-gyp-build',
    'uuid',
    'type-fest',
    'bindings',
    'file-uri-to-path',
  ];

  for (const dep of packages) {
    const src = path.join(rootModules, dep);
    const dest = path.join(vendorModulesDir, dep);
    if (fs.existsSync(src)) {
      copyDirSync(src, dest);
    }
  }
}

function walkFiles(rootDir, predicate, results = []) {
  if (!fs.existsSync(rootDir)) return results;

  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, predicate, results);
      continue;
    }
    if (predicate(fullPath, entry)) {
      results.push(fullPath);
    }
  }

  return results;
}

function signPackagedDarwinApp(outputPath, platform) {
  if (platform !== 'darwin') return;
  if (process.env.GUILD_MAC_SIGN !== '1') return;

  const identity = process.env.GUILD_MAC_SIGN_IDENTITY || 'Developer ID Application';
  const appBundlePath = outputPath.endsWith('.app') ? outputPath : path.join(outputPath, `${APP_PACKAGE_NAME}.app`);
  const resourcesDir = path.join(appBundlePath, 'Contents', 'Resources');
  const vendorModulesDir = path.join(resourcesDir, 'vendor', 'node_modules');
  const appleVoiceHelperDir = path.join(resourcesDir, APPLE_VOICE_HELPER_RELATIVE_DIR, 'bin');

  const nestedCodePaths = [
    ...walkFiles(vendorModulesDir, (fullPath) => fullPath.endsWith('.node')),
    ...walkFiles(appleVoiceHelperDir, (fullPath) => {
      try {
        return (fs.statSync(fullPath).mode & 0o111) !== 0;
      } catch {
        return false;
      }
    }),
  ].sort((a, b) => b.length - a.length);

  for (const nestedPath of nestedCodePaths) {
    execFileSync(
      'codesign',
      ['--force', '--sign', identity, '--timestamp', nestedPath],
      { stdio: 'inherit' }
    );
  }

  execFileSync(
    'codesign',
    [
      '--force',
      '--sign',
      identity,
      '--timestamp',
      '--options',
      'runtime',
      '--preserve-metadata=entitlements,requirements,flags,runtime',
      appBundlePath,
    ],
    { stdio: 'inherit' }
  );

  execFileSync(
    'codesign',
    ['--verify', '--deep', '--strict', appBundlePath],
    { stdio: 'inherit' }
  );
}

module.exports = {
  packagerConfig: {
    name: APP_PACKAGE_NAME,
    executableName: APP_PACKAGE_NAME,
    appBundleId: MAC_APP_BUNDLE_ID,
    helperBundleId: MAC_HELPER_BUNDLE_ID,
    icon: path.join(__dirname, 'assets', 'icon'),  // .ico/.icns auto-resolved per platform
    appCategoryType: 'public.app-category.social-networking',
    extendInfo: {
      // Allow packaged macOS builds to expose Mic Modes such as Voice Isolation
      // while /guild is actively using the microphone.
      NSAlwaysAllowMicrophoneModeControl: true,
    },
    osxSign: getMacSignConfig(),
    osxNotarize: getMacNotarizeConfig(),
    asar: {
      unpack: '**/*.node',  // Native .node files can't load from inside asar
    },
  },
  hooks: {
    packageAfterCopy: async (_config, buildPath) => {
      copyRuntimeFilesIntoBuild(buildPath);
    },
    packageAfterPrune: async (_config, buildPath) => {
      copyRuntimeFilesIntoBuild(buildPath);

      // Rebuild native addons for the target Electron version
      const { rebuild } = require('@electron/rebuild');
      await rebuild({
        buildPath,
        electronVersion: require('./package.json').devDependencies.electron.replace('^', ''),
        force: true,
      });
    },
    postPackage: async (_config, packageResult) => {
      for (const outputPath of packageResult.outputPaths) {
        copyRuntimeFilesIntoPackagedApp(outputPath, packageResult.platform);
        signPackagedDarwinApp(outputPath, packageResult.platform);
      }
    },
  },
  makers: [
    {
      name: '@electron-forge/maker-dmg',
      config: {
        title: 'guild',
        background: path.join(__dirname, 'assets', 'dmg-background.png'),
        icon: path.join(__dirname, 'assets', 'icon.png'),
        format: 'ULFO',
        contents: (opts) => ([
          { x: 214, y: 256, type: 'file', path: opts.appPath },
          { x: 486, y: 256, type: 'link', path: '/Applications' },
        ]),
      },
    },
    { name: '@electron-forge/maker-zip', platforms: ['darwin', 'linux', 'win32'] },
    { name: '@electron-forge/maker-deb', config: {} },
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: 'electron/main.js',
          config: 'vite.main.config.mjs',
          target: 'main',
        },
        {
          entry: 'electron/preload.js',
          config: 'vite.preload.config.mjs',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.mjs',
        },
      ],
    }),
  ],
};
