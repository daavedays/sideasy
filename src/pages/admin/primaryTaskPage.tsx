/**
 * Admin Primary Task Page (Design-Only)
 * 
 * Read-only UI that mirrors the WorkerPreferences table styling.
 * No data fetching or save logic yet – this is a visual scaffold
 * for the upcoming manual/automatic weekly schedule builder.
 * 
 * Location: src/pages/admin/primaryTaskPage.tsx
 * Purpose: Admin weekly schedule UI (design only for now)
 */

import React, { useEffect, useMemo, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import Background from '../../components/layout/Background';
import Header from '../../components/layout/Header';
import HebrewDatePicker from '../../components/ui/HebrewDatePicker';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import SecondaryTaskTable, { SecondaryTask } from '../../components/shared/SecondaryTaskTable';

const PrimaryTaskPage: React.FC = () => {
  // טווח תאריכים (ללא לוגיקה עסקית – רק UI)
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // מחלקה ומשימות (שמות אמיתיים מה-Task Definitions)
  const [departmentId, setDepartmentId] = useState<string>('');
  const [tasks, setTasks] = useState<SecondaryTask[]>([]);

  // משימות מותאמות (לא קיימות בהגדרות) – עיצוב בלבד
  const [customTasks, setCustomTasks] = useState<SecondaryTask[]>([]);
  const [newTaskName, setNewTaskName] = useState<string>('');
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);

  // שלב 1: טעינת מזהה מחלקה של האדמין
  useEffect(() => {
    const fetchDept = async () => {
      if (!auth.currentUser) return;
      try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userDoc.exists()) {
          const u = userDoc.data() as any;
          if (u.departmentId) setDepartmentId(u.departmentId as string);
        }
      } catch (e) {
        console.error('שגיאה בטעינת מחלקה:', e);
      }
    };
    fetchDept();
  }, []);

  // שלב 2: טעינת משימות משניות של המחלקה (שמות אמיתיים)
  useEffect(() => {
    const fetchTasks = async () => {
      if (!departmentId) return;
      try {
        const cfg = await getDoc(doc(db, 'departments', departmentId, 'taskDefinitions', 'config'));
        if (cfg.exists()) {
          const data = cfg.data() as any;
          const defs: any[] = data.secondary_tasks?.definitions || [];
          const mapped: SecondaryTask[] = defs.map((d) => ({
            id: String(d.id),
            name: String(d.name),
            requiresQualification: Boolean(d.requiresQualification),
            autoAssign: Boolean(d.autoAssign),
            assign_weekends: Boolean(d.assign_weekends)
          }));
          setTasks(mapped);
        } else {
          setTasks([]);
        }
      } catch (e) {
        console.error('שגיאה בטעינת משימות:', e);
      }
    };
    fetchTasks();
  }, [departmentId]);

  // כל המשימות לתצוגה (כולל מותאמות)
  const visibleTasks = useMemo(() => [...tasks, ...customTasks], [tasks, customTasks]);
  const allTaskIds = useMemo(() => visibleTasks.map(t => t.id), [visibleTasks]);

  // הוספת משימה מותאמת (UI בלבד)
  const handleAddCustomTask = () => {
    const trimmed = newTaskName.trim();
    if (!trimmed) return;
    const newTask: SecondaryTask = {
      id: `custom-${Math.random().toString(36).slice(2, 9)}`,
      name: trimmed,
      requiresQualification: false,
      autoAssign: false,
      assign_weekends: false
    };
    setCustomTasks(prev => [...prev, newTask]);
    setNewTaskName('');
    setShowAddTaskModal(false);
  };

  return (
    <>
    <div dir="rtl" className="relative flex-1 min-h-screen">
      <Background singleImage="/images/image_1.png" />
      <Header />

      <div className="relative z-10 min-h-screen py-8 pt-24">
        <div className="container mx-auto px-4">
          {/* כותרת עמוד */}
          <div className="mb-8">
            <h1 className="text-4xl md:text-5xl font-bold text-white drop-shadow-lg mb-2">
              סידור עבודה שבועי
            </h1>
            <p className="text-lg md:text-xl text-white/80">
              צור או עדכן סידור עבודה שבועי באופן ידני או אוטומטי
            </p>
          </div>

          {/* בורר טווח תאריכים */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 mb-6 relative z-10">
            <h2 className="text-2xl font-bold text-white mb-4">בחר טווח תאריכים</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <HebrewDatePicker
                label="תאריך התחלה"
                value={startDate}
                onChange={setStartDate}
              />
              <HebrewDatePicker
                label="תאריך סיום"
                value={endDate}
                onChange={setEndDate}
              />
            </div>
          </div>

          {/* כפתורי פעולות */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 mb-6">
            <h3 className="text-xl font-bold text-white mb-4">פעולות</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Button size="md" fullWidth variant="secondary" disabled>
                טען העדפות
              </Button>
              <Button size="md" fullWidth variant="primary" disabled>
                שבץ אוטומטית
              </Button>
              <Button size="md" fullWidth variant="secondary" disabled>
                נקה הכל
              </Button>
              <Button size="md" fullWidth variant="attention" disabled>
                שמור
              </Button>
            </div>
          </div>

          {/* טבלה – מצב קריאה בלבד, ללא אינטראקציה */}
          {startDate && endDate ? (
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 relative z-0">
              <SecondaryTaskTable
                startDate={new Date(startDate)}
                endDate={new Date(endDate)}
                tasks={visibleTasks}
                cellData={new Map()}
                onCellClick={() => {}}
                isReadOnly
                currentWorkerId={undefined}
                currentWorkerQualifications={allTaskIds}
                hideLegend
                showAddRow
                onAddRowClick={() => setShowAddTaskModal(true)}
              />
            </div>
          ) : (
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-12 border border-white/20 text-center">
              <div className="text-6xl mb-4">📅</div>
              <p className="text-white/70 text-lg">
                בחר טווח תאריכים כדי להציג את הטבלה
              </p>
            </div>
          )}
        </div>
      </div>
    </div>

      {/* Add custom task modal */}
      <Modal isOpen={showAddTaskModal} onClose={() => setShowAddTaskModal(false)} title="הוסף משימה חדשה">
        <div className="space-y-4">
          <Input
            label="שם משימה"
            placeholder="לדוגמה: כוננות לילה"
            value={newTaskName}
            onChange={(e) => setNewTaskName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleAddCustomTask();
              }
            }}
          />
          <div className="flex items-center justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowAddTaskModal(false)}>
              ביטול
            </Button>
            <Button onClick={handleAddCustomTask} disabled={!newTaskName.trim()}>
              הוסף
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default PrimaryTaskPage;


