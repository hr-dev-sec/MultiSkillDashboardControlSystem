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
  mergeEmployeesData
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

  // Auto-fetch data from Server DB / Supabase Cloud / Google Sheets on boot & login across all devices
  const loadDatabaseFromSource = useCallback(async () => {
    let hasLoadedFromCloud = false;

    // 1. First sync persistent config and profiles from Server DB
    try {
      const res = await syncSystemFromBackend();
      if (res) {
        const refreshedSession = getSession();
        if (refreshedSession && refreshedSession.username) {
          setCurrentUser(refreshedSession);
        }
      }

      // Check if Server has persistent real employee records
      const serverEmps = await fetchEmployeesFromServer();
      if (serverEmps && Array.isArray(serverEmps) && serverEmps.length > 0) {
        const currentLocal = getStoredEmployees();
        // Smart merge: gabungkan data server dengan data lokal agar periode yang diduplikasi tidak terhapus
        const merged = mergeEmployeesData(currentLocal, serverEmps, 'merge').updatedEmployees;
        setEmployees(merged);
        saveStoredEmployees(merged);
        const defaultPeriod = getDefaultFilterPeriod(merged);
        setFilters((prev) => ({
          ...prev,
          tahun: defaultPeriod.tahun,
          bulan: defaultPeriod.bulan
        }));
        hasLoadedFromCloud = true;
        console.log(`[Server Sync] Berhasil memuat & menyelaraskan ${merged.length} karyawan dari Server DB.`);
      }
    } catch (e) {
      console.warn('System init backend note:', e);
    }

    // 2. Fetch employee data from Supabase Cloud automatically if configured
    const config = getSupabaseConfig();
    if (config.url && config.anonKey) {
      try {
        const res = await fetchSupabaseEmployees(config);
        if (res.success && res.data && res.data.length > 0) {
          const currentLocal = getStoredEmployees();
          const merged = mergeEmployeesData(currentLocal, res.data, 'merge').updatedEmployees;
          setEmployees(merged);
          saveStoredEmployees(merged);
          saveEmployeesToServer(merged).catch(() => {});
          
          // Otomatis sesuaikan filter periode aktif dengan data terbaru yang ditarik dari Cloud
          const defaultPeriod = getDefaultFilterPeriod(merged);
          setFilters((prev) => ({
            ...prev,
            tahun: defaultPeriod.tahun,
            bulan: defaultPeriod.bulan
          }));
          
          hasLoadedFromCloud = true;
          console.log(`[Cloud Sync] Otomatis memuat & menyelaraskan ${merged.length} karyawan dari Supabase Cloud.`);
        }
      } catch (err) {
        console.warn('[Cloud Sync] Gagal sinkronisasi Supabase:', err);
      }
    }

    // 3. Fallback: Jika belum termuat dari Server/Cloud, tarik otomatis dari Google Sheet Master
    if (!hasLoadedFromCloud) {
      const defaultSheet = getSavedGoogleSheetUrl();
      if (defaultSheet) {
        try {
          const sheetRes = await fetchGoogleSheetData(defaultSheet);
          if (sheetRes.success && sheetRes.data && sheetRes.data.length > 0) {
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
            
            hasLoadedFromCloud = true;
            console.log(`[Google Sheet Sync] Otomatis memuat ${sheetRes.data.length} karyawan dari Google Sheet Master.`);
          }
        } catch (sheetErr) {
          console.warn('[Google Sheet Sync] Gagal sinkronisasi Google Sheet:', sheetErr);
        }
      }
    }
  }, []);

  // Check initial session & auto-sync system DB & employee data on boot
  useEffect(() => {
    const session = getSession();
    if (session) {
      setCurrentUser(session);
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
