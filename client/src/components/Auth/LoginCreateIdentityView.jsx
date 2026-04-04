import React from 'react';
import Avatar from '../Common/Avatar';
import { getCreateImageButtonLabel } from '../../features/auth/loginCreateModel.mjs';
import { styles } from './LoginCreateStyles.mjs';

export function LoginCreateIdentitySection({
  createName,
  createImageFile,
  createImageInputRef,
  createAvatarPreview,
  handleCreateImageChange,
  setCreateImageFile,
}) {
  return (
    <div style={styles.identityRow}>
      <Avatar
        username={createName || 'Nostr'}
        color="#40FF40"
        size={64}
        profilePicture={createAvatarPreview || null}
      />
      <div style={styles.identityMeta}>
        <button
          type="button"
          onClick={() => createImageInputRef.current?.click()}
          style={styles.imageButton}
        >
          {getCreateImageButtonLabel(createImageFile)}
        </button>
        <input
          ref={createImageInputRef}
          type="file"
          accept="image/*"
          onChange={handleCreateImageChange}
          style={{ display: 'none' }}
        />
        {createImageFile && (
          <button
            type="button"
            onClick={() => {
              setCreateImageFile(null);
              if (createImageInputRef.current) {
                createImageInputRef.current.value = '';
              }
            }}
            style={styles.removeImageButton}
          >
            Remove selected file
          </button>
        )}
        <p style={styles.imageHelpText}>
          If you pick a file, /guild uploads it after your new account signs in.
        </p>
      </div>
    </div>
  );
}
