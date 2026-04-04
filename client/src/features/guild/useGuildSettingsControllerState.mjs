import { useEffect, useRef, useState, useTransition } from 'react';

export function createGuildSettingsInitialLoadingState() {
  return {
    members: false,
    ranks: false,
    invite: false,
    motd: false,
  };
}

export function useGuildSettingsControllerState({
  currentGuildData = null,
} = {}) {
  const [tab, setTab] = useState('Overview');
  const [members, setMembers] = useState(() => currentGuildData?.members || []);
  const [membersLoaded, setMembersLoaded] = useState(() => Array.isArray(currentGuildData?.members));
  const [ranks, setRanks] = useState([]);
  const [ranksLoaded, setRanksLoaded] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [inviteLoaded, setInviteLoaded] = useState(false);
  const [motd, setMotd] = useState('');
  const [motdLoaded, setMotdLoaded] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [isTabPending, startTabTransition] = useTransition();
  const [guildName, setGuildName] = useState(() => currentGuildData?.name || '');
  const [guildDesc, setGuildDesc] = useState(() => currentGuildData?.description || '');
  const [guildPublic, setGuildPublic] = useState(() => currentGuildData?.is_public !== 0);
  const [guildImage, setGuildImage] = useState(() => currentGuildData?.image_url || '');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [editingRank, setEditingRank] = useState(null);
  const [newRankName, setNewRankName] = useState('');
  const [transferTarget, setTransferTarget] = useState('');

  const loadingRef = useRef(createGuildSettingsInitialLoadingState());
  const completedOpenTraceIdsRef = useRef(new Set());

  useEffect(() => () => {
    if (typeof imagePreview === 'string' && imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview);
    }
  }, [imagePreview]);

  return {
    tab,
    setTab,
    members,
    setMembers,
    membersLoaded,
    setMembersLoaded,
    ranks,
    setRanks,
    ranksLoaded,
    setRanksLoaded,
    inviteCode,
    setInviteCode,
    inviteLoaded,
    setInviteLoaded,
    motd,
    setMotd,
    motdLoaded,
    setMotdLoaded,
    error,
    setError,
    success,
    setSuccess,
    confirmDialog,
    setConfirmDialog,
    isTabPending,
    startTabTransition,
    guildName,
    setGuildName,
    guildDesc,
    setGuildDesc,
    guildPublic,
    setGuildPublic,
    guildImage,
    setGuildImage,
    uploadingImage,
    setUploadingImage,
    imagePreview,
    setImagePreview,
    editingRank,
    setEditingRank,
    newRankName,
    setNewRankName,
    transferTarget,
    setTransferTarget,
    loadingRef,
    completedOpenTraceIdsRef,
  };
}
