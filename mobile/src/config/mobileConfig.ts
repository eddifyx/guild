import Constants from 'expo-constants';

export function getConfiguredApiBaseUrl() {
  const value = Constants.expoConfig?.extra?.apiBaseUrl;
  return typeof value === 'string' ? value.trim() : '';
}

export function getReleaseCommands() {
  return {
    iosBuild: 'npx eas build --platform ios --profile testflight',
    iosSubmit: 'npx eas submit --platform ios --profile testflight',
    androidBuild: 'npx eas build --platform android --profile zapstore',
    androidPublish: 'zsp publish --wizard',
  };
}
