const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { VitePlugin } = require('@electron-forge/plugin-vite');

// Native modules that must be copied into the packaged app.
// Vite externalizes these (can't bundle .node addons), and npm workspaces
// hoists them to the monorepo root — so we copy them into the build manually.
const NATIVE_DEPS = ['@signalapp/libsignal-client', 'better-sqlite3'];
const RUNTIME_TRANSITIVE_DEPS = ['node-gyp-build', 'uuid', 'bindings', 'file-uri-to-path'];
const PACKAGED_VENDOR_DEPS = ['@signalapp/libsignal-client', 'node-gyp-build', 'uuid'];
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

function removePathSync(targetPath) {
  fs.rmSync(targetPath, { recursive: true, force: true });
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

function copyRuntimePackagesIntoNodeModules(destinationNodeModules) {
  const rootModules = path.resolve(__dirname, 'node_modules');
  fs.mkdirSync(destinationNodeModules, { recursive: true });

  for (const dep of NATIVE_DEPS) {
    const src = path.join(rootModules, dep);
    const dest = path.join(destinationNodeModules, dep);
    if (fs.existsSync(src)) {
      copyDirSync(src, dest);
    }
  }

  // Runtime transitive deps:
  // libsignal-client needs: node-gyp-build (loads .node) and uuid
  // better-sqlite3 needs: bindings (loads .node), file-uri-to-path
  for (const dep of RUNTIME_TRANSITIVE_DEPS) {
    const src = path.join(rootModules, dep);
    const dest = path.join(destinationNodeModules, dep);
    if (fs.existsSync(src)) {
      copyDirSync(src, dest);
    }
  }
}

function copySelectedPackagesIntoNodeModules(destinationNodeModules, packageNames) {
  const rootModules = path.resolve(__dirname, 'node_modules');
  fs.mkdirSync(destinationNodeModules, { recursive: true });

  for (const dep of packageNames) {
    const src = path.join(rootModules, dep);
    const dest = path.join(destinationNodeModules, dep);
    if (fs.existsSync(src)) {
      removePathSync(dest);
      copyDirSync(src, dest);
    }
  }
}

function copyRuntimeFilesIntoBuild(buildPath) {
  const buildModules = path.join(buildPath, 'node_modules');
  copyRuntimePackagesIntoNodeModules(buildModules);

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

function getRuntimeTarget(platform = process.platform, arch = process.arch) {
  return {
    platform,
    arch,
    libsignalPrebuildDir: `${platform}-${arch}`,
  };
}

function inferArchFromOutputPath(outputPath) {
  for (const candidate of ['arm64', 'x64', 'ia32', 'armv7l']) {
    if (outputPath.includes(candidate)) {
      return candidate;
    }
  }

  return process.arch;
}

function pruneLibsignalClientPackage(packageRoot, target) {
  if (!fs.existsSync(packageRoot)) return;

  const prebuildsDir = path.join(packageRoot, 'prebuilds');
  if (fs.existsSync(prebuildsDir)) {
    for (const entry of fs.readdirSync(prebuildsDir, { withFileTypes: true })) {
      if (entry.name === target.libsignalPrebuildDir) continue;
      removePathSync(path.join(prebuildsDir, entry.name));
    }
  }

  for (const filePath of walkFiles(packageRoot, (fullPath) => (
    fullPath.endsWith('.d.ts') || fullPath.endsWith('.md')
  ))) {
    removePathSync(filePath);
  }
}

function pruneBetterSqlite3Package(packageRoot) {
  if (!fs.existsSync(packageRoot)) return;

  const buildReleaseDir = path.join(packageRoot, 'build', 'Release');
  const preferredBinaryPath = path.join(buildReleaseDir, 'better_sqlite3.node');
  const fallbackBinaryPath = walkFiles(
    path.join(packageRoot, 'bin'),
    (fullPath) => path.basename(fullPath) === 'better-sqlite3.node'
  )[0] || null;
  const nativeBinaryPath = fs.existsSync(preferredBinaryPath) ? preferredBinaryPath : fallbackBinaryPath;
  const nativeBinaryContents = nativeBinaryPath ? fs.readFileSync(nativeBinaryPath) : null;

  for (const relativePath of ['bin', 'build', 'deps', 'src', 'binding.gyp', 'README.md']) {
    removePathSync(path.join(packageRoot, relativePath));
  }

  if (nativeBinaryContents) {
    fs.mkdirSync(buildReleaseDir, { recursive: true });
    fs.writeFileSync(path.join(buildReleaseDir, 'better_sqlite3.node'), nativeBinaryContents);
  }
}

function pruneRuntimeFilesInBuild(buildPath, target = getRuntimeTarget()) {
  const buildModules = path.join(buildPath, 'node_modules');
  pruneLibsignalClientPackage(path.join(buildModules, '@signalapp', 'libsignal-client'), target);
  pruneBetterSqlite3Package(path.join(buildModules, 'better-sqlite3'));
}

function copyRuntimeVendorIntoPackagedApp(outputPath, platform) {
  if (!outputPath) return;

  const appBundlePath = outputPath.endsWith('.app') ? outputPath : path.join(outputPath, `${APP_PACKAGE_NAME}.app`);
  const resourcesDir = platform === 'darwin'
    ? path.join(appBundlePath, 'Contents', 'Resources')
    : path.join(outputPath, 'resources');

  if (!fs.existsSync(resourcesDir)) return;

  const vendorNodeModules = path.join(resourcesDir, 'vendor', 'node_modules');
  const target = getRuntimeTarget(platform || process.platform, inferArchFromOutputPath(outputPath));

  copySelectedPackagesIntoNodeModules(vendorNodeModules, PACKAGED_VENDOR_DEPS);
  pruneLibsignalClientPackage(path.join(vendorNodeModules, '@signalapp', 'libsignal-client'), target);
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
  const appleVoiceHelperDir = path.join(resourcesDir, APPLE_VOICE_HELPER_RELATIVE_DIR, 'bin');

  const nestedCodePaths = [
    ...walkFiles(resourcesDir, (fullPath) => fullPath.endsWith('.node')),
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
    packageAfterPrune: async (_config, buildPath, _electronVersion, platform, arch) => {
      copyRuntimeFilesIntoBuild(buildPath);

      // Rebuild native addons for the target Electron version
      const { rebuild } = require('@electron/rebuild');
      await rebuild({
        buildPath,
        electronVersion: require('./package.json').devDependencies.electron.replace('^', ''),
        force: true,
      });

      pruneRuntimeFilesInBuild(buildPath, getRuntimeTarget(platform || process.platform, arch || process.arch));
    },
    postPackage: async (_config, packageResult) => {
      for (const outputPath of packageResult.outputPaths) {
        copyRuntimeVendorIntoPackagedApp(outputPath, packageResult.platform);
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
          { x: 188, y: 248, type: 'file', path: opts.appPath },
          { x: 512, y: 248, type: 'link', path: '/Applications' },
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
