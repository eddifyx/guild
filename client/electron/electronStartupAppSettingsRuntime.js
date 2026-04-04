function applyBaseElectronAppSettings({ app, processRef, productSlug, profileId }) {
  if (processRef.env.GUILD_DISABLE_HARDWARE_ACCELERATION === '1') {
    app.disableHardwareAcceleration();
  }
  app.setAppUserModelId(`${productSlug}.${profileId || 'default'}`);
  app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
  app.commandLine.appendSwitch('disable-renderer-backgrounding');
  app.commandLine.appendSwitch('disable-background-timer-throttling');

  const shouldEnforceSingleInstanceLock = !profileId;
  return shouldEnforceSingleInstanceLock
    ? app.requestSingleInstanceLock({ profile: 'default' })
    : true;
}

module.exports = {
  applyBaseElectronAppSettings,
};
