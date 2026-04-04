function attachApiRoutes(app, routes) {
  app.use('/api/dev', routes.devDashboardRoutes);
  app.use('/api/auth', routes.authRoutes);
  app.use('/api/rooms', routes.roomRoutes);
  app.use('/api/messages', routes.messageRoutes);
  app.use('/api/users', routes.userRoutes);
  app.use('/api/upload', routes.uploadRoutes);
  app.use('/api/files', routes.fileRoutes);
  app.use('/api/dm', routes.dmRoutes);
  app.use('/api/voice', routes.voiceRoutes);
  app.use('/api/assets', routes.assetRoutes);
  app.use('/api/addons', routes.addonRoutes);
  app.use('/api/keys', routes.keyRoutes);
  app.use('/api/guilds', routes.guildRoutes);
}

function bindRouteIo(route, io) {
  if (!route) return;
  if (typeof route.setIO === 'function') {
    route.setIO(io);
    return;
  }
  route._io = io;
}

function bindRealtimeProviders({
  io,
  getOnlineUserIds,
  userRoutes,
  roomRoutes,
  voiceRoutes,
  assetRoutes,
  addonRoutes,
  guildRoutes,
}) {
  if (typeof userRoutes?.setOnlineProvider === 'function') {
    userRoutes.setOnlineProvider(getOnlineUserIds);
  }

  bindRouteIo(userRoutes, io);
  bindRouteIo(roomRoutes, io);
  bindRouteIo(voiceRoutes, io);
  bindRouteIo(assetRoutes, io);
  bindRouteIo(addonRoutes, io);
  bindRouteIo(guildRoutes, io);
}

module.exports = {
  attachApiRoutes,
  bindRealtimeProviders,
  bindRouteIo,
};
