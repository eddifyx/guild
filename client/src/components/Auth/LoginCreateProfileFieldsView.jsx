import React from 'react';
import { inputStyle } from './LoginScreenShared.jsx';
import { styles } from './LoginCreateStyles.mjs';

function LoginCreateField({ label, as = 'input', style = null, ...props }) {
  const Component = as;
  return (
    <>
      <label style={styles.fieldLabel}>{label}</label>
      <Component
        {...props}
        className="login-input"
        style={{ ...inputStyle, fontSize: 13, ...(style || {}) }}
        onFocus={(event) => {
          event.target.style.borderColor = 'rgba(64, 255, 64, 0.3)';
        }}
        onBlur={(event) => {
          event.target.style.borderColor = 'rgba(64, 255, 64, 0.07)';
        }}
      />
    </>
  );
}

export function LoginCreateProfileFields({
  createName,
  setCreateName,
  createAbout,
  setCreateAbout,
  createPicture,
  setCreatePicture,
}) {
  return (
    <>
      <LoginCreateField
        label="Display name"
        type="text"
        placeholder="How you want to appear"
        value={createName}
        onChange={(event) => setCreateName(event.target.value)}
        maxLength={50}
      />

      <LoginCreateField
        label="Bio"
        as="textarea"
        placeholder="Tell people who you are"
        value={createAbout}
        onChange={(event) => setCreateAbout(event.target.value)}
        maxLength={250}
        style={styles.textareaInput}
      />

      <LoginCreateField
        label="Profile picture URL"
        type="text"
        placeholder="https://..."
        value={createPicture}
        onChange={(event) => setCreatePicture(event.target.value)}
      />
    </>
  );
}
