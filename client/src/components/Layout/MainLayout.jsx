import React, { memo } from 'react';
import Sidebar from './Sidebar';
import VerifyIdentityModal from '../Chat/VerifyIdentityModal';
import { useMainLayoutController } from '../../features/layout/useMainLayoutController.mjs';
import { MainLayoutTitleBar } from './MainLayoutChrome.jsx';
import {
  MainLayoutAlerts,
  MainLayoutContentShell,
  MainLayoutStreamPiPOverlay,
} from './MainLayoutPanels.jsx';
import { MainLayoutContentPane } from './MainLayoutContentPane.jsx';

const MemoSidebar = memo(Sidebar);

export default function MainLayout() {
  const controller = useMainLayoutController();

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      overflow: 'hidden',
    }}>
      <MainLayoutAlerts {...controller.alerts} />
      <MainLayoutTitleBar {...controller.titleBar} />
      <MainLayoutStreamPiPOverlay {...controller.pip} />

      <MainLayoutContentShell
        SidebarComponent={MemoSidebar}
        MainContentComponent={MainLayoutContentPane}
        {...controller.contentShell}
      />
      {controller.verifyIdentityState && (
        <VerifyIdentityModal
          {...controller.verifyIdentityState}
        />
      )}
    </div>
  );
}
