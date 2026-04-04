import React, { useState, useEffect, useRef } from 'react';
import { nip19 } from 'nostr-tools';

import { fetchCurrentProfile, publishProfile, uploadImage } from '../../nostr/profilePublisher';
import { useAuth } from '../../contexts/AuthContext';
import {
  ProfileSettingsForm,
  ProfileSettingsHeader,
  ProfileSettingsIntro,
  ProfileSettingsLoadingState,
  ProfileSettingsStatusMessage,
} from './ProfileSettingsModalPanels.jsx';
import { styles } from './ProfileSettingsModalStyles.mjs';

const PROFILE_SYNC_TIMEOUT_MS = 10000;

function withTimeout(promise, timeoutMs, message) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

export default function ProfileSettingsModal({ onClose, onSaved }) {
  const { user, syncNostrProfile } = useAuth();
  const [name, setName] = useState(user?.username || '');
  const [about, setAbout] = useState('');
  const [picture, setPicture] = useState(user?.profilePicture || '');
  const [banner, setBanner] = useState('');
  const [lud16, setLud16] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileRef = useRef();

  useEffect(() => {
    let fallbackPk = null;
    try {
      if (user?.npub) {
        fallbackPk = nip19.decode(user.npub).data;
      }
    } catch {}

    fetchCurrentProfile(fallbackPk)
      .then((profile) => {
        if (!profile) {
          return;
        }
        setName(profile.name || '');
        setAbout(profile.about || '');
        setPicture(profile.picture || '');
        setBanner(profile.banner || '');
        setLud16(profile.lud16 || '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handler = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be under 10MB');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const url = await uploadImage(file);
      setPicture(url);
    } catch (err) {
      setError(`Image upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handlePublish = async () => {
    const nextProfile = {
      name: (name || '').trim().slice(0, 50),
      about: (about || '').trim().slice(0, 250),
      picture: (picture || '').trim(),
      banner: (banner || '').trim(),
      lud16: (lud16 || '').trim(),
    };

    if (nextProfile.picture && !/^https?:\/\//i.test(nextProfile.picture)) {
      setError('Profile picture must be an http(s) URL');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const result = await publishProfile(nextProfile);

      if (result.ok) {
        let syncError = null;
        let syncedUser = null;

        try {
          const syncResult = await withTimeout(
            syncNostrProfile(nextProfile),
            PROFILE_SYNC_TIMEOUT_MS,
            'Timed out syncing the published profile back into /guild'
          );
          syncedUser = syncResult?.syncedUser || null;
        } catch (err) {
          syncError = err;
        }

        const savedProfile = {
          name: nextProfile.name || syncedUser?.username || user?.username || '',
          about: nextProfile.about,
          picture: syncedUser?.profilePicture ?? (nextProfile.picture || null),
          banner: nextProfile.banner,
          lud16: syncedUser?.lud16 ?? (nextProfile.lud16 || null),
        };

        if (onSaved) {
          onSaved(savedProfile);
        }

        setSuccess(
          syncError
            ? `Profile published to Nostr relays, but /guild sync failed: ${syncError.message}`
            : 'Profile published to Nostr relays'
        );
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(result.error || 'Publish failed');
      }
    } catch (err) {
      setError(err?.message || 'Publish failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose} style={styles.overlay}>
      <div onClick={(event) => event.stopPropagation()} style={styles.modal}>
        <ProfileSettingsHeader onClose={onClose} styles={styles} />
        <ProfileSettingsIntro styles={styles} />

        {error && (
          <ProfileSettingsStatusMessage tone="error" styles={styles}>
            {error}
          </ProfileSettingsStatusMessage>
        )}
        {success && (
          <ProfileSettingsStatusMessage tone="success" styles={styles}>
            {success}
          </ProfileSettingsStatusMessage>
        )}

        {loading ? (
          <ProfileSettingsLoadingState />
        ) : (
          <ProfileSettingsForm
            user={user}
            name={name}
            setName={setName}
            about={about}
            setAbout={setAbout}
            picture={picture}
            setPicture={setPicture}
            banner={banner}
            setBanner={setBanner}
            lud16={lud16}
            setLud16={setLud16}
            fileRef={fileRef}
            uploading={uploading}
            saving={saving}
            onClose={onClose}
            onImageUpload={handleImageUpload}
            onPublish={handlePublish}
            styles={styles}
          />
        )}
      </div>
    </div>
  );
}
