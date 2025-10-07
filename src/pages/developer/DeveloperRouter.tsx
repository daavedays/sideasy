/**
 * Developer Router
 * 
 * Handles routing for developer-specific pages.
 * 
 * Location: src/pages/developer/DeveloperRouter.tsx
 * Purpose: Developer section routing
 */

import React from 'react';
import { Routes, Route } from 'react-router-dom';
import DevDash from './DevDash';
import PendingApprovals from './PendingApprovals';

const DeveloperRouter: React.FC = () => {
  return (
    <Routes>
      <Route index element={<DevDash />} />
      <Route path="pending-approvals" element={<PendingApprovals />} />
    </Routes>
  );
};

export default DeveloperRouter;

