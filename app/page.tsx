'use client';

import React, { useState, useEffect, useRef} from 'react';
import Image from 'next/image';
import { CalendarIcon } from "@radix-ui/react-icons";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { 
 Play, Pause, Square, Clock, Folder, 
 List, Plus, Hourglass, 
 CheckCircle, LayoutGrid, Settings2, ChevronDown,
 FileText, Check, Trash2, Github, Sun, Moon, Download, LogOut, HardDrive
} from 'lucide-react';
import { auth, db, googleProvider, isFirebaseConfigured } from '../firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy } from 'firebase/firestore';

type Project = {
 id: string;
 name: string;
 colorClass: string;
 createdAt?: string;
 uid?: string;
};

type TimeEntry = {
 id: string;
 task: string;
 projectId: string;
 startTime: string;
 endTime: string;
 durationSeconds: number;
 uid?: string;
};

type LocalTrackerState = {
 entries: TimeEntry[];
 projects: Project[];
 activeProjectId: string;
 activeTask: string;
 isRunning: boolean;
 isPaused: boolean;
 startTime: string;
 endTime: string;
 elapsedSeconds: number;
 viewMode: 'all' | 'project';
};

const COLORS = [
 'bg-[#E8E3D9] text-[#5C544E]',
 'bg-[#EEDFD8] text-[#8A5A44]',
 'bg-[#DCE1DE] text-[#4A5D52]',
 'bg-[#E5DED5] text-[#6B5E54]',
 'bg-[#DFE2E6] text-[#4C5764]',
 'bg-[#E8DFE1] text-[#705459]',
 'bg-[#E1E4D9] text-[#565C4A]',
 'bg-[#E6DEE6] text-[#6B546B]',
 'bg-[#EBE5D9] text-[#7A6A53]',
 'bg-[#E3E0E5] text-[#5A5465]',
];

const DEFAULT_PROJECT_ID = 'default-project';
const DEFAULT_PROJECT_NAME = 'My First Project';
const DEFAULT_PROJECT_COLOR = COLORS[0];
const LOCAL_TRACKER_STATE_STORAGE_KEY = 'timeTracker_localState';
const ACTIVE_PROJECT_STORAGE_KEY = 'timeTracker_activeProjectId';

const parseStoredJson = <T,>(value: string | null): T | null => {
 if (!value) return null;

 try {
   return JSON.parse(value) as T;
 } catch {
   return null;
 }
};

const getStoredProjects = (storedProjects?: Project[] | null, uid?: string) => {
 if (storedProjects && storedProjects.length > 0) {
   return storedProjects;
 }

 return [createDefaultProject(uid)];
};

const getStoredActiveProjectId = (storedActiveProjectId: string | null | undefined, availableProjects: Project[]) => {
 if (storedActiveProjectId && availableProjects.some((project) => project.id === storedActiveProjectId)) {
   return storedActiveProjectId;
 }

 return availableProjects[0]?.id ?? DEFAULT_PROJECT_ID;
};

const getNextProjectColor = (existingProjects: Project[]) => {
 const firstUnusedColor = COLORS.find((color) =>
   !existingProjects.some((project) => project.colorClass === color)
 );

 if (firstUnusedColor) return firstUnusedColor;

 return COLORS[existingProjects.length % COLORS.length];
};

const createDefaultProject = (uid?: string): Project => ({
 id: DEFAULT_PROJECT_ID,
 name: DEFAULT_PROJECT_NAME,
 colorClass: DEFAULT_PROJECT_COLOR,
 createdAt: new Date().toISOString(),
 uid,
});

const getLocalDatetimeString = (date: Date) => {
 const tzOffset = date.getTimezoneOffset() * 60000;
 const localISOTime = (new Date(date.getTime() - tzOffset)).toISOString().slice(0, 16);
 return localISOTime;
};

const isToday = (dateString: string) => {
 if (!dateString) return false;
 const date = new Date(dateString);
 const today = new Date();
 return date.getDate() === today.getDate() &&
 date.getMonth() === today.getMonth() &&
 date.getFullYear() === today.getFullYear();
};

const isThisWeek = (dateString: string) => {
 if (!dateString) return false;
 const date = new Date(dateString);
 const today = new Date();
 const day = today.getDay();
 const diff = today.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
 const monday = new Date(today.getFullYear(), today.getMonth(), diff);
 monday.setHours(0, 0, 0, 0);
 
 const sunday = new Date(monday);
 sunday.setDate(monday.getDate() + 6);
 sunday.setHours(23, 59, 59, 999);
 
 return date >= monday && date <= sunday;
};

