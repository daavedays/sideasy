/**
 * Worker Router
 * 
 * Handles routing for worker-specific pages.
 * 
 * Location: src/pages/worker/WorkerRouter.tsx
 * Purpose: Worker section routing
 */

import React from 'react';
import { Routes, Route } from 'react-router-dom';
import WorkerDash from './WorkerDash';
import WorkerPreferences from './WorkerPreferences';

const WorkerRouter: React.FC = () => {
  return (
    <Routes>
      <Route index element={<WorkerDash />} />
      <Route path="preferences" element={<WorkerPreferences />} />
      {/* Future routes will go here:
        - /worker/shifts (לוח תורנויות)
        - /worker/weekly-schedule (צפה בתוכנית שבועית)
        - /worker/statistics (סטטיסטיקה)
      */}
    </Routes>
  );
};

export default WorkerRouter;

