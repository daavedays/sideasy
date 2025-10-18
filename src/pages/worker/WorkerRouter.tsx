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
import PrimaryTasks from './primaryTasks';
import WorkerStatistics from './WorkerStatistics';
import CombinedSchedulePage from '../common/combinedSchedule';

const WorkerRouter: React.FC = () => {
  return (
    <Routes>
      <Route index element={<WorkerDash />} />
      <Route path="preferences" element={<WorkerPreferences />} />
      <Route path="shifts" element={<PrimaryTasks />} />
      <Route path="primarySchedules" element={<PrimaryTasks />} />
      <Route path="workerStatistics" element={<WorkerStatistics />} />
      <Route path="combined-schedule" element={<CombinedSchedulePage />} />
      {/* Future routes will go here:
        - /worker/shifts (לוח תורנויות)
        - /worker/weekly-schedule (צפה בתוכנית שבועית)
        - /worker/statistics (סטטיסטיקה)
      */}
    </Routes>
  );
};

export default WorkerRouter;

