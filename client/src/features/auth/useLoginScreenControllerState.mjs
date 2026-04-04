import { useRef, useState } from 'react';

import { getServerUrl } from '../../api';

export function useLoginScreenControllerState() {
  const abortRef = useRef(null);
  const createImageInputRef = useRef(null);

  const [view, setView] = useState('welcome');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [server, setServer] = useState(getServerUrl());
  const [showServer, setShowServer] = useState(false);
  const [qrSessionNonce, setQrSessionNonce] = useState(0);
  const [authChallengeUrl, setAuthChallengeUrl] = useState('');
  const [qrPhase, setQrPhase] = useState('idle');
  const [qrUriCopyState, setQrUriCopyState] = useState('');
  const [showQrAdvanced, setShowQrAdvanced] = useState(false);
  const [showBunkerInput, setShowBunkerInput] = useState(false);
  const [bunkerInput, setBunkerInput] = useState('');
  const [connectURI, setConnectURI] = useState('');
  const [nsecInput, setNsecInput] = useState('');
  const [generatedAccount, setGeneratedAccount] = useState(null);
  const [createCopyState, setCreateCopyState] = useState('');
  const [showGeneratedNsec, setShowGeneratedNsec] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createAbout, setCreateAbout] = useState('');
  const [createPicture, setCreatePicture] = useState('');
  const [createImageFile, setCreateImageFile] = useState(null);
  const [createImagePreview, setCreateImagePreview] = useState('');
  const [showKeyPrimer, setShowKeyPrimer] = useState(false);

  return {
    abortRef,
    createImageInputRef,
    view,
    setView,
    error,
    setError,
    loading,
    setLoading,
    server,
    setServer,
    showServer,
    setShowServer,
    qrSessionNonce,
    setQrSessionNonce,
    authChallengeUrl,
    setAuthChallengeUrl,
    qrPhase,
    setQrPhase,
    qrUriCopyState,
    setQrUriCopyState,
    showQrAdvanced,
    setShowQrAdvanced,
    showBunkerInput,
    setShowBunkerInput,
    bunkerInput,
    setBunkerInput,
    connectURI,
    setConnectURI,
    nsecInput,
    setNsecInput,
    generatedAccount,
    setGeneratedAccount,
    createCopyState,
    setCreateCopyState,
    showGeneratedNsec,
    setShowGeneratedNsec,
    createName,
    setCreateName,
    createAbout,
    setCreateAbout,
    createPicture,
    setCreatePicture,
    createImageFile,
    setCreateImageFile,
    createImagePreview,
    setCreateImagePreview,
    showKeyPrimer,
    setShowKeyPrimer,
  };
}
