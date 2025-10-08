/**
 * Admin Pending Approvals Page
 * 
 * Displays pending workers for the admin's department.
 * Admins can ONLY approve/reject workers, not admins or owners.
 * 
 * Location: src/pages/admin/AdminPendingApprovals.tsx
 * Purpose: Worker approval management for admins
 */

import React from 'react';
import PendingApprovalsTable from '../common/PendingApprovalsTable';

const AdminPendingApprovals: React.FC = () => {
  return (
    <PendingApprovalsTable
      allowedRoles={['worker']}
      backUrl="/admin"
      title="ממתינים לאישור"
      description="עובדים הממתינים לאישור עבור המחלקה שלך. ניתן לאשר רק משתמשים שאימתו את האימייל."
      filterByDepartment={true}
      requireEmailVerified={false}
    />
  );
};

export default AdminPendingApprovals;
