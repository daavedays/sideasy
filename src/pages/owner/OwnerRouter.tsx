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

const OwnerRouter: React.FC = () => {
  return (
    <Routes>
      <Route index element={<OwnerDash />} />
      <Route path="pending-approvals" element={<OwnerPendingApprovals />} />
      {/* Future routes will go here */}
    </Routes>
  );
};

export default OwnerRouter;
