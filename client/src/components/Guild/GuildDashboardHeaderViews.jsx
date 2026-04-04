import React from 'react';
export function GuildDashboardHeader({
  guildImageUrl = null,
  guildImgFailed = false,
  guildName = 'Guild',
  guildMotd = '',
  guildDescription = '',
  memberCount = 0,
  onlineCount = 0,
  editingStatus = false,
  statusInputRef,
  statusDraft = '',
  setStatusDraft = () => {},
  handleStatusKeyDown = () => {},
  handleStatusSubmit = () => {},
  onStartEditingStatus = () => {},
  statusMaxLength = 128,
  onOpenAbout = () => {},
  onGuildImageError = () => {},
  styles = {},
} = {}) {
  return (
    <div style={styles.headerRow}>
      <div style={styles.headerLeft}>
        <div style={styles.heroGuildIcon}>
          {guildImageUrl && !guildImgFailed ? (
            <img src={guildImageUrl} alt="" style={styles.heroGuildImg} onError={onGuildImageError} />
          ) : (
            <span style={styles.heroGuildInitial}>{guildName[0]?.toUpperCase()}</span>
          )}
        </div>
        <div>
          <h1 style={styles.heroGuildName}>{guildName}</h1>
          <div style={styles.heroMeta}>
            <span>{memberCount} member{memberCount !== 1 ? 's' : ''}</span>
            <span style={styles.heroDivider}>&middot;</span>
            <div style={styles.heroOnline}>
              <div style={styles.pulseDot} />
              <span style={{ color: 'var(--accent)' }}>{onlineCount} online</span>
            </div>
            {guildDescription && (
              <>
                <span style={styles.heroDivider}>&middot;</span>
                <span style={styles.aboutLink} onClick={onOpenAbout}>About</span>
              </>
            )}
          </div>
        </div>
      </div>

      {guildMotd && (
        <div style={styles.headerCenter}>
          <div style={styles.headerMotdLabel}>Message of the Day</div>
          <div style={styles.headerMotdText}>{guildMotd}</div>
        </div>
      )}

      <div style={styles.headerRight}>
        {editingStatus ? (
          <input
            ref={statusInputRef}
            value={statusDraft}
            onChange={(event) => setStatusDraft(event.target.value)}
            onKeyDown={handleStatusKeyDown}
            onBlur={handleStatusSubmit}
            placeholder="What are you up to?"
            maxLength={statusMaxLength}
            style={styles.statusInput}
          />
        ) : (
          <button
            onClick={onStartEditingStatus}
            style={styles.statusDisplay}
            onMouseEnter={(event) => { event.currentTarget.style.borderColor = 'rgba(64, 255, 64, 0.2)'; }}
            onMouseLeave={(event) => { event.currentTarget.style.borderColor = 'var(--border)'; }}
          >
            {statusDraft || 'Set a status...'}
          </button>
        )}
      </div>
    </div>
  );
}

export function GuildDashboardAboutModal({
  showAbout = false,
  guildName = 'Guild',
  guildDescription = '',
  onClose = () => {},
  styles = {},
} = {}) {
  if (!showAbout || !guildDescription) {
    return null;
  }

  return (
    <div style={styles.aboutOverlay} onClick={onClose}>
      <div style={styles.aboutModal} onClick={(event) => event.stopPropagation()}>
        <div style={styles.aboutHeader}>
          <h3 style={styles.aboutTitle}>About {guildName}</h3>
          <button onClick={onClose} style={styles.aboutClose}>&times;</button>
        </div>
        <div style={styles.aboutBody}>{guildDescription}</div>
      </div>
    </div>
  );
}
