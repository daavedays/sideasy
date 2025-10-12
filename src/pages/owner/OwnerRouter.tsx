/**
 * Owner Router
 * 
 * Handles routing for owner-specific pages.
 * 
 * Location: src/pages/owner/OwnerRouter.tsx
 * Purpose: Owner section routing
 */

import React from 'react';
import { Routes, Route } from 'react-router-dom';
import OwnerDash from './OwnerDash';
import OwnerPendingApprovals from './OwnerPendingApprovals';
import OwnerSettings from './OwnerSettings';
import OwnerTaskSettings from './OwnerTaskSettings';
import ManageWorkersOwner from './ManageWorkersOwner';
import PrimaryTasksDash from '../common/PrimaryTasksDash';
import PrimaryTasksTableView from '../common/PrimaryTasksTableView';

const OwnerRouter: React.FC = () => {
  return (
    <Routes>
      <Route index element={<OwnerDash />} />
      <Route path="pending-approvals" element={<OwnerPendingApprovals />} />
      <Route path="manage-workers" element={<ManageWorkersOwner />} />
      <Route path="primary-tasks" element={<PrimaryTasksDash />} />
      <Route path="primary-tasks/table-view" element={<PrimaryTasksTableView />} />
      <Route path="settings" element={<OwnerSettings />} />
      <Route path="settings/tasks" element={<OwnerTaskSettings />} />
      {/* Future routes will go here */}
    </Routes>
  );
};

export default OwnerRouter;
