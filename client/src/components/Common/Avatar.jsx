import React, { useEffect, useState } from 'react';

export default function Avatar({ username, color, size = 36, profilePicture }) {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [profilePicture]);

  const initials = username
    ? username.slice(0, 2).toUpperCase()
    : '??';

  const showImage = profilePicture && !imgFailed;

  if (showImage) {
    return (
      <img
        src={profilePicture}
        alt={username || ''}
        style={{
          width: size,
          height: size,
          minWidth: size,
          borderRadius: '50%',
          objectFit: 'cover',
        }}
        onError={() => setImgFailed(true)}
      />
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: '50%',
        background: 'var(--accent)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.36,
        fontWeight: 600,
        color: '#fff',
        userSelect: 'none',
        letterSpacing: '-0.3px',
      }}
    >
      {initials}
    </div>
  );
}
