/**
 * Developer Pending Approvals Page
 * 
 * Displays all pending users (owners, admins, workers) and allows developer to approve/reject them.
 * Uses shared PendingApprovalsTable component.
 * 
 * Location: src/pages/developer/PendingApprovals.tsx
 * Purpose: User approval management for developer
 */

import React from 'react';
import PendingApprovalsTable from '../common/PendingApprovalsTable';

const PendingApprovals: React.FC = () => {
  return (
    <PendingApprovalsTable
      allowedRoles={['owner', 'admin', 'worker']}
      backUrl="/developer"
      title="ממתינים לאישור"
      description="משתמשים שאימתו את האימייל וניסו להתחבר - ממתינים לאישורך"
      filterByDepartment={false}
      requireEmailVerified={true}
    />
  );
};

export default PendingApprovals;

