/**
 * Owner Task Settings Wrapper
 * 
 * Wrapper component that renders the shared OwnerAndAdminSettings component
 * for task management (Secondary + Main Tasks).
 * 
 * Location: src/pages/owner/OwnerTaskSettings.tsx
 */

import React from 'react';
import OwnerAndAdminSettings from '../common/OwnerAndAdminSettings';

const OwnerTaskSettings: React.FC = () => {
  return <OwnerAndAdminSettings backUrl="/owner/settings" />;
};

export default OwnerTaskSettings;

