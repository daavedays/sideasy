/**
 * Owner Pending Approvals Page
 * 
 * Displays pending admins and workers for the owner's department.
 * Uses shared PendingApprovalsTable component.
 * 
 * Location: src/pages/owner/OwnerPendingApprovals.tsx
 * Purpose: Department-specific user approval management for owner
 */

import React from 'react';
import PendingApprovalsTable from '../common/PendingApprovalsTable';

const OwnerPendingApprovals: React.FC = () => {
  return (
    <PendingApprovalsTable
      allowedRoles={['admin', 'worker']}
      backUrl="/owner"
      title="ממתינים לאישור"
      description="מנהלים ועובדים הממתינים לאישור עבור המחלקה שלך. ניתן לאשר רק משתמשים שאימתו את האימייל."
      filterByDepartment={true}
      requireEmailVerified={false}
    />
  );
};

export default OwnerPendingApprovals;
