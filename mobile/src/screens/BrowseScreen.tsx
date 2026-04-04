import React from 'react';

import { AppWorkspaceScreen } from './AppWorkspaceScreen';
import type { MobileSessionState } from '../features/session/mobileSessionTypes';

export function BrowseScreen({
  session,
}: {
  session: MobileSessionState;
}) {
  return <AppWorkspaceScreen sessionState={session} />;
}
