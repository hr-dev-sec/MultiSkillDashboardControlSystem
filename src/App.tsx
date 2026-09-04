import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  getStoredEmployees,
  saveStoredEmployees,
  getSession,
  saveSession,
  clearSession,
  computeDashboardStats,
  extractPeriods,
  filterEmployees,
  calculateEmployeeScore,
  getDefaultFilterPeriod,
  syncSystemFromBackend,
  updateEmployeeProfile
} from './utils/storage';
import { INITIAL_SKILL_META } from './data/initialData';
import { Employee, UserSession, AppFiltersState } from './types';
import {
  getSupabaseConfig,
  fetchSupabaseEmployees,
  fetchGoogleSheetData,
  getSavedGoogleSheetUrl,
  deleteEmployeeFromSupabase,
  mergeEmployeesData,
  notifySyncStatus,
  autoSyncEmployeesToSupabase
} from './utils/syncService';
import { fetchEmployeesFromServer, saveEmployeesToServer } from './utils/systemDbService';

// Components
import { LandingPage } from './components/LandingPage';
import { LoginPage } from './components/LoginPage';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { SharedFilterBar } from './components/SharedFilterBar';
import { DashboardView } from './components/DashboardView';
import { EmployeeDataView } from './components/EmployeeDataView';
import { SettingsView } from './components/SettingsView';
import { ImportSyncModal } from './components/ImportSyncModal';
import { ExportExcelConfirmModal } from './components/ExportExcelConfirmModal';
import { ExportPdfModal } from './components/ExportPdfModal';
import { RecipientDownloadModal } from './components/RecipientDownloadModal';
import { ConfirmationModal, ConfirmationVariant } from './components/ConfirmationModal';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';

