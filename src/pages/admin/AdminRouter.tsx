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

const AdminRouter: React.FC = () => {
  return (
    <Routes>
      <Route index element={<AdminDash />} />
      <Route path="pending-approvals" element={<AdminPendingApprovals />} />
      <Route path="settings" element={<AdminSettings />} />
      {/* Future routes will go here:
        - /admin/shifts
        - /admin/work-schedule
        - /admin/weekly-plans
        - /admin/workers
        - /admin/statistics
      */}
    </Routes>
  );
};

export default AdminRouter;
