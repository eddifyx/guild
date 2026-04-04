import React from 'react';
import { getCreateKeyPrimerToggleLabel } from '../../features/auth/loginCreateModel.mjs';
import { styles } from './LoginCreateStyles.mjs';

export function LoginCreatePrimer({
  showKeyPrimer,
  setShowKeyPrimer,
}) {
  return (
    <>
      <div style={styles.primerCallout}>
        <p style={styles.primerCalloutText}>
          Instead of recovering an account with email, you keep control by saving your private key yourself.
        </p>
      </div>

      <button
        type="button"
        onClick={() => setShowKeyPrimer((value) => !value)}
        style={{ ...styles.primerToggle, marginBottom: showKeyPrimer ? 10 : 16 }}
      >
        {getCreateKeyPrimerToggleLabel(showKeyPrimer)}
      </button>

      {showKeyPrimer && (
        <div style={styles.primerPanel}>
          <div style={styles.primerPanelHeader}>
            <p style={styles.primerPanelTitle}>How This Account Works</p>
          </div>
          <p style={styles.primerLead}>
            This is different from a normal email-and-password account. Nostr uses keys instead, so you stay in control of the account.
          </p>
          <p style={styles.primerParagraph}>
            <strong style={styles.primerSuccess}>Public key (`npub`)</strong>: this is like your shareable account address. People can use it to find you. Sharing it does not let anyone log in as you.
          </p>
          <p style={styles.primerParagraph}>
            <strong style={styles.primerDanger}>Private key (`nsec`)</strong>: this is the secret key to the account. It proves the account is yours. Anyone who gets it can take over the account.
          </p>
          <p style={{ ...styles.primerMutedParagraph, margin: '0 0 8px' }}>
            Why do it this way? Because you stay in control. There is no company holding your password, no platform that can reset the account for you, and no one in the middle deciding whether you can access it.
          </p>
          <p style={{ ...styles.primerMutedParagraph, margin: 0 }}>
            The tradeoff is responsibility. There is no central password reset. If you lose your <code style={styles.primerDanger}>nsec</code>, you lose the account. Save it somewhere safe before continuing.
          </p>
          <div style={styles.primerActions}>
            <button
              type="button"
              onClick={() => setShowKeyPrimer(false)}
              style={styles.primerDismissBtn}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
