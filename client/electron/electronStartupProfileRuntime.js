function configureProfilePaths({ app, fs, path, productSlug, profileId }) {
  let profilePartition = `persist:${productSlug}-default`;

  if (!profileId) {
    return profilePartition;
  }

  const defaultUserDataPath = app.getPath('userData');
  const profileUserDataPath = path.join(
    path.dirname(defaultUserDataPath),
    `${path.basename(defaultUserDataPath)}-profile-${profileId}`
  );
  const profileSessionDataPath = path.join(profileUserDataPath, 'session');
  const profileLogsPath = path.join(profileUserDataPath, 'logs');
  const profileCachePath = path.join(profileUserDataPath, 'cache');

  fs.mkdirSync(profileUserDataPath, { recursive: true });
  fs.mkdirSync(profileSessionDataPath, { recursive: true });
  fs.mkdirSync(profileLogsPath, { recursive: true });
  fs.mkdirSync(profileCachePath, { recursive: true });

  app.setPath('userData', profileUserDataPath);
  app.setPath('sessionData', profileSessionDataPath);
  app.setPath('logs', profileLogsPath);
  app.commandLine.appendSwitch('user-data-dir', profileUserDataPath);
  app.commandLine.appendSwitch('disk-cache-dir', profileCachePath);
  profilePartition = `persist:${productSlug}-profile-${profileId}`;

  return profilePartition;
}

module.exports = {
  configureProfilePaths,
};
