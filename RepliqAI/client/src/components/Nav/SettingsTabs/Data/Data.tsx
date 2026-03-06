import React, { useState, useRef } from 'react';
import { useOnClickOutside } from '@librechat/client';
import { Permissions, PermissionTypes } from 'librechat-data-provider';
import ImportConversations from './ImportConversations';
import { AgentApiKeys } from './AgentApiKeys';
import { DeleteCache } from './DeleteCache';
import { RevokeKeys } from './RevokeKeys';
import { ClearChats } from './ClearChats';
import SharedLinks from './SharedLinks';
import { useHasAccess } from '~/hooks';
import useIsAdmin from '~/hooks/useIsAdmin';

function Data() {
  const dataTabRef = useRef(null);
  const [confirmClearConvos, setConfirmClearConvos] = useState(false);
  useOnClickOutside(dataTabRef, () => confirmClearConvos && setConfirmClearConvos(false), []);
  const isAdmin = useIsAdmin();
  const hasAccessToApiKeys = useHasAccess({
    permissionType: PermissionTypes.REMOTE_AGENTS,
    permission: Permissions.USE,
  });

  return (
    <div className="flex flex-col gap-3 p-1 text-sm text-text-primary">
      {isAdmin && (
        <div className="pb-3">
          <ImportConversations />
        </div>
      )}
      <div className="pb-3">
        <SharedLinks />
      </div>
      {isAdmin && hasAccessToApiKeys && (
        <div className="pb-3">
          <AgentApiKeys />
        </div>
      )}
      {isAdmin && (
        <div className="pb-3">
          <RevokeKeys />
        </div>
      )}
      <div className="pb-3">
        <DeleteCache />
      </div>
      {isAdmin && (
        <div className="pb-3">
          <ClearChats />
        </div>
      )}
    </div>
  );
}

export default React.memo(Data);
