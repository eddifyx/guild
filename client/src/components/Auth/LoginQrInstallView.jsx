import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  LOGIN_QR_DEVICE_HINT,
  LOGIN_QR_INSTALL_HINT,
  LOGIN_QR_OPEN_APPROVAL_LABEL,
  LOGIN_QR_SIGNER_LINKS,
} from '../../features/auth/loginQrModel.mjs';
import { buildLoginQrInstallState } from '../../features/auth/loginQrPanelsModel.mjs';

function LoginQrSignerLinkButton({ label, url, openExternalLink }) {
  return (
    <button
      type="button"
      onClick={() => openExternalLink(url)}
      style={{
        background: 'rgba(64, 255, 64, 0.05)',
        border: '1px solid rgba(64, 255, 64, 0.16)',
        borderRadius: 999,
        color: 'rgba(255, 255, 255, 0.8)',
        cursor: 'pointer',
        fontSize: 11,
        padding: '8px 12px',
      }}
    >
      {label}
    </button>
  );
}

export function LoginQrInstallSection({
  connectURI,
  qrStatusMessage,
  openExternalLink,
}) {
  const installState = buildLoginQrInstallState({ connectURI, qrStatusMessage });

  return (
    <>
      {installState.showQrCode && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          <div
            style={{
              background: '#ffffff',
              padding: 12,
              borderRadius: 12,
              display: 'inline-block',
            }}
          >
            <QRCodeSVG
              value={installState.connectURI}
              size={200}
              level="M"
              bgColor="#ffffff"
              fgColor="#000000"
            />
          </div>
        </div>
      )}

      <p
        style={{
          textAlign: 'center',
          color: 'rgba(255, 255, 255, 0.4)',
          fontSize: 11,
          marginBottom: 8,
          letterSpacing: '0.3px',
        }}
      >
        {installState.qrStatusMessage}
      </p>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12,
        }}
      >
        <p
          style={{
            color: 'rgba(255, 255, 255, 0.48)',
            fontSize: 11,
            lineHeight: 1.5,
            margin: 0,
            textAlign: 'center',
          }}
        >
          {LOGIN_QR_INSTALL_HINT}
        </p>

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          {LOGIN_QR_SIGNER_LINKS.map((link) => (
            <LoginQrSignerLinkButton
              key={link.url}
              label={link.label}
              url={link.url}
              openExternalLink={openExternalLink}
            />
          ))}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'flex-start',
          padding: '10px 12px',
          marginBottom: 12,
          borderRadius: 12,
          border: '1px solid rgba(255, 196, 64, 0.16)',
          background: 'rgba(255, 196, 64, 0.06)',
        }}
      >
        <div
          style={{
            flexShrink: 0,
            width: 28,
            height: 28,
            borderRadius: 8,
            background: 'rgba(255, 255, 255, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255, 214, 102, 0.92)',
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          i
        </div>

        <p
          style={{
            color: 'rgba(255, 240, 204, 0.82)',
            fontSize: 11,
            lineHeight: 1.55,
            margin: 0,
            textAlign: 'left',
          }}
        >
          {LOGIN_QR_DEVICE_HINT}
        </p>
      </div>
    </>
  );
}

export function LoginQrApprovalLink({ authChallengeUrl, openExternalLink }) {
  if (!authChallengeUrl) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
      <button
        type="button"
        onClick={() => openExternalLink(authChallengeUrl)}
        style={{
          background: 'none',
          border: '1px solid rgba(64, 255, 64, 0.25)',
          borderRadius: 8,
          color: 'rgba(64, 255, 64, 0.85)',
          cursor: 'pointer',
          fontSize: 12,
          padding: '8px 12px',
        }}
      >
        {LOGIN_QR_OPEN_APPROVAL_LABEL}
      </button>
    </div>
  );
}
