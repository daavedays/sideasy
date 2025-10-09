/**
 * Owner Settings Wrapper
 * 
 * Wrapper component that renders the shared OwnerAndAdminSettings component.
 * 
 * Location: src/pages/owner/OwnerSettings.tsx
 */

import React from 'react';
import OwnerAndAdminSettings from '../common/OwnerAndAdminSettings';

const OwnerSettings: React.FC = () => {
  return <OwnerAndAdminSettings backUrl="/owner" />;
};

export default OwnerSettings;

