/**
 * Admin Settings Wrapper
 * 
 * Wrapper component that renders the shared OwnerAndAdminSettings component.
 * 
 * Location: src/pages/admin/AdminSettings.tsx
 */

import React from 'react';
import OwnerAndAdminSettings from '../common/OwnerAndAdminSettings';

const AdminSettings: React.FC = () => {
  return <OwnerAndAdminSettings backUrl="/admin" />;
};

export default AdminSettings;