const CustomDateTimePicker = ({ value, onChange, disabled, className}: { value: string, onChange: (val: string) => void, disabled?: boolean, className?: string}) => {
  const date = value ? new Date(value) : undefined;
  const [isOpen, setIsOpen] = React.useState(false);
 
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      if (date) {
        selectedDate.setHours(date.getHours());
        selectedDate.setMinutes(date.getMinutes());
      }
      onChange(getLocalDatetimeString(selectedDate));
    } else {
      onChange("");
    }
  };
 
  const handleTimeChange = (
    type: "hour" | "minute",
    val: string
  ) => {
    if (date) {
      const newDate = new Date(date);
      if (type === "hour") {
        newDate.setHours(parseInt(val));
      } else if (type === "minute") {
        newDate.setMinutes(parseInt(val));
      }
      onChange(getLocalDatetimeString(newDate));
    }
  };
 
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger
        render={(props) => (
          <Button
            {...props}
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !date && "text-muted-foreground",
              className
            )}
            disabled={disabled}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? (
              format(date, "dd.MM.yy HH:mm")
            ) : (
              <span>DD.MM.YY HH:mm</span>
            )}
          </Button>
        )}
      />
      <PopoverContent className="w-auto p-0 z-50">
        <div className="sm:flex">
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleDateSelect}
            initialFocus
          />
          <div className="flex flex-col sm:flex-row sm:h-[300px] divide-y sm:divide-y-0 sm:divide-x">
            <ScrollArea className="w-64 sm:w-auto">
              <div className="flex sm:flex-col p-2">
                {hours.reverse().map((hour) => (
                  <Button
                    key={hour}
                    size="icon"
                    variant={date && date.getHours() === hour ? "default" : "ghost"}
                    className="sm:w-full shrink-0 aspect-square"
                    onClick={() => handleTimeChange("hour", hour.toString())}
                  >
                    {hour}
                  </Button>
                ))}
              </div>
              <ScrollBar orientation="horizontal" className="sm:hidden" />
            </ScrollArea>
            <ScrollArea className="w-64 sm:w-auto">
              <div className="flex sm:flex-col p-2">
                {Array.from({ length: 12 }, (_, i) => i * 5).map((minute) => (
                  <Button
                    key={minute}
                    size="icon"
                    variant={date && date.getMinutes() === minute ? "default" : "ghost"}
                    className="sm:w-full shrink-0 aspect-square"
                    onClick={() => handleTimeChange("minute", minute.toString())}
                  >
                    {minute.toString().padStart(2, '0')}
                  </Button>
                ))}
              </div>
              <ScrollBar orientation="horizontal" className="sm:hidden" />
            </ScrollArea>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo, null, 2));
}

