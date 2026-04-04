import React, { memo, useMemo } from 'react';

import { getFileUrl } from '../../api';
import { buildGuildSettingsOverviewImageState } from '../../features/guild/guildSettingsPanelsModel.mjs';
import { GuildSettingsOverviewEditView } from './GuildSettingsOverviewEditView.jsx';
import { GuildSettingsOverviewReadOnlyView } from './GuildSettingsOverviewReadOnlyView.jsx';

function GuildSettingsOverviewTab({
  guildName,
  setGuildName,
  guildDesc,
  setGuildDesc,
  guildPublic,
  setGuildPublic,
  guildImage,
  imagePreview,
  onImageSelect,
  onRemoveImage,
  uploadingImage,
  motd,
  setMotd,
  onSaveOverview,
  onSaveMotd,
  canManageTheme,
  canModifyMotd,
  readOnly,
}) {
  const { imgSrc } = useMemo(() => buildGuildSettingsOverviewImageState({
    guildImage,
    imagePreview,
    getFileUrlFn: getFileUrl,
  }), [guildImage, imagePreview]);

  if (readOnly) {
    return (
      <GuildSettingsOverviewReadOnlyView
        guildName={guildName}
        guildDesc={guildDesc}
        guildPublic={guildPublic}
        motd={motd}
        canModifyMotd={canModifyMotd}
        setMotd={setMotd}
        onSaveMotd={onSaveMotd}
        imgSrc={imgSrc}
      />
    );
  }

  return (
    <GuildSettingsOverviewEditView
      guildName={guildName}
      setGuildName={setGuildName}
      guildDesc={guildDesc}
      setGuildDesc={setGuildDesc}
      guildPublic={guildPublic}
      setGuildPublic={setGuildPublic}
      guildImage={guildImage}
      imgSrc={imgSrc}
      onImageSelect={onImageSelect}
      onRemoveImage={onRemoveImage}
      uploadingImage={uploadingImage}
      motd={motd}
      setMotd={setMotd}
      onSaveOverview={onSaveOverview}
      onSaveMotd={onSaveMotd}
      canManageTheme={canManageTheme}
    />
  );
}

export default memo(GuildSettingsOverviewTab);
