import React from 'react';
import { getFileUrl } from '../../api';

export function JoinGuildBrowsePanel({
  availableGuilds,
  joining,
  onJoinPublic,
  styles,
}) {
  return (
    <div style={styles.list}>
      {availableGuilds.length === 0 ? (
        <p style={styles.empty}>No public guilds available to join</p>
      ) : (
        availableGuilds.map((guild) => (
          <div key={guild.id} style={styles.listItem}>
            <div style={styles.listIcon}>
              {guild.image_url ? (
                <img src={getFileUrl(guild.image_url)} alt="" style={styles.listImage} />
              ) : (
                <span style={styles.listInitial}>{guild.name[0]?.toUpperCase()}</span>
              )}
            </div>
            <div style={styles.listInfo}>
              <span style={styles.listName}>{guild.name}</span>
              <span style={styles.listMeta}>
                {guild.memberCount} member{guild.memberCount !== 1 ? 's' : ''}
              </span>
            </div>
            <button
              onClick={() => onJoinPublic(guild.id)}
              disabled={joining}
              style={styles.joinBtn}
            >
              Join
            </button>
          </div>
        ))
      )}
    </div>
  );
}
