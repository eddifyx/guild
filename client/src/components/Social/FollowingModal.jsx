import React from 'react';
import { useSocket } from '../../contexts/SocketContext';
import { useFollowingModalController } from '../../features/social/useFollowingModalController.mjs';
import { styles } from './FollowingModalStyles.mjs';
import {
  FollowingModalFriendsPanel,
  FollowingModalHeader,
  FollowingModalRequestsPanel,
  FollowingModalSearchPanel,
  FollowingModalTabs,
} from './FollowingModalPanels.jsx';

export default function FollowingModal({ onClose }) {
  const { socket } = useSocket();
  const controller = useFollowingModalController({ onClose, socket });

  return (
    <div onClick={onClose} style={styles.overlay}>
      <div onClick={(event) => event.stopPropagation()} style={styles.modal}>
        <FollowingModalHeader onClose={onClose} />
        <FollowingModalTabs tabs={controller.tabs} onChangeTab={controller.setTab} />

        <div style={styles.content}>
          {controller.tab === 'search' ? (
            <FollowingModalSearchPanel
              query={controller.query}
              searchMsg={controller.searchMsg}
              searchMessageTone={controller.searchMessageTone}
              searchRows={controller.searchRows}
              searchViewState={controller.searchViewState}
              getResultActionState={controller.getResultActionState}
              onSearchChange={controller.onSearchChange}
              onSendRequest={controller.onSendRequest}
              onToggleInviteMenu={controller.onToggleInviteMenu}
              onSendNostrDM={controller.onSendNostrDM}
              onCopyInvite={controller.onCopyInvite}
            />
          ) : null}

          {controller.tab === 'requests' ? (
            <FollowingModalRequestsPanel
              loadingRequests={controller.loadingRequests}
              incomingRows={controller.incomingRows}
              actioningId={controller.actioningId}
              onAcceptRequest={controller.onAcceptRequest}
              onRejectRequest={controller.onRejectRequest}
            />
          ) : null}

          {controller.tab === 'friends' ? (
            <FollowingModalFriendsPanel
              loadingFriends={controller.loadingFriends}
              friendRows={controller.friendRows}
              copied={controller.copied}
              onToggleSelectedFriend={controller.onToggleSelectedFriend}
              onCopyNpub={controller.onCopyNpub}
              onOpenPrimal={controller.onOpenPrimal}
              onRemoveFriend={controller.onRemoveFriend}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
