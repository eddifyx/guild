import { useRef, useState } from 'react';

export function useGuildDashboardControllerState() {
  const [members, setMembers] = useState([]);
  const [myStatus, setMyStatus] = useState('');
  const [statusDraft, setStatusDraft] = useState('');
  const [editingStatus, setEditingStatus] = useState(false);
  const [showExpandedRoster, setShowExpandedRoster] = useState(false);
  const [showOffline, setShowOffline] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [profileCard, setProfileCard] = useState(null);
  const [statusPopover, setStatusPopover] = useState(null);
  const [guildImgFailed, setGuildImgFailed] = useState(false);
  const statusInputRef = useRef(null);

  return {
    members,
    setMembers,
    myStatus,
    setMyStatus,
    statusDraft,
    setStatusDraft,
    editingStatus,
    setEditingStatus,
    showExpandedRoster,
    setShowExpandedRoster,
    showOffline,
    setShowOffline,
    showAbout,
    setShowAbout,
    profileCard,
    setProfileCard,
    statusPopover,
    setStatusPopover,
    guildImgFailed,
    setGuildImgFailed,
    statusInputRef,
  };
}
