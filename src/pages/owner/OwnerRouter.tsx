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

const OwnerRouter: React.FC = () => {
  return (
    <Routes>
      <Route index element={<OwnerDash />} />
      <Route path="pending-approvals" element={<OwnerPendingApprovals />} />
      <Route path="settings" element={<OwnerSettings />} />
      {/* Future routes will go here */}
    </Routes>
  );
};

export default OwnerRouter;
