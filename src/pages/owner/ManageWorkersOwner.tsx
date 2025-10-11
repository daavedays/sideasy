/**
 * Owner Manage Workers Wrapper
 * 
 * Wrapper component that renders the shared ManageWorkers component
 * with owner-level permissions.
 * 
 * Location: src/pages/owner/ManageWorkersOwner.tsx
 */

import React from 'react';
import ManageWorkers from '../common/ManageWorkers';

const ManageWorkersOwner: React.FC = () => {
  return <ManageWorkers backUrl="/owner" userRole="owner" />;
};

export default ManageWorkersOwner;

