/**
 * Admin Router
 * 
 * Handles routing for admin-specific pages.
 * 
 * Location: src/pages/admin/AdminRouter.tsx
 * Purpose: Admin section routing
 */

import React from 'react';
import { Routes, Route } from 'react-router-dom';
import AdminDash from './AdminDash';
import AdminPendingApprovals from './AdminPendingApprovals';
import AdminSettings from './AdminSettings';
import ManageWorkersAdmin from './ManageWorkersAdmin';
import PrimaryTasksDash from '../common/PrimaryTasksDash';
import PrimaryTasksTableView from '../common/PrimaryTasksTableView';
// primaryTaskPage remains available via import when needed for other routes
import AdminSecondaryTasksPage from './secondaryTasksPage';

const AdminRouter: React.FC = () => {
  return (
    <Routes>
      <Route index element={<AdminDash />} />
      <Route path="pending-approvals" element={<AdminPendingApprovals />} />
      <Route path="manage-workers" element={<ManageWorkersAdmin />} />
      <Route path="primary-tasks" element={<PrimaryTasksDash />} />
      <Route path="primary-tasks/table-view" element={<PrimaryTasksTableView />} />
      <Route path="work-schedule" element={<AdminSecondaryTasksPage />} />
      <Route path="settings" element={<AdminSettings />} />
      {/* Future routes will go here:
        - /admin/shifts
        - /admin/work-schedule
        - /admin/weekly-plans
        - /admin/statistics
      */}
    </Routes>
  );
};

export default AdminRouter;
