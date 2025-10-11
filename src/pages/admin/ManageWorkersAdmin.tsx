/**
 * Admin Manage Workers Wrapper
 * 
 * Wrapper component that renders the shared ManageWorkers component
 * with admin-level permissions (qualifications only).
 * 
 * Location: src/pages/admin/ManageWorkersAdmin.tsx
 */

import React from 'react';
import ManageWorkers from '../common/ManageWorkers';

const ManageWorkersAdmin: React.FC = () => {
  return <ManageWorkers backUrl="/admin" userRole="admin" />;
};

export default ManageWorkersAdmin;