export default function App() {
  // Navigation Screen: 'landing' | 'login' | 'app'
  const [currentScreen, setCurrentScreen] = useState<'landing' | 'login' | 'app'>('landing');

  // Active Tab inside App: 'dashboard' | 'employee' | 'settings'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'employee' | 'settings'>('dashboard');

  // Mobile sidebar state
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Import / Sync / Export / Shortcuts Modal states
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isGlobalExcelModalOpen, setIsGlobalExcelModalOpen] = useState(false);
  const [isGlobalPdfModalOpen, setIsGlobalPdfModalOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [toastNotification, setToastNotification] = useState<string | null>(null);

  // Recipient Magic Link Download Modal State
  const [magicLinkParams, setMagicLinkParams] = useState<{
    isOpen: boolean;
    report?: string;
    month?: string;
    year?: string;
    divisi?: string;
    dept?: string;
  }>({
    isOpen: false
  });

  // Global Confirmation & Alert Modal State
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    description: React.ReactNode | string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: ConfirmationVariant;
    icon?: string;
    singleAction?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {}
  });

  // User session
  const [currentUser, setCurrentUser] = useState<UserSession>(() => {
    const existing = getSession();
    if (existing && existing.username) return existing;
    const defaultSession: UserSession = {
      username: 'hr_admin',
      name: 'Mahmud Nurdiansyah',
      role: 'HR Development Admin',
      department: 'Human Resources Development',
      email: 'mahmudnurdiansyah4@gmail.com',
      phone: '0819-1932-7912',
      nik: '122108091',
      avatarUrl: '',
      bio: 'Administrator Multi-Skill Monitoring & Pengembangan Kompetensi Karyawan PT Ajinomoto Indonesia Mojokerto Factory.'
    };
    saveSession(defaultSession);
    return defaultSession;
  });

  // Employees Database
  const [employees, setEmployees] = useState<Employee[]>(() => getStoredEmployees());

  // Collapsible Sidebar State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('msm_sidebar_collapsed') === 'true';
  });

  const handleToggleSidebarCollapse = useCallback(() => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('msm_sidebar_collapsed', String(next));
      return next;
    });
  }, []);

  // Set document title and favicon
  useEffect(() => {
    document.title = 'Multi-Skill Monitoring | Ajinomoto';
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.getElementsByTagName('head')[0].appendChild(link);
    }
    link.href = 'https://upload.wikimedia.org/wikipedia/commons/0/01/Ajinomoto_Group_Global_Brand_logo.png';
  }, []);

  // Dark Mode
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('msm_dark_mode') === 'true';
  });

  // Filters State with automatic default period (current year & month if data exists, or closest available)
  const [filters, setFilters] = useState<AppFiltersState>(() => {
    const initialEmployees = getStoredEmployees();
    const defaultPeriod = getDefaultFilterPeriod(initialEmployees);
    return {
      tahun: defaultPeriod.tahun,
      bulan: defaultPeriod.bulan,
      divisi: [],
      department: [],
      jabatan: []
    };
  });

  // Apply Dark Mode Class to HTML
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('msm_dark_mode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('msm_dark_mode', 'false');
    }
  }, [isDarkMode]);

  // Auto-fetch and reconcile data from Server DB, Supabase Cloud, and Google Sheets on boot & login
  const loadDatabaseFromSource = useCallback(async () => {
    let hasLoadedData = false;
    notifySyncStatus('saving');

    const debugTracker = {
      timestamp: new Date().toISOString(),
      initialLocalCount: 0,
      syncSystemFromBackend: {
        executed: false,
        success: false,
        usersCount: 0,
        hasSupabaseConfig: false,
        error: null as string | null
      },
      fetchEmployeesFromServer: {
        executed: false,
        success: false,
        serverCount: 0,
        mergedCount: 0,
        error: null as string | null
      },
      fetchSupabaseEmployees: {
        executed: false,
        skippedReason: null as string | null,
        success: false,
        cloudCount: 0,
        mergedCount: 0,
        error: null as string | null
      },
      googleSheetsFallback: {
        executed: false,
        success: false,
        sheetCount: 0,
        skippedReason: null as string | null
      },
      finalStateCount: 0
    };

    try {
      const initialLocal = getStoredEmployees();
      debugTracker.initialLocalCount = initialLocal.length;
    } catch {
      debugTracker.initialLocalCount = 0;
    }

    console.groupCollapsed(
      `%c[DB-Debugger] 🔄 Initiating loadDatabaseFromSource Sequence (Initial Local Count: ${debugTracker.initialLocalCount})`,
      'color: #0284c7; font-weight: bold; font-size: 12px;'
    );
    console.log('[DB-Debugger] [Step 0] Initial Local Storage Count:', debugTracker.initialLocalCount);

    // -------------------------------------------------------------------------
    // Phase 1: Initialize System Configuration, Auth, and Credentials
    // -------------------------------------------------------------------------
    console.log('[DB-Debugger] [Step 1] Executing syncSystemFromBackend()...');
    debugTracker.syncSystemFromBackend.executed = true;
    let systemConfig: any = undefined;
    try {
      const syncResult = await syncSystemFromBackend();
      if (syncResult) {
        debugTracker.syncSystemFromBackend.success = true;
        debugTracker.syncSystemFromBackend.usersCount = syncResult.users?.length || 0;
        systemConfig = syncResult.config;
        
        const hasSb = Boolean(systemConfig?.supabaseConfig?.url && systemConfig?.supabaseConfig?.anonKey);
        debugTracker.syncSystemFromBackend.hasSupabaseConfig = hasSb;

        console.log(
          `[DB-Debugger] [Step 1] ✅ syncSystemFromBackend SUCCESS - Users loaded: ${debugTracker.syncSystemFromBackend.usersCount}, Supabase Config Present: ${hasSb}`
        );

        const refreshedSession = getSession();
        if (refreshedSession && refreshedSession.username) {
          setCurrentUser(refreshedSession);
        }
      } else {
        debugTracker.syncSystemFromBackend.success = false;
        console.warn('[DB-Debugger] [Step 1] ⚠️ syncSystemFromBackend returned null (empty backend response).');
      }
    } catch (e: any) {
      debugTracker.syncSystemFromBackend.error = e?.message || String(e);
      console.error('[DB-Debugger] [Step 1] ❌ syncSystemFromBackend FAILED with error:', e);
    }

    // Resolve Supabase configuration: prioritize server configuration if available
    const sbConfig = (systemConfig?.supabaseConfig?.url && systemConfig?.supabaseConfig?.anonKey)
      ? systemConfig.supabaseConfig
      : getSupabaseConfig();

    // -------------------------------------------------------------------------
    // Phase 2: Instant Rehydration from Server Persistent Database (Local Server Disk)
    // -------------------------------------------------------------------------
    console.log('[DB-Debugger] [Step 2] Executing fetchEmployeesFromServer()...');
    debugTracker.fetchEmployeesFromServer.executed = true;
    try {
      const serverEmps = await fetchEmployeesFromServer();
      if (serverEmps && Array.isArray(serverEmps)) {
        debugTracker.fetchEmployeesFromServer.serverCount = serverEmps.length;
        if (serverEmps.length > 0) {
          debugTracker.fetchEmployeesFromServer.success = true;
          const currentLocal = getStoredEmployees();
          // Smart merge server employees with current local cache (preserves all distinct periods)
          const mergedServer = mergeEmployeesData(currentLocal, serverEmps, 'merge').updatedEmployees;
          debugTracker.fetchEmployeesFromServer.mergedCount = mergedServer.length;
          
          setEmployees(mergedServer);
          // Persist to local storage without triggering immediate remote push
          saveStoredEmployees(mergedServer, { skipCloudSync: true });

          const defaultPeriod = getDefaultFilterPeriod(mergedServer);
          setFilters((prev) => ({
            ...prev,
            tahun: defaultPeriod.tahun,
            bulan: defaultPeriod.bulan
          }));
          hasLoadedData = true;
          console.log(
            `[DB-Debugger] [Step 2] ✅ fetchEmployeesFromServer SUCCESS - Server Raw Count: ${serverEmps.length}, Merged Active Count: ${mergedServer.length}`
          );
        } else {
          debugTracker.fetchEmployeesFromServer.success = true;
          console.log('[DB-Debugger] [Step 2] ℹ️ fetchEmployeesFromServer returned 0 employees (empty database).');
        }
      } else {
        debugTracker.fetchEmployeesFromServer.success = false;
        console.warn('[DB-Debugger] [Step 2] ⚠️ fetchEmployeesFromServer returned invalid/null response.');
      }
    } catch (serverErr: any) {
      debugTracker.fetchEmployeesFromServer.error = serverErr?.message || String(serverErr);
      console.error('[DB-Debugger] [Step 2] ❌ fetchEmployeesFromServer FAILED with error:', serverErr);
    }

    // -------------------------------------------------------------------------
    // Phase 3: Supabase Cloud Database Synchronization (Authoritative Remote Source)
    // -------------------------------------------------------------------------
    console.log('[DB-Debugger] [Step 3] Evaluating Supabase configuration...');
    debugTracker.fetchSupabaseEmployees.executed = true;
    if (sbConfig.url && sbConfig.anonKey) {
      try {
        console.log(`[DB-Debugger] [Step 3] Fetching from Supabase Cloud (Table: ${sbConfig.tableName || 'employees_multi_skill'})...`);
        const sbRes = await fetchSupabaseEmployees(sbConfig);
        if (sbRes.success && sbRes.data) {
          debugTracker.fetchSupabaseEmployees.success = true;
          debugTracker.fetchSupabaseEmployees.cloudCount = sbRes.data.length;

          if (sbRes.data.length > 0) {
            // Supabase Cloud is the authoritative source of truth.
            // When connected, we directly adopt the Supabase data rather than blending
            // with default template records from initial disk seed.
            const cloudEmps = sbRes.data;
            debugTracker.fetchSupabaseEmployees.mergedCount = cloudEmps.length;

            // Prioritize data persistence across all levels:
            // 1. React State
            setEmployees(cloudEmps);
            // 2. Client LocalStorage
            saveStoredEmployees(cloudEmps, { skipCloudSync: true });
            // 3. Server Disk Database (/api/employees)
            saveEmployeesToServer(cloudEmps).catch((err) => {
              console.warn('[Server DB] Sinkronisasi data Cloud ke Server DB disk:', err);
            });

            // Adjust filter period to optimal populated period
            const defaultPeriod = getDefaultFilterPeriod(cloudEmps);
            setFilters((prev) => ({
              ...prev,
              tahun: defaultPeriod.tahun,
              bulan: defaultPeriod.bulan
            }));

            hasLoadedData = true;
            console.log(
              `[DB-Debugger] [Step 3] ✅ fetchSupabaseEmployees SUCCESS - Authoritative Cloud Records: ${cloudEmps.length}`
            );
          } else {
            console.log('[DB-Debugger] [Step 3] ℹ️ fetchSupabaseEmployees connected successfully but table contains 0 records.');
          }
        } else {
          debugTracker.fetchSupabaseEmployees.success = false;
          debugTracker.fetchSupabaseEmployees.error = sbRes.message || 'Unknown Supabase error';
          console.warn('[DB-Debugger] [Step 3] ⚠️ fetchSupabaseEmployees returned unsuccessful status:', sbRes.message);
        }
      } catch (sbErr: any) {
        debugTracker.fetchSupabaseEmployees.error = sbErr?.message || String(sbErr);
        console.error('[DB-Debugger] [Step 3] ❌ fetchSupabaseEmployees EXCEPTION:', sbErr);
      }
    } else {
      debugTracker.fetchSupabaseEmployees.skippedReason = 'Supabase credentials (url or anonKey) are not configured';
      console.log('[DB-Debugger] [Step 3] ⏭️ fetchSupabaseEmployees SKIPPED: URL or Anon Key not configured in system settings.');
    }

    // -------------------------------------------------------------------------
    // Phase 4: Google Sheets Master Fallback (Tertiary Source)
    // -------------------------------------------------------------------------
    if (!hasLoadedData) {
      console.log('[DB-Debugger] [Step 4] Primary sources yielded no data. Checking Google Sheets Fallback...');
      debugTracker.googleSheetsFallback.executed = true;
      const defaultSheet = systemConfig?.googleSheetUrl || getSavedGoogleSheetUrl();
      if (defaultSheet) {
        try {
          console.log('[DB-Debugger] [Step 4] Fetching Google Sheets Master...');
          const sheetRes = await fetchGoogleSheetData(defaultSheet);
          if (sheetRes.success && sheetRes.data && sheetRes.data.length > 0) {
            debugTracker.googleSheetsFallback.success = true;
            debugTracker.googleSheetsFallback.sheetCount = sheetRes.data.length;
            const currentLocal = getStoredEmployees();
            const merged = mergeEmployeesData(currentLocal, sheetRes.data, 'merge').updatedEmployees;
            setEmployees(merged);
            saveStoredEmployees(merged);
            saveEmployeesToServer(merged).catch(() => {});

            const defaultPeriod = getDefaultFilterPeriod(merged);
            setFilters((prev) => ({
              ...prev,
              tahun: defaultPeriod.tahun,
              bulan: defaultPeriod.bulan
            }));

            hasLoadedData = true;
            console.log(`[DB-Debugger] [Step 4] ✅ Google Sheets Fallback SUCCESS - Loaded: ${sheetRes.data.length}`);
          } else {
            console.warn('[DB-Debugger] [Step 4] ⚠️ Google Sheets Fallback returned no rows.');
          }
        } catch (sheetErr: any) {
          console.error('[DB-Debugger] [Step 4] ❌ Google Sheets Fallback FAILED:', sheetErr);
        }
      } else {
        debugTracker.googleSheetsFallback.skippedReason = 'No Google Sheet URL configured';
        console.log('[DB-Debugger] [Step 4] ⏭️ Google Sheets Fallback SKIPPED: No sheet URL configured.');
      }
    } else {
      debugTracker.googleSheetsFallback.skippedReason = 'Data already loaded from Server DB or Supabase';
      console.log('[DB-Debugger] [Step 4] ⏭️ Google Sheets Fallback SKIPPED: Data already loaded successfully from primary sources.');
    }

    // -------------------------------------------------------------------------
    // Final Summary & Diagnostic Table
    // -------------------------------------------------------------------------
    try {
      const finalStored = getStoredEmployees();
      debugTracker.finalStateCount = finalStored.length;
    } catch {
      debugTracker.finalStateCount = 0;
    }

    const flowSummary = [
      {
        Step: '1. syncSystemFromBackend',
        Executed: debugTracker.syncSystemFromBackend.executed ? 'Yes' : 'No',
        Status: debugTracker.syncSystemFromBackend.success ? '✅ Success' : debugTracker.syncSystemFromBackend.error ? '❌ Error' : '⚠️ No data',
        RecordsLoaded: `${debugTracker.syncSystemFromBackend.usersCount} users`,
        Notes: debugTracker.syncSystemFromBackend.error || (debugTracker.syncSystemFromBackend.hasSupabaseConfig ? 'Supabase config ready' : 'No Supabase config in server')
      },
      {
        Step: '2. fetchEmployeesFromServer',
        Executed: debugTracker.fetchEmployeesFromServer.executed ? 'Yes' : 'No',
        Status: debugTracker.fetchEmployeesFromServer.success ? '✅ Success' : debugTracker.fetchEmployeesFromServer.error ? '❌ Error' : '⚠️ Null',
        RecordsLoaded: `${debugTracker.fetchEmployeesFromServer.serverCount} employees`,
        Notes: debugTracker.fetchEmployeesFromServer.error || `Merged to ${debugTracker.fetchEmployeesFromServer.mergedCount} active`
      },
      {
        Step: '3. fetchSupabaseEmployees',
        Executed: debugTracker.fetchSupabaseEmployees.executed ? 'Yes' : 'No',
        Status: debugTracker.fetchSupabaseEmployees.skippedReason
          ? '⏭️ Skipped'
          : debugTracker.fetchSupabaseEmployees.success
          ? '✅ Success'
          : '❌ Failed',
        RecordsLoaded: `${debugTracker.fetchSupabaseEmployees.cloudCount} employees`,
        Notes: debugTracker.fetchSupabaseEmployees.skippedReason || debugTracker.fetchSupabaseEmployees.error || `Merged to ${debugTracker.fetchSupabaseEmployees.mergedCount} active`
      },
      {
        Step: '4. googleSheetsFallback',
        Executed: debugTracker.googleSheetsFallback.executed ? 'Yes' : 'No',
        Status: debugTracker.googleSheetsFallback.skippedReason
          ? '⏭️ Skipped'
          : debugTracker.googleSheetsFallback.success
          ? '✅ Success'
          : '⚠️ No data',
        RecordsLoaded: `${debugTracker.googleSheetsFallback.sheetCount} employees`,
        Notes: debugTracker.googleSheetsFallback.skippedReason || 'Fallback executed'
      }
    ];

    console.table(flowSummary);
    console.log(
      `%c[DB-Debugger] 🏁 Data Initialization Complete! Final Active Employees Count: ${debugTracker.finalStateCount}`,
      'color: #16a34a; font-weight: bold; font-size: 12px;'
    );
    console.groupEnd();

    notifySyncStatus('saved');
  }, []);

  // Check initial session & auto-sync system DB & employee data on boot
  useEffect(() => {
    const session = getSession();
    if (session && session.username) {
      setCurrentUser(session);
      // Strictly enforce business process flow: Landing Page -> Login -> Dashboard
      // Do NOT auto-redirect to dashboard ('app') on initial entrance.
    }

    loadDatabaseFromSource();
  }, [loadDatabaseFromSource]);

  // Check Magic Download Link params on load (?action=download-pdf)
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const action = url.searchParams.get('action');
      if (action === 'download-pdf') {
        const report = url.searchParams.get('report') || 'comprehensive';
        const month = url.searchParams.get('month') || '';
        const year = url.searchParams.get('year') || '';
        const divisi = url.searchParams.get('divisi') || '';
        const dept = url.searchParams.get('dept') || '';

        setMagicLinkParams({
          isOpen: true,
          report,
          month,
          year,
          divisi,
          dept
        });
      }
    } catch (e) {
      console.warn('Error reading URL params:', e);
    }
  }, []);

  // Sync if postMessage received from parent window (e.g. GitHub Pages / GAS iframe wrapper)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'object') return;
      if (event.data.type === 'NAVIGATE') {
        if (event.data.target === 'login') setCurrentScreen('login');
        if (event.data.target === 'dashboard') setCurrentScreen('app');
        if (event.data.target === 'landing') setCurrentScreen('landing');
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Extract periods from current employees
  const periods = useMemo(() => extractPeriods(employees), [employees]);

  // Filtered employees based on 5 multi-select filter bars
  const filteredEmployees = useMemo(
    () => filterEmployees(employees, filters),
    [employees, filters]
  );

  // Real-time Dashboard Stats
  const dashboardStats = useMemo(
    () => computeDashboardStats(filteredEmployees),
    [filteredEmployees]
  );

  // Handle Login
  const handleLoginSuccess = (session: UserSession) => {
    saveSession(session);
    setCurrentUser(session);
    setCurrentScreen('app');
    setActiveTab('dashboard');
    // Reload and refresh employees database automatically from cloud/server upon login
    loadDatabaseFromSource();
  };

  // Handle Direct Logout
  const handleDirectLogout = useCallback(() => {
    clearSession();
    setCurrentUser({
      username: '',
      name: '',
      role: '',
      department: ''
    });
    setCurrentScreen('landing');
  }, []);

  // Handle Logout Confirmation
  const handleRequestLogout = useCallback(() => {
    setConfirmModalConfig({
      isOpen: true,
      title: 'Konfirmasi Keluar Sistem',
      variant: 'logout',
      icon: 'fa-solid fa-arrow-right-from-bracket',
      confirmLabel: 'Ya, Keluar Sesi',
      cancelLabel: 'Tetap di Dashboard',
      description: (
        <div className="space-y-2">
          <p>
            Apakah Anda yakin ingin keluar dari sesi <strong>{currentUser.name || 'HR Development Admin'}</strong>?
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Seluruh data matriks kompetensi yang telah tersimpan tidak akan hilang dan Anda dapat login kembali kapan saja.
          </p>
        </div>
      ),
      onConfirm: () => {
        setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }));
        handleDirectLogout();
      }
    });
  }, [currentUser, handleDirectLogout]);

  // Update Single Skill for an employee
  const handleUpdateSkill = useCallback((rowIndex: number, skillCode: string, checked: boolean) => {
    setEmployees((prev) => {
      const updated = prev.map((emp) => {
        if (emp.rowIndex !== rowIndex) return emp;
        const newSkills = { ...emp.skills, [skillCode]: checked };
        const { totalScore, standard, result, gap, jobCategory } = calculateEmployeeScore(newSkills, emp.jabatan);
        return {
          ...emp,
          skills: newSkills,
          totalScore,
          standard,
          result,
          gap,
          jobCategory
        };
      });
      saveStoredEmployees(updated);
      return updated;
    });
  }, []);

  // Add new employee
  const handleAddEmployee = useCallback((payload: any) => {
    try {
      setEmployees((prev) => {
        const nextRowIndex = prev.length ? Math.max(...prev.map((e) => e.rowIndex)) + 1 : 1;
        const skills: Record<string, boolean> = {};
        const { totalScore, standard, result, gap, jobCategory } = calculateEmployeeScore(skills, payload.jabatan);

        const newEmp: Employee = {
          rowIndex: nextRowIndex,
          no: prev.length + 1,
          empId: payload.empId.trim(),
          empName: payload.empName.trim(),
          divisi: payload.divisi.trim(),
          department: payload.department.trim(),
          section: payload.section.trim(),
          grade: payload.grade.trim(),
          jobGrade: payload.jobGrade.trim(),
          jabatan: payload.jabatan.trim(),
          gender: payload.gender || 'L',
          pic: payload.pic.trim(),
          tahun: Number(payload.tahun),
          bulan: Number(payload.bulan),
          jobCategory,
          skills,
          totalScore,
          standard,
          result,
          gap
        };

        const nextList = [newEmp, ...prev];
        saveStoredEmployees(nextList);
        return nextList;
      });

      return { success: true, message: `Karyawan ${payload.empName} berhasil ditambahkan.` };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Gagal menambahkan karyawan.' };
    }
  }, []);

  // Update employee profile with automatic standard recalculation
  const handleUpdateEmployeeProfile = useCallback((rowIndex: number, payload: any) => {
    let outcome: { success: boolean; message: string } = { success: false, message: 'Gagal memperbarui profil karyawan.' };
    try {
      setEmployees((prev) => {
        const res = updateEmployeeProfile(prev, rowIndex, payload);
        outcome = { success: res.success, message: res.message };
        if (res.success) {
          setToastNotification(res.message);
          return res.employees;
        }
        return prev;
      });
      return outcome;
    } catch (err: any) {
      return { success: false, message: err?.message || 'Gagal memperbarui profil karyawan.' };
    }
  }, []);

  // Delete employee with Rich Confirmation Modal
  const handleDeleteEmployee = useCallback((rowIndex: number, empName: string) => {
    setEmployees((currentEmps) => {
      const targetEmp = currentEmps.find((e) => e.rowIndex === rowIndex);
      
      setConfirmModalConfig({
        isOpen: true,
        title: 'Konfirmasi Hapus Data Karyawan',
        variant: 'danger',
        icon: 'fa-solid fa-user-slash',
        confirmLabel: 'Ya, Hapus Data',
        cancelLabel: 'Batalkan',
        description: (
          <div className="space-y-3">
            <p>
              Apakah Anda yakin ingin menghapus data rekam jejak kompetensi karyawan berikut?
            </p>
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-900 dark:text-rose-200">
              <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <i className="fa-solid fa-id-badge text-rose-500"></i>
                <span>{empName}</span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-1 flex flex-wrap gap-2">
                <span>NIK: <strong>{targetEmp?.empId || '-'}</strong></span>
                <span>&bull;</span>
                <span>Jabatan: <strong>{targetEmp?.jabatan || '-'}</strong></span>
                <span>&bull;</span>
                <span>Dept: <strong>{targetEmp?.department || '-'}</strong></span>
              </div>
            </div>
            <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
              <i className="fa-solid fa-triangle-exclamation mr-1"></i> Data yang telah dihapus tidak dapat dipulihkan kembali kecuali melalui impor ulang.
            </p>
          </div>
        ),
        onConfirm: () => {
          setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }));
          setEmployees((prev) => {
            const targetEmp = prev.find((e) => e.rowIndex === rowIndex);
            const filtered = prev.filter((e) => e.rowIndex !== rowIndex);
            saveStoredEmployees(filtered, { immediateCloudSync: true });
            if (targetEmp) {
              const config = getSupabaseConfig();
              if (config && config.url && config.anonKey) {
                deleteEmployeeFromSupabase(config, targetEmp.empId, targetEmp.tahun, targetEmp.bulan).catch((err) => {
                  console.warn('[Delete Employee] Supabase delete note:', err);
                });
              }
            }
            return filtered;
          });
          setToastNotification(`Data karyawan "${empName}" berhasil dihapus dari database.`);
          setTimeout(() => setToastNotification(null), 4000);
        }
      });

      return currentEmps;
    });
  }, []);

  // Reset Filters - Defaults to current year & month (if data exists) or closest period available
  const handleResetFilters = useCallback(() => {
    const defaultPeriod = getDefaultFilterPeriod(employees);
    setFilters({
      tahun: defaultPeriod.tahun,
      bulan: defaultPeriod.bulan,
      divisi: [],
      department: [],
      jabatan: []
    });
  }, [employees]);

  // Toggle Dark Mode
  const handleToggleDarkMode = useCallback(() => {
    setIsDarkMode((prev) => !prev);
  }, []);

  // Handle Apply Sync from Google Sheets / Supabase / File
  const handleApplySync = useCallback((updatedEmployees: Employee[], message: string) => {
    setEmployees(updatedEmployees);
    saveStoredEmployees(updatedEmployees);
    const defaultPeriod = getDefaultFilterPeriod(updatedEmployees);
    setFilters({
      tahun: defaultPeriod.tahun,
      bulan: defaultPeriod.bulan,
      divisi: [],
      department: [],
      jabatan: []
    });
    setToastNotification(message);
    setTimeout(() => {
      setToastNotification(null);
    }, 6000);
  }, []);

  // Global Keyboard Shortcuts (Ctrl+B, Alt+1/2/3, Alt+T, Alt+I, Alt+X, Alt+P, ?, Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      // Handle Escape for closing shortcuts modal
      if (e.key === 'Escape') {
        if (isShortcutsModalOpen) {
          e.preventDefault();
          setIsShortcutsModalOpen(false);
          return;
        }
      }

      // If user is currently typing inside an input/textarea/select, do not trigger single-key or standard shortcuts
      if (isInput) return;

      // 1. Toggle Sidebar (Ctrl+B or Alt+S)
      if ((e.altKey && (e.key === 's' || e.key === 'S')) || ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B'))) {
        e.preventDefault();
        handleToggleSidebarCollapse();
        return;
      }

      // 2. Open Keyboard Shortcuts Modal (? or Ctrl+/ or Alt+H)
      if (e.key === '?' || ((e.ctrlKey || e.metaKey) && e.key === '/') || (e.altKey && (e.key === 'h' || e.key === 'H'))) {
        e.preventDefault();
        setIsShortcutsModalOpen((prev) => !prev);
        return;
      }

      // 3. Navigate Tabs (Alt+1 = Dashboard, Alt+2 = Data Karyawan, Alt+3 = Settings)
      if (e.altKey && e.key === '1') {
        e.preventDefault();
        setActiveTab('dashboard');
        return;
      }
      if (e.altKey && e.key === '2') {
        e.preventDefault();
        setActiveTab('employee');
        return;
      }
      if (e.altKey && e.key === '3') {
        e.preventDefault();
        setActiveTab('settings');
        return;
      }

      // 4. Toggle Dark Mode (Alt+T)
      if (e.altKey && (e.key === 't' || e.key === 'T')) {
        e.preventDefault();
        handleToggleDarkMode();
        return;
      }

      // 5. Open Import / Sync Modal (Alt+I)
      if (e.altKey && (e.key === 'i' || e.key === 'I')) {
        e.preventDefault();
        setIsImportModalOpen(true);
        return;
      }

      // 6. Open Excel Export Modal (Alt+X)
      if (e.altKey && (e.key === 'x' || e.key === 'X')) {
        e.preventDefault();
        setIsGlobalExcelModalOpen(true);
        return;
      }

      // 7. Open PDF Export Modal (Alt+P)
      if (e.altKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        setIsGlobalPdfModalOpen(true);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleToggleSidebarCollapse,
    handleToggleDarkMode,
    isShortcutsModalOpen
  ]);

  // Screen Routing with Animated Transitions
  return (
    <AnimatePresence mode="wait">
      {currentScreen === 'landing' && (
        <motion.div
          key="screen-landing"
          initial={{ opacity: 0, scale: 0.985 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.985 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="w-full h-full"
        >
          <LandingPage
            employees={employees}
            onEnterLogin={() => setCurrentScreen('login')}
            isDarkMode={isDarkMode}
            onToggleDarkMode={handleToggleDarkMode}
          />
        </motion.div>
      )}

      {currentScreen === 'login' && (
        <motion.div
          key="screen-login"
          initial={{ opacity: 0, scale: 0.97, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: -10 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="w-full h-full"
        >
          <LoginPage
            onLoginSuccess={handleLoginSuccess}
            onBackToLanding={() => setCurrentScreen('landing')}
            isDarkMode={isDarkMode}
            onToggleDarkMode={handleToggleDarkMode}
          />
        </motion.div>
      )}

      {currentScreen === 'app' && (
        <motion.div
          key="screen-app"
          initial={{ opacity: 0, scale: 0.99 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.99 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="flex h-screen w-screen overflow-hidden bg-[#F8FAFC] dark:bg-[#070D19] font-sans text-slate-900 dark:text-slate-100 transition-colors"
        >
          {/* GLOBAL TOAST NOTIFICATION */}
          <AnimatePresence>
            {toastNotification && (
              <motion.div
                initial={{ opacity: 0, y: -30, scale: 0.92, x: 20 }}
                animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
                exit={{ opacity: 0, y: -20, scale: 0.92, x: 20 }}
                transition={{ type: 'spring', stiffness: 450, damping: 28 }}
                className="fixed top-5 right-5 z-50 max-w-md bg-emerald-900/95 text-white px-4 py-3 rounded-2xl shadow-2xl border border-emerald-500/40 flex items-start gap-3 backdrop-blur-md"
              >
                <i className="fa-solid fa-circle-check text-emerald-400 mt-0.5 text-base shrink-0"></i>
                <div className="text-xs leading-relaxed font-semibold flex-1">
                  {toastNotification}
                </div>
                <button
                  onClick={() => setToastNotification(null)}
                  className="text-white/60 hover:text-white shrink-0 ml-1 text-sm cursor-pointer"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* SIDEBAR */}
          <Sidebar
            activeTab={activeTab}
            onSelectTab={setActiveTab}
            onLogout={handleRequestLogout}
            currentUser={currentUser}
            isMobileOpen={isMobileSidebarOpen}
            onCloseMobile={() => setIsMobileSidebarOpen(false)}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={handleToggleSidebarCollapse}
            isDarkMode={isDarkMode}
          />

          {/* MAIN CONTENT WRAPPER */}
          <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[#F8FAFC] dark:bg-[#070D19] transition-colors">
            {/* HEADER */}
            <Header
              activeTab={activeTab}
              currentUser={currentUser}
              onOpenMobileMenu={() => setIsMobileSidebarOpen(true)}
              isDarkMode={isDarkMode}
              onToggleDarkMode={handleToggleDarkMode}
              isSidebarCollapsed={isSidebarCollapsed}
              onToggleSidebarCollapse={handleToggleSidebarCollapse}
              onOpenPdfModal={() => setIsGlobalPdfModalOpen(true)}
              onOpenShortcutsModal={() => setIsShortcutsModalOpen(true)}
            />

            {/* SHARED FILTER BAR */}
            <SharedFilterBar
              filters={filters}
              onFilterChange={setFilters}
              onResetFilters={handleResetFilters}
              periods={periods}
              employees={employees}
            />

            {/* SCROLLABLE MAIN VIEW */}
            <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 relative bg-[#F8FAFC] dark:bg-[#070D19] transition-colors">
              <div className="max-w-7xl mx-auto">
                <AnimatePresence mode="wait">
                  {activeTab === 'dashboard' && (
                    <motion.div
                      key="tab-dashboard"
                      initial={{ opacity: 0, y: 16, scale: 0.985 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -12, scale: 0.99 }}
                      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <DashboardView
                        stats={dashboardStats}
                        isDarkMode={isDarkMode}
                        onOpenPdfModal={() => setIsGlobalPdfModalOpen(true)}
                        onOpenExcelModal={() => setIsGlobalExcelModalOpen(true)}
                      />
                    </motion.div>
                  )}

                  {activeTab === 'employee' && (
                    <motion.div
                      key="tab-employee"
                      initial={{ opacity: 0, y: 16, scale: 0.985 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -12, scale: 0.99 }}
                      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <EmployeeDataView
                        employees={employees}
                        filteredEmployees={filteredEmployees}
                        skillMeta={INITIAL_SKILL_META}
                        periods={periods}
                        onUpdateSkill={handleUpdateSkill}
                        onAddEmployee={handleAddEmployee}
                        onUpdateEmployeeProfile={handleUpdateEmployeeProfile}
                        onDeleteEmployee={handleDeleteEmployee}
                        onOpenImportModal={() => setIsImportModalOpen(true)}
                        onOpenExcelModal={() => setIsGlobalExcelModalOpen(true)}
                        onOpenPdfModal={() => setIsGlobalPdfModalOpen(true)}
                      />
                    </motion.div>
                  )}

                  {activeTab === 'settings' && (
                    <motion.div
                      key="tab-settings"
                      initial={{ opacity: 0, y: 16, scale: 0.985 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -12, scale: 0.99 }}
                      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <SettingsView
                        currentUser={currentUser}
                        employees={employees}
                        filteredEmployees={filteredEmployees}
                        filters={filters}
                        periods={periods}
                        isDarkMode={isDarkMode}
                        onToggleDarkMode={handleToggleDarkMode}
                        onRefreshData={(newEmployees) => {
                          setEmployees(newEmployees);
                          saveStoredEmployees(newEmployees, { immediateCloudSync: true });
                        }}
                        onUpdatePeriodFilter={(targetTahun, targetBulan) => {
                          setFilters((prev) => ({
                            ...prev,
                            tahun: [String(targetTahun)],
                            bulan: [String(targetBulan)]
                          }));
                        }}
                        onOpenImportModal={() => setIsImportModalOpen(true)}
                        onUpdateCurrentUser={(updatedUser) => {
                          saveSession(updatedUser);
                          setCurrentUser(updatedUser);
                        }}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </main>
          </div>

          {/* MODAL IMPORT & CLOUD SYNC */}
          <ImportSyncModal
            isOpen={isImportModalOpen}
            onClose={() => setIsImportModalOpen(false)}
            currentEmployees={employees}
            onApplySync={handleApplySync}
          />

          {/* MODAL GLOBAL EXCEL EXPORT CONFIRMATION */}
          <ExportExcelConfirmModal
            isOpen={isGlobalExcelModalOpen}
            onClose={() => setIsGlobalExcelModalOpen(false)}
            filteredEmployees={filteredEmployees}
            allEmployees={employees}
            filters={filters}
            currentUser={currentUser}
            onExportSuccess={(msg) => {
              setToastNotification(msg);
              setTimeout(() => setToastNotification(null), 5000);
            }}
          />

          {/* MODAL GLOBAL PDF EXPORT (GAS FORMAT RESMI) */}
          <ExportPdfModal
            isOpen={isGlobalPdfModalOpen}
            onClose={() => setIsGlobalPdfModalOpen(false)}
            filteredEmployees={filteredEmployees}
            allEmployees={employees}
            filters={filters}
            currentUser={currentUser}
            onExportSuccess={(msg) => {
              setToastNotification(msg);
              setTimeout(() => setToastNotification(null), 5000);
            }}
          />

          {/* KEYBOARD SHORTCUTS MODAL / PANDUAN PINTASAN KEYBOARD */}
          <KeyboardShortcutsModal
            isOpen={isShortcutsModalOpen}
            onClose={() => setIsShortcutsModalOpen(false)}
            onNavigateTab={(tab) => {
              setActiveTab(tab);
              setIsShortcutsModalOpen(false);
            }}
            onToggleSidebar={handleToggleSidebarCollapse}
            onToggleDarkMode={handleToggleDarkMode}
            onOpenImportModal={() => {
              setIsShortcutsModalOpen(false);
              setIsImportModalOpen(true);
            }}
            onOpenExcelModal={() => {
              setIsShortcutsModalOpen(false);
              setIsGlobalExcelModalOpen(true);
            }}
            onOpenPdfModal={() => {
              setIsShortcutsModalOpen(false);
              setIsGlobalPdfModalOpen(true);
            }}
          />

          {/* GLOBAL RICH CONFIRMATION MODAL */}
          <ConfirmationModal
            isOpen={confirmModalConfig.isOpen}
            title={confirmModalConfig.title}
            description={confirmModalConfig.description}
            confirmLabel={confirmModalConfig.confirmLabel}
            cancelLabel={confirmModalConfig.cancelLabel}
            variant={confirmModalConfig.variant}
            icon={confirmModalConfig.icon}
            singleAction={confirmModalConfig.singleAction}
            isDarkMode={isDarkMode}
            onConfirm={confirmModalConfig.onConfirm}
            onCancel={() => setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }))}
          />
        </motion.div>
      )}

      {/* RECIPIENT MAGIC DOWNLOAD LINK MODAL */}
      <RecipientDownloadModal
        isOpen={magicLinkParams.isOpen}
        onClose={() => setMagicLinkParams((prev) => ({ ...prev, isOpen: false }))}
        employees={employees}
        currentUser={currentUser}
        urlParams={magicLinkParams}
      />
    </AnimatePresence>
  );
}