export default function TimeTracker() {
 const [mounted, setMounted] = useState(false);
 const [isDarkMode, setIsDarkMode] = useState(false);
 const [user, setUser] = useState<User | null>(null);
 const [isAuthReady, setIsAuthReady] = useState(false);
 const [isStateHydrated, setIsStateHydrated] = useState(false);
 
 const [projects, setProjects] = useState<Project[]>(() => [createDefaultProject()]);
 
 const [entries, setEntries] = useState<TimeEntry[]>([]);

 const [activeTask, setActiveTask] = useState("");
 const [activeProjectId, setActiveProjectId] = useState(DEFAULT_PROJECT_ID);
 const [isRunning, setIsRunning] = useState(false);
 const [isPaused, setIsPaused] = useState(false);
 const [startTime, setStartTime] = useState<string>("");
 const [endTime, setEndTime] = useState<string>("");
 const [elapsedSeconds, setElapsedSeconds] = useState(0);

 const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
 const [isCreatingProject, setIsCreatingProject] = useState(false);
 const [newProjectName, setNewProjectName] = useState("");
 const [viewMode, setViewMode] = useState<'all' | 'project'>('all');
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
 const projectDropdownRef = useRef<HTMLDivElement>(null);
 const isSeedingDefaultProjectRef = useRef(false);

 useEffect(() => {
 setTimeout(() => setMounted(true), 0);
 const savedDarkMode = localStorage.getItem('timeTracker_darkMode');
 if (savedDarkMode) setIsDarkMode(JSON.parse(savedDarkMode));

 if (!isFirebaseConfigured || !auth) {
   setIsAuthReady(true);
   return;
 }

 const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
   setUser(currentUser);
   setIsAuthReady(true);
 });

 return () => unsubscribeAuth();
}, []);

 useEffect(() => {
 if (!isAuthReady) return;

 if (user && db) {
   setIsStateHydrated(true);
   const firestore = db;
   // Sync Projects
   const projectsRef = collection(firestore, `users/${user.uid}/projects`);
   const qProjects = query(projectsRef, orderBy('createdAt', 'asc'));
   const unsubscribeProjects = onSnapshot(qProjects, (snapshot) => {
     const fetchedProjects = snapshot.docs.map(doc => doc.data() as Project);
     if (fetchedProjects.length > 0) {
       setProjects(fetchedProjects);
       setActiveProjectId((currentProjectId) =>
         fetchedProjects.find((project) => project.id === currentProjectId)
           ? currentProjectId
           : fetchedProjects[0].id
       );
     } else {
       const seedKey = `timeTracker_seededCloudProject_${user.uid}`;
       const hasSeededDefaultProject = localStorage.getItem(seedKey) === 'true';

       if (!hasSeededDefaultProject && !isSeedingDefaultProjectRef.current) {
         isSeedingDefaultProjectRef.current = true;
         const defaultProject = createDefaultProject(user.uid);

         setDoc(doc(firestore, `users/${user.uid}/projects/${defaultProject.id}`), defaultProject)
           .then(() => {
             localStorage.setItem(seedKey, 'true');
           })
           .catch((error) => {
             handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/projects/${defaultProject.id}`);
           })
           .finally(() => {
             isSeedingDefaultProjectRef.current = false;
           });
       }

       setProjects([]);
       setActiveProjectId("");
     }
   }, (error) => {
     handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/projects`);
   });

   // Sync Entries
   const entriesRef = collection(firestore, `users/${user.uid}/entries`);
   const qEntries = query(entriesRef, orderBy('startTime', 'desc'));
   const unsubscribeEntries = onSnapshot(qEntries, (snapshot) => {
     const fetchedEntries = snapshot.docs.map(doc => doc.data() as TimeEntry);
     setEntries(fetchedEntries);
   }, (error) => {
     handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/entries`);
   });

   return () => {
     unsubscribeProjects();
     unsubscribeEntries();
   };
 } else {
   const storedState = parseStoredJson<LocalTrackerState>(localStorage.getItem(LOCAL_TRACKER_STATE_STORAGE_KEY));
   const legacyEntries = parseStoredJson<TimeEntry[]>(localStorage.getItem('timeTracker_entries')) ?? [];
   const legacyProjects = parseStoredJson<Project[]>(localStorage.getItem('timeTracker_projects'));
   const nextProjects = getStoredProjects(storedState?.projects ?? legacyProjects);
   const nextActiveProjectId = getStoredActiveProjectId(
     storedState?.activeProjectId ?? localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY),
     nextProjects
   );

   setEntries(storedState?.entries ?? legacyEntries);
   setProjects(nextProjects);
   setActiveProjectId(nextActiveProjectId);
   setActiveTask(storedState?.activeTask ?? "");
   setIsRunning(Boolean(storedState?.isRunning && storedState?.startTime));
   setIsPaused(Boolean(storedState?.isPaused));
   setStartTime(storedState?.startTime ?? "");
   setEndTime(storedState?.endTime ?? "");
   setElapsedSeconds(typeof storedState?.elapsedSeconds === 'number' ? storedState.elapsedSeconds : 0);
   setViewMode(storedState?.viewMode === 'project' ? 'project' : 'all');
   setIsStateHydrated(true);
 }
}, [user, isAuthReady]);

 useEffect(() => {
 if (!mounted) return;

 localStorage.setItem('timeTracker_darkMode', JSON.stringify(isDarkMode));

 if (!isAuthReady || !isStateHydrated || user) return;

 const persistedProjects = getStoredProjects(projects);
 const persistedActiveProjectId = getStoredActiveProjectId(activeProjectId, persistedProjects);
 const persistedState: LocalTrackerState = {
   entries,
   projects: persistedProjects,
   activeProjectId: persistedActiveProjectId,
   activeTask,
   isRunning: Boolean(isRunning && startTime),
   isPaused,
   startTime,
   endTime,
   elapsedSeconds,
   viewMode,
 };

 localStorage.setItem(LOCAL_TRACKER_STATE_STORAGE_KEY, JSON.stringify(persistedState));
 localStorage.setItem('timeTracker_entries', JSON.stringify(entries));
 localStorage.setItem('timeTracker_projects', JSON.stringify(persistedProjects));
 localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, persistedActiveProjectId);
}, [entries, projects, isDarkMode, mounted, user, activeProjectId, isAuthReady, isStateHydrated, activeTask, isRunning, isPaused, startTime, endTime, elapsedSeconds, viewMode]);

 useEffect(() => {
 if (!projects.length) return;

 const nextActiveProjectId = getStoredActiveProjectId(activeProjectId, projects);
 if (nextActiveProjectId !== activeProjectId) {
   setActiveProjectId(nextActiveProjectId);
 }
}, [projects, activeProjectId]);

 useEffect(() => {
 function handleClickOutside(event: MouseEvent) {
 if (projectDropdownRef.current && !projectDropdownRef.current.contains(event.target as Node)) {
 setIsProjectDropdownOpen(false);
 setIsCreatingProject(false);
}
}
 document.addEventListener("mousedown", handleClickOutside);
 return () => document.removeEventListener("mousedown", handleClickOutside);
}, []);

 useEffect(() => {
 let interval: NodeJS.Timeout;
 if (isRunning && !isPaused && startTime) {
 interval = setInterval(() => {
 const start = new Date(startTime).getTime();
 const now = new Date().getTime();
 setElapsedSeconds(Math.floor((now - start) / 1000));
}, 1000);
}
 return () => clearInterval(interval);
}, [isRunning, isPaused, startTime]);

 let displayDuration = elapsedSeconds;
 if (!isRunning && startTime && endTime) {
 const start = new Date(startTime).getTime();
 const end = new Date(endTime).getTime();
 if (end >= start) {
 displayDuration = Math.floor((end - start) / 1000);
} else {
 displayDuration = 0;
}
}

 const handleStart = () => {
 if (!isRunning) {
 const now = new Date();
 setStartTime(getLocalDatetimeString(now));
 setEndTime("");
 setElapsedSeconds(0);
 setIsRunning(true);
 setIsPaused(false);
} else if (isPaused) {
 const now = new Date().getTime();
 const newStart = new Date(now - elapsedSeconds * 1000);
 setStartTime(getLocalDatetimeString(newStart));
 setIsPaused(false);
}
};

 const handlePause = () => {
 if (isRunning && !isPaused) {
 setIsPaused(true);
}
};

 const saveEntry = () => {
 let finalStartTime = startTime;
 let finalEndTime = endTime;
 let finalElapsed = displayDuration;
 const resolvedProjectId = getStoredActiveProjectId(activeProjectId, getStoredProjects(projects));

 if (isRunning) {
 const now = new Date();
 finalEndTime = getLocalDatetimeString(now);
 const start = new Date(finalStartTime).getTime();
 finalElapsed = Math.floor((now.getTime() - start) / 1000);
} else {
 const now = new Date();
 if (!finalStartTime) finalStartTime = getLocalDatetimeString(now);
 if (!finalEndTime) finalEndTime = getLocalDatetimeString(now);
 const startMs = new Date(finalStartTime).getTime();
 const endMs = new Date(finalEndTime).getTime();
 finalElapsed = Math.max(0, Math.floor((endMs - startMs) / 1000));
}

 const newEntry: TimeEntry = {
 id: Date.now().toString(),
 task: activeTask || 'Untitled',
 projectId: resolvedProjectId,
 startTime: finalStartTime,
 endTime: finalEndTime,
 durationSeconds: finalElapsed,
 uid: user?.uid
};

 if (user && db) {
   setDoc(doc(db, `users/${user.uid}/entries/${newEntry.id}`), newEntry).catch(err => {
     handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/entries/${newEntry.id}`);
   });
 } else {
   setEntries((currentEntries) => [newEntry, ...currentEntries]);
 }
 
 setIsRunning(false);
 setIsPaused(false);
 setStartTime("");
 setEndTime("");
 setElapsedSeconds(0);
 setActiveTask("");
};

 const handleStop = () => {
 if (isRunning || (startTime && endTime)) {
 saveEntry();
}
};

 const handleTaskKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
 if (e.key === 'Enter') {
 e.preventDefault();
 if (activeTask.trim() || isRunning || startTime) {
 saveEntry();
}
}
};

 const handleCreateProject = (e: React.FormEvent) => {
 e.preventDefault();
 if (newProjectName.trim()) {
 const newProject: Project = {
 id: Date.now().toString(),
 name: newProjectName.trim(),
 colorClass: getNextProjectColor(projects),
 createdAt: new Date().toISOString(),
 uid: user?.uid
};
 
 if (user && db) {
   setDoc(doc(db, `users/${user.uid}/projects/${newProject.id}`), newProject).catch(err => {
     handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/projects/${newProject.id}`);
   });
 } else {
   setProjects((currentProjects) => [...currentProjects, newProject]);
 }
 
 setActiveProjectId(newProject.id);
 setNewProjectName("");
 setIsCreatingProject(false);
 setIsProjectDropdownOpen(false);
}
};

 useEffect(() => {
 const handleGlobalKeyDown = (e: KeyboardEvent) => {
 if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
 return;
}

 if (e.code === 'Space') {
 e.preventDefault();
 if (isRunning && !isPaused) {
 handlePause();
} else {
 handleStart();
}
} else if (e.code === 'Enter') {
 if (isRunning || (startTime && endTime)) {
 e.preventDefault();
 handleStop();
}
}
};

 document.addEventListener('keydown', handleGlobalKeyDown);
 return () => document.removeEventListener('keydown', handleGlobalKeyDown);
 // eslint-disable-next-line react-hooks/exhaustive-deps
}, [isRunning, isPaused, startTime, endTime, activeTask, activeProjectId, displayDuration, entries]);

 const exportToCSV = () => {
 const headers = ['Task', 'Project', 'Start Time', 'End Time', 'Duration (Seconds)'];
 const rows = entries.map(entry => {
 const project = projects.find(p => p.id === entry.projectId)?.name || 'Unknown';
 return [
 `"${entry.task.replace(/"/g, '""')}"`,
 `"${project.replace(/"/g, '""')}"`,
 `"${entry.startTime}"`,
 `"${entry.endTime}"`,
 entry.durationSeconds
 ].join(',');
});
 
 const csvContent = [headers.join(','), ...rows].join('\n');
 const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;'});
 const url = URL.createObjectURL(blob);
 const link = document.createElement('a');
 link.href = url;
 link.setAttribute('download', `time_tracker_export_${new Date().toISOString().slice(0, 10)}.csv`);
 document.body.appendChild(link);
 link.click();
 document.body.removeChild(link);
};

 const formatDuration = (totalSeconds: number) => {
 const hours = Math.floor(totalSeconds / 3600);
 const minutes = Math.floor((totalSeconds % 3600) / 60);
 const seconds = totalSeconds % 60;
 
 return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

 const activeProject = projects.find(p => p.id === activeProjectId) || projects[0];

 const updateEntry = (id: string, field: keyof TimeEntry, value: any) => {
 const entryToUpdate = entries.find(e => e.id === id);
 if (!entryToUpdate) return;

 const updated = { ...entryToUpdate, [field]: value };
 if (field === 'startTime' || field === 'endTime') {
   const start = new Date(updated.startTime).getTime();
   const end = new Date(updated.endTime).getTime();
   if (end >= start) {
     updated.durationSeconds = Math.floor((end - start) / 1000);
   } else {
     updated.durationSeconds = 0;
   }
 }

 if (user && db) {
   setDoc(doc(db, `users/${user.uid}/entries/${id}`), updated).catch(err => {
     handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/entries/${id}`);
   });
 } else {
   setEntries((currentEntries) => currentEntries.map((entry) => entry.id === id ? updated : entry));
 }
};

 const deleteEntry = (id: string) => {
   if (user && db) {
     deleteDoc(doc(db, `users/${user.uid}/entries/${id}`)).catch(err => {
       handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/entries/${id}`);
     });
   } else {
     setEntries(prev => prev.filter(e => e.id !== id));
   }
 };

 const deleteProject = (projectId: string) => {
   setProjects(prev => prev.filter(p => p.id !== projectId));
   setEntries(prev => prev.filter(e => e.projectId !== projectId));
   if (user && db) {
     const firestore = db;

     deleteDoc(doc(firestore, `users/${user.uid}/projects/${projectId}`)).catch(err => {
       handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/projects/${projectId}`);
     });
     // Also delete associated entries
     entries.filter(e => e.projectId === projectId).forEach(e => {
       deleteDoc(doc(firestore, `users/${user.uid}/entries/${e.id}`)).catch(err => {
         handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/entries/${e.id}`);
       });
     });
   }
   
   setProjectToDelete(null);
   if (activeProjectId === projectId) {
     const remaining = projects.filter(p => p.id !== projectId);
     setActiveProjectId(remaining.length > 0 ? remaining[0].id : "");
   }
 };

 const projectAggregates = projects.map(project => {
 const projectEntries = entries.filter(e => e.projectId === project.id);
 
 const todaySeconds = projectEntries
 .filter(e => isToday(e.startTime))
 .reduce((sum, e) => sum + e.durationSeconds, 0);
 
 const weekSeconds = projectEntries
 .filter(e => isThisWeek(e.startTime))
 .reduce((sum, e) => sum + e.durationSeconds, 0);
 
 const totalSeconds = projectEntries
 .reduce((sum, e) => sum + e.durationSeconds, 0);
 
 return {
 ...project,
 todaySeconds,
 weekSeconds,
 totalSeconds
};
});

 const canUseGoogleSignIn = Boolean(isFirebaseConfigured && auth && googleProvider);

 if (!mounted || !isAuthReady || !isStateHydrated) return null; // Prevent hydration mismatch and local state races

 return (
 <div className={`${isDarkMode ? 'dark' : ''}`}>
 <div className="min-h-screen bg-base text-text-main font-sans p-8 transition-colors duration-200">
 <div className="max-w-7xl mx-auto">
 {/* Header */}
 <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
   <div>
     <div className="flex items-center gap-3 mb-2">
       <Clock className="w-8 h-8 text-primary" />
       <h1 className="text-3xl font-bold text-text-main tracking-tight">Time Tracker</h1>
     </div>
     <p className="text-sm text-secondary/90 max-w-2xl leading-relaxed">
       A simple, privacy-friendly tool to track the time you spend on your tasks. Hit start to begin tracking. 
       Your data is saved locally in your browser by default. Add your own Firebase config 
       to enable Google sign-in and cloud sync across devices.
     </p>
   </div>
   <div className="flex-shrink-0">
     {user ? (
       <div className="flex items-center gap-3">
         <div className="flex items-center gap-2 px-3 py-1.5 bg-surface rounded-lg border border-border-main">
           {user.photoURL ? (
             <Image src={user.photoURL} alt="Profile" width={24} height={24} className="rounded-full" referrerPolicy="no-referrer" />
           ) : (
             <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">
               {user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
             </div>
           )}
           <span className="text-sm font-medium text-text-main hidden sm:inline-block">
             {user.displayName || user.email}
           </span>
         </div>
         <button 
           className="flex items-center gap-2 px-3 py-2 bg-surface hover:bg-border-main text-text-main rounded-xl text-sm font-medium transition-colors border border-border-main shadow-sm"
           onClick={() => {
             if (!auth) return;
             signOut(auth);
           }}
           title="Sign out"
         >
           <LogOut className="w-4 h-4" />
         </button>
       </div>
     ) : (
       <div className="flex flex-wrap items-center justify-end gap-3">
         <div className="flex items-center gap-2 px-3 py-2 bg-surface rounded-xl text-sm font-medium text-secondary border border-border-main shadow-sm">
           <HardDrive className="w-4 h-4" />
           Local mode
         </div>
         <button 
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors border shadow-sm ${
            canUseGoogleSignIn
              ? 'bg-surface hover:bg-border-main text-text-main border-border-main'
              : 'bg-surface/70 text-secondary border-border-main/70 cursor-not-allowed'
          }`}
          onClick={() => {
            if (!auth || !googleProvider) return;
            signInWithPopup(auth, googleProvider).catch(err => {
              if (err.code !== 'auth/popup-closed-by-user' && !err.message?.includes('aborted')) {
                console.error("Login error:", err);
              }
            });
          }}
          disabled={!canUseGoogleSignIn}
          title={canUseGoogleSignIn ? "Sign in with Google" : "Google sign-in is unavailable until Firebase is configured"}
         >
          <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Sign in with Google
         </button>
       </div>
     )}
   </div>
 </div>

 {/* Top Bar */}
 <div className="flex items-center justify-between mb-6 border-b border-border-main pb-3">
 <div className="flex items-center gap-6">
 <button 
 onClick={() => setViewMode('all')}
 className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'all' ? 'bg-surface text-text-main ' : 'text-secondary hover:text-text-main '}`}
 >
 <List className="w-4 h-4" /> All Entries
 </button>
 <button 
 onClick={() => setViewMode('project')}
 className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'project' ? 'bg-surface text-text-main ' : 'text-secondary hover:text-text-main '}`}
 >
 <LayoutGrid className="w-4 h-4" /> By Project
 </button>
 </div>
 
 <div className="flex items-center gap-2 flex-wrap">
 <button
 onClick={() => setIsDarkMode(!isDarkMode)}
 className="p-2 rounded-md text-secondary hover:text-text-main hover:bg-surface transition-colors"
 title="Toggle Dark Mode"
 >
 {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
 </button>
 
 <button
 onClick={exportToCSV}
 className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium text-secondary hover:text-text-main hover:bg-surface transition-colors"
 title="Export as CSV"
 >
 <Download className="w-4 h-4" />
 <span>CSV</span>
 </button>
 </div>
 </div>

 {/* Table Container */}
 {viewMode === 'all' ? (
 <div className="w-full overflow-x-auto">
 <div className="min-w-full lg:min-w-[1160px] pb-32">
 {/* Table Header */}
   <div className="hidden lg:grid grid-cols-[minmax(200px,2fr)_minmax(140px,1fr)_100px_minmax(180px,1.2fr)_minmax(180px,1.2fr)_140px_120px] gap-0 p-0 border-b border-border-main text-sm text-text-main font-medium bg-surface/80 rounded-t-xl items-stretch">
   <div className="flex items-center gap-2 p-3 border-r border-border-main/50"><CheckCircle className="w-4 h-4" /> Task</div>
   <div className="flex items-center gap-2 p-3 border-r border-border-main/50"><Folder className="w-4 h-4" /> Project</div>
   <div className="flex items-center gap-2 p-3 border-r border-border-main/50"><Settings2 className="w-4 h-4" /> Timer</div>
   <div className="flex items-center gap-2 p-3 border-r border-border-main/50"><Clock className="w-4 h-4" /> Start Time</div>
   <div className="flex items-center gap-2 p-3 border-r border-border-main/50"><LayoutGrid className="w-4 h-4" /> End Time</div>
   <div className="flex items-center gap-2 p-3 border-r border-border-main/50"><Hourglass className="w-4 h-4" /> Duration</div>
   <div className="flex items-center justify-center p-3"><Trash2 className="w-4 h-4 text-secondary/50" /></div>
 </div>

 {/* Active Timer Row */}
   <div className={`group flex flex-col lg:grid lg:grid-cols-[minmax(200px,2fr)_minmax(140px,1fr)_100px_minmax(180px,1.2fr)_minmax(180px,1.2fr)_140px_120px] gap-0 p-0 border-b border-border-main lg:items-stretch transition-colors ${isRunning && !isPaused ? "bg-primary/10" : "hover:bg-surface"}`}>
 <div className="flex items-center gap-2 p-3 border-r border-border-main/50 min-w-0">
 <FileText className="w-4 h-4 text-primary shrink-0" />
 <input 
 type="text" 
 placeholder="What are you working on?" 
 className="w-full bg-transparent border-none focus:ring-0 text-sm font-medium text-text-main placeholder-secondary/70 outline-none truncate"
 value={activeTask}
 title={activeTask}
 onChange={(e) => setActiveTask(e.target.value)}
 onKeyDown={handleTaskKeyDown}
 />
 </div>
 
 {/* Project Selector */}
   <div className="relative p-3 border-r border-border-main/50 flex items-center" ref={projectDropdownRef}>
 <button 
 onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
 className={`text-xs font-medium px-2.5 py-1 rounded-full border-none outline-none cursor-pointer flex items-center gap-1 ${activeProject?.colorClass || 'bg-surface text-text-main '}`}
 >
 {activeProject?.name || 'Select Project'}
 <ChevronDown className="w-3 h-3 opacity-50" />
 </button>
 
 {isProjectDropdownOpen && (
 <div className="absolute top-full left-0 mt-1 w-48 bg-base border border-border-main rounded-md shadow-lg z-10 py-1">
 {!isCreatingProject ? (
 <>
 {projects.map(p => (
 <div 
 key={p.id} 
 className="px-3 py-1.5 text-sm hover:bg-surface cursor-pointer flex items-center justify-between"
 onClick={() => {
 setActiveProjectId(p.id);
 setIsProjectDropdownOpen(false);
}}
 >
 <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${p.colorClass}`}>
 {p.name}
 </span>
 {activeProjectId === p.id && <Check className="w-3 h-3 text-secondary/70" />}
 </div>
 ))}
 <div className="border-t border-border-main mt-1 pt-1">
 <div 
 className="px-3 py-1.5 text-sm text-secondary hover:bg-surface hover:text-text-main cursor-pointer flex items-center gap-2"
 onClick={() => setIsCreatingProject(true)}
 >
 <Plus className="w-3 h-3" /> Create new
 </div>
 </div>
 </>
 ) : (
 <form onSubmit={handleCreateProject} className="px-2 py-1.5">
 <input
 type="text"
 autoFocus
 placeholder="Project name..."
 className="w-full text-sm px-2 py-1 border border-border-main rounded outline-none focus:border-primary bg-transparent text-text-main placeholder-secondary/70"
 value={newProjectName}
 onChange={(e) => setNewProjectName(e.target.value)}
 />
 <div className="flex justify-end gap-1 mt-2">
 <button 
 type="button" 
 className="text-xs px-2 py-1 text-secondary hover:bg-surface rounded"
 onClick={() => setIsCreatingProject(false)}
 >
 Cancel
 </button>
 <button 
 type="submit" 
 className="text-xs px-2 py-1 bg-primary text-white rounded hover:bg-primary/90"
 disabled={!newProjectName.trim()}
 >
 Add
 </button>
 </div>
 </form>
 )}
 </div>
 )}
 </div>

 {/* Timer Controls */}
 <div className="flex items-center justify-center p-3 border-r border-border-main/50">
 <div className="flex items-center gap-1">
 <button onClick={handleStart} className={`p-1.5 rounded transition-colors ${isRunning && !isPaused ? 'bg-green-500/20 text-green-600 dark:text-green-400 ' : 'hover:bg-black/5 dark:hover:bg-white/5 text-secondary/70 hover:text-primary '}`} title="Start/Resume">
 <Play className="w-4 h-4 fill-current" />
 </button>
 <button onClick={handlePause} className={`p-1.5 rounded transition-colors ${isPaused ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 ' : 'hover:bg-black/5 dark:hover:bg-white/5 text-secondary/70 hover:text-primary '}`} title="Pause">
 <Pause className="w-4 h-4 fill-current" />
 </button>
 <button onClick={handleStop} disabled={!isRunning && !isPaused && displayDuration === 0 && !startTime} className={`p-1.5 rounded transition-colors ${(isRunning || isPaused || displayDuration > 0 || startTime) ? 'hover:bg-red-500/20 text-red-500 dark:text-red-400 ' : 'text-secondary/50 cursor-not-allowed'}`} title="Stop & Save">
 <Square className="w-4 h-4 fill-current" />
 </button>
 </div>
 </div>

 {/* Start Time Input */}
 <div className="p-3 border-r border-border-main/50 flex items-center">
 <span className="lg:hidden text-xs text-secondary mb-1 block">Start Time</span>
 <CustomDateTimePicker 
 className="bg-transparent border-none text-sm text-secondary hover:text-primary hover:bg-black/5 dark:hover:bg-white/5 rounded-md focus:ring-0 outline-none w-full px-2 py-1 -ml-2 transition-colors"
 value={startTime}
 onChange={(val) => setStartTime(val)}
 />
 </div>

 {/* End Time Input */}
 <div className="p-3 border-r border-border-main/50 flex items-center">
 <span className="lg:hidden text-xs text-secondary mb-1 block">End Time</span>
 <CustomDateTimePicker 
 className="bg-transparent border-none text-sm text-secondary hover:text-primary hover:bg-black/5 dark:hover:bg-white/5 rounded-md focus:ring-0 outline-none w-full px-2 py-1 -ml-2 transition-colors"
 value={endTime}
 onChange={(val) => setEndTime(val)}
 disabled={isRunning && !isPaused}
 />
 </div>

 {/* Duration */}
 <div className="p-3 border-r border-border-main/50 flex items-center">
 <div className="text-sm font-mono tabular-nums text-primary font-medium flex items-center whitespace-nowrap">
 <Hourglass className="hidden lg:block h-4 w-4 shrink-0 opacity-0" aria-hidden="true" />
 <span className="hidden lg:block w-2 shrink-0" aria-hidden="true" />
 <span className="lg:hidden text-xs text-secondary font-sans font-normal mr-2">Duration:</span>
 {formatDuration(displayDuration)}
 </div>
 </div>
 
 <div className="relative flex items-center justify-start p-3 pl-2">
 {(!isRunning && !isPaused && startTime && endTime) && (
 <button
 onClick={handleStop}
 className="flex w-full max-w-[88px] items-center justify-center gap-1 rounded bg-primary px-2 py-1.5 text-white shadow-sm transition-all hover:bg-primary/90"
 title="Save Entry"
 >
 <Check className="w-4 h-4" />
 <span className="text-xs font-medium hidden xl:inline">Save</span>
 </button>
 )}
 <button 
 onClick={() => {
 setIsRunning(false);
 setIsPaused(false);
 setStartTime("");
 setEndTime("");
 setElapsedSeconds(0);
 setActiveTask("");
}}
 className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1.5 text-secondary/70 opacity-0 transition-all hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:bg-red-900/20 dark:text-red-400"
 title="Clear Timer"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 </div>
 </div>

 {/* Past Entries */}
 {entries.map((entry) => {
 const project = projects.find(p => p.id === entry.projectId);
 return (
   <div key={entry.id} className="group flex flex-col lg:grid lg:grid-cols-[minmax(200px,2fr)_minmax(140px,1fr)_100px_minmax(180px,1.2fr)_minmax(180px,1.2fr)_140px_120px] gap-0 p-0 border-b border-border-main lg:items-stretch hover:bg-surface transition-colors">
  <div className="flex items-center gap-2 p-3 border-r border-border-main/50 min-w-0">
 <Clock className="w-4 h-4 text-primary shrink-0" />
 <input 
 type="text"
 value={entry.task}
 onChange={(e) => updateEntry(entry.id, 'task', e.target.value)}
 title={entry.task}
 className="bg-transparent border-none text-sm font-medium text-text-main w-full focus:ring-0 outline-none truncate"
 />
 </div>
 <div className="p-3 border-r border-border-main/50 flex items-center">
 <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${project?.colorClass || 'bg-surface text-text-main '}`}>
 {project?.name || 'Unknown'}
 </span>
 </div>
 <div className="p-3 border-r border-border-main/50 flex items-center justify-center">
 <Clock className="w-4 h-4 text-secondary/30" />
 </div>
 <div className="p-3 border-r border-border-main/50 flex items-center">
 <span className="lg:hidden text-xs text-secondary mb-1 block">Start Time</span>
 <CustomDateTimePicker 
 className="bg-transparent border-none text-sm text-secondary hover:text-primary hover:bg-black/5 dark:hover:bg-white/5 rounded-md focus:ring-0 outline-none w-full px-2 py-1 -ml-2 transition-colors"
 value={entry.startTime}
 onChange={(val) => updateEntry(entry.id, 'startTime', val)}
 />
 </div>
 <div className="p-3 border-r border-border-main/50 flex items-center">
 <span className="lg:hidden text-xs text-secondary mb-1 block">End Time</span>
 <CustomDateTimePicker 
 className="bg-transparent border-none text-sm text-secondary hover:text-primary hover:bg-black/5 dark:hover:bg-white/5 rounded-md focus:ring-0 outline-none w-full px-2 py-1 -ml-2 transition-colors"
 value={entry.endTime}
 onChange={(val) => updateEntry(entry.id, 'endTime', val)}
 />
 </div>
 <div className="p-3 border-r border-border-main/50 flex items-center text-sm font-mono tabular-nums text-primary font-medium whitespace-nowrap">
 <Hourglass className="hidden lg:block h-4 w-4 shrink-0 opacity-0" aria-hidden="true" />
 <span className="hidden lg:block w-2 shrink-0" aria-hidden="true" />
 <span className="lg:hidden text-xs text-secondary/70 font-sans font-normal mr-2">Duration:</span>
 {formatDuration(entry.durationSeconds)}
 </div>
 <div className="relative flex justify-center p-3">
 <button 
 onClick={() => deleteEntry(entry.id)}
 className="p-1.5 rounded hover:bg-red-50 dark:bg-red-900/20 text-secondary/70 hover:text-red-600 dark:text-red-400 transition-all opacity-0 group-hover:opacity-100"
 title="Delete Entry"
 >
 <Trash2 className="w-4 h-4" />
 </button>
    </div>
      </div>
  );
})}
 

 </div>
 </div>
 ) : (
 <div className="w-full overflow-x-auto">
 <div className="min-w-full lg:min-w-[800px] pb-32">
 {/* Project Table Header */}
 <div className="hidden lg:grid grid-cols-[minmax(250px,2fr)_minmax(150px,1fr)_minmax(150px,1fr)_minmax(150px,1fr)_60px] gap-4 p-3 border-b border-border-main text-sm text-text-main font-medium bg-surface/80 rounded-t-xl items-center">
 <div className="flex items-center gap-2 lg:pl-2"><Folder className="w-4 h-4" /> Project</div>
 <div className="flex items-center gap-2 flex-wrap"><Clock className="w-4 h-4" /> Today</div>
 <div className="flex items-center gap-2 flex-wrap"><LayoutGrid className="w-4 h-4" /> This Week</div>
 <div className="flex items-center gap-2 flex-wrap"><Hourglass className="w-4 h-4" /> Total</div>
            <div className="flex items-center justify-center"><Trash2 className="w-4 h-4 text-secondary/50" /></div>
          </div>

 {/* Project Rows */}
 {projectAggregates.map(project => (
 <div key={project.id} className="group flex flex-col lg:grid lg:grid-cols-[minmax(250px,2fr)_minmax(150px,1fr)_minmax(150px,1fr)_minmax(150px,1fr)_60px] gap-3 lg:gap-4 p-4 lg:p-3 border-b border-border-main lg:items-center hover:bg-surface transition-colors">
 <div className="flex items-center gap-2 lg:pl-2">
 <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${project.colorClass}`}>
 {project.name}
 </span>
 </div>
 <div className="text-sm font-mono text-secondary">{formatDuration(project.todaySeconds)}</div>
 <div className="text-sm font-mono text-secondary">{formatDuration(project.weekSeconds)}</div>
 <div className="text-sm font-mono text-text-main font-medium">{formatDuration(project.totalSeconds)}</div>
            <div className="relative flex justify-center p-3">
              <button 
                onClick={() => setProjectToDelete(project)}
                className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-secondary/70 hover:text-red-600 dark:hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                title="Delete Project"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
 ))}
 </div>
 </div>
 )}

 
      {/* Delete Project Modal */}
      {projectToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border-main rounded-xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-xl font-bold text-text-main mb-2">Delete Project</h3>
            <p className="text-secondary mb-6">
              Are you sure you want to delete the project <span className="font-semibold text-text-main">&quot;{projectToDelete.name}&quot;</span>? 
              This will also delete all time entries associated with this project. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setProjectToDelete(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-secondary hover:bg-surface-hover transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => deleteProject(projectToDelete.id)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 hover:bg-red-600 text-white transition-colors"
              >
                Delete Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
 <footer className="mt-16 pt-8 border-t border-border-main flex flex-col sm:flex-row items-center justify-between text-sm text-secondary pb-4">
 <div>Local-first time tracking with optional cloud sync.</div>
 <div className="mt-4 sm:mt-0">
 <a href="https://github.com/wenzel-washington/time-tracker" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-text-main transition-colors">
 <Github className="w-4 h-4" />
 <span>View source on GitHub</span>
 </a>
 </div>
 </footer>
 </div>
 </div>
 </div>
 );
}
