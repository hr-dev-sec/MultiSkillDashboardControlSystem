import React, { useState, useEffect } from 'react';
import { UserSession } from '../types';
import { onDatabaseSyncStatusChange, DatabaseSyncStatus } from '../utils/syncService';

interface HeaderProps {
  activeTab: 'dashboard' | 'employee' | 'settings';
  currentUser: UserSession;
  onOpenMobileMenu: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  isSidebarCollapsed: boolean;
  onToggleSidebarCollapse: () => void;
  onOpenPdfModal?: () => void;
  onOpenShortcutsModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  currentUser,
  onOpenMobileMenu,
  isDarkMode,
  onToggleDarkMode,
  isSidebarCollapsed,
  onToggleSidebarCollapse,
  onOpenPdfModal,
  onOpenShortcutsModal
}) => {
  const [timeStr, setTimeStr] = useState<string>('');
  const [dbSyncStatus, setDbSyncStatus] = useState<DatabaseSyncStatus>('saved');
  const [lastSavedTime, setLastSavedTime] = useState<string>('');

  // Live Database Sync Listener
  useEffect(() => {
    const unsub = onDatabaseSyncStatusChange((status, lastSavedAt) => {
      setDbSyncStatus(status);
      if (lastSavedAt) {
        setLastSavedTime(
          lastSavedAt.toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })
        );
      }
    });
    return unsub;
  }, []);

  // Live Factory Clock in WIB
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const formatted = now.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      setTimeStr(formatted + ' WIB');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const tabConfig = {
    dashboard: {
      title: 'Dashboard Pemantauan Multi-Skill',
      tag: 'Analisis & KPI',
      icon: 'fa-chart-line',
      color: 'from-amber-500 to-amber-600'
    },
    employee: {
      title: 'Matriks Kompetensi Karyawan',
      tag: '92 Standar Multi-Skill',
      icon: 'fa-users-gear',
      color: 'from-emerald-500 to-emerald-600'
    },
    settings: {
      title: 'Pengaturan & Laporan Distribusi',
      tag: 'Tanda Tangan & Unduh Laporan',
      icon: 'fa-file-signature',
      color: 'from-blue-500 to-blue-600'
    }
  };

  const currentTab = tabConfig[activeTab];
  const userInitial = currentUser.name ? currentUser.name.trim().charAt(0).toUpperCase() : 'U';

  return (
    <header
      className="h-16 shrink-0 bg-white/95 dark:bg-[#0A192F]/95 backdrop-blur-md border-b border-slate-200/90 dark:border-white/10 flex items-center justify-between px-3 sm:px-6 gap-3 relative z-40 transition-all shadow-xs"
    >
      {/* Left: Sidebar Toggle & Page Title */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile Hamburger */}
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden h-9 w-9 shrink-0 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition cursor-pointer"
          aria-label="Buka Menu Sidebar"
        >
          <i className="fa-solid fa-bars text-sm"></i>
        </button>

        {/* Desktop Sidebar Collapse Toggle */}
        <button
          onClick={onToggleSidebarCollapse}
          className="hidden lg:flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700 transition cursor-pointer group shadow-2xs"
          title={isSidebarCollapsed ? 'Perbesar Sidebar (Alt+S)' : 'Perkecil Sidebar (Alt+S)'}
          aria-label="Toggle Sidebar"
        >
          <i
            className={`fa-solid ${
              isSidebarCollapsed ? 'fa-bars-staggered' : 'fa-bars'
            } text-sm transition-transform group-hover:scale-110`}
          ></i>
        </button>

        {/* Divider */}
        <div className="hidden lg:block h-6 w-px bg-slate-200 dark:bg-slate-800" />

        {/* Page Title & Breadcrumb */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Mojokerto Plant
            </span>
            <span className="hidden md:inline text-xs text-slate-400">&bull;</span>
            <span className="hidden md:inline text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              {currentTab.tag}
            </span>
          </div>
          <h1 className="font-display font-extrabold text-slate-900 dark:text-white text-sm sm:text-base lg:text-lg truncate leading-tight flex items-center gap-2">
            <span>{currentTab.title}</span>
          </h1>
        </div>
      </div>

      {/* Right: Clock, Auto-Save Status, Theme Toggle & User Info */}
      <div className="flex items-center gap-2.5 sm:gap-3.5 shrink-0">
        {/* Live Database Auto-Save Status Indicator */}
        <div
          className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-xs transition-all shadow-2xs bg-slate-100/80 dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700/80"
          title={
            dbSyncStatus === 'saving'
              ? 'Sedang menyimpan perubahan ke database...'
              : `Semua perubahan data otomatis tersimpan ke database ${lastSavedTime ? `(terakhir pukul ${lastSavedTime} WIB)` : ''}. Tidak perlu push manual.`
          }
        >
          {dbSyncStatus === 'saving' ? (
            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold">
              <i className="fa-solid fa-circle-notch animate-spin text-[11px]"></i>
              <span className="text-[11px]">Menyimpan ke DB...</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <i className="fa-solid fa-cloud-arrow-up text-[11px]"></i>
              <span className="text-[11px] hidden lg:inline">Auto-Saved to DB</span>
              <span className="text-[11px] lg:hidden">Saved</span>
            </div>
          )}
        </div>

        {/* Factory Live Clock */}
        <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-xs font-mono text-slate-700 dark:text-slate-300 shadow-2xs">
          <i className="fa-regular fa-clock text-amber-600 dark:text-amber-400 text-xs"></i>
          <span className="font-bold tracking-tight">{timeStr || '00:00:00 WIB'}</span>
        </div>

        {/* Quick Report PDF Button */}
        {onOpenPdfModal && (
          <button
            type="button"
            onClick={onOpenPdfModal}
            className="h-9 px-3 rounded-xl flex items-center gap-2 transition-all duration-200 cursor-pointer border shadow-xs bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/40 dark:hover:bg-red-900/60 dark:text-red-300 border-red-200 dark:border-red-800"
            title="Cetak & Unduh Laporan PDF Resmi Standar PT Ajinomoto Indonesia (Alt+P)"
          >
            <i className="fa-solid fa-file-pdf text-red-600 dark:text-red-400 text-sm"></i>
            <span className="text-xs font-bold hidden sm:inline">Laporan PDF</span>
          </button>
        )}

        {/* Keyboard Shortcuts Trigger with Non-Intrusive Tooltip */}
        {onOpenShortcutsModal && (
          <div className="relative group">
            <button
              type="button"
              onClick={onOpenShortcutsModal}
              className="h-9 px-2.5 sm:px-3 rounded-xl flex items-center gap-1.5 transition-all duration-200 cursor-pointer border shadow-xs bg-slate-100 hover:bg-amber-50 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 border-slate-200/80 dark:border-slate-700 group-hover:border-amber-400"
              aria-label="Pintasan Keyboard"
            >
              <i className="fa-solid fa-keyboard text-xs text-amber-600 dark:text-amber-400"></i>
              <span className="text-xs font-bold hidden lg:inline">Shortcuts</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 shadow-2xs">
                ?
              </kbd>
            </button>

            {/* Quick Non-Intrusive Preview Tooltip on Hover */}
            <div className="hidden lg:group-hover:block absolute right-0 top-[calc(100%+8px)] w-72 p-3.5 rounded-2xl bg-slate-900/98 dark:bg-[#060D17]/98 backdrop-blur-xl border border-slate-700/90 dark:border-white/20 text-white shadow-[0_20px_50px_rgba(0,0,0,0.4)] z-[60] pointer-events-none transition-all animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 dark:border-white/10">
                <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1.5">
                  <i className="fa-solid fa-bolt text-xs"></i>
                  Pintasan Cepat Keyboard
                </span>
                <span className="text-[10px] text-slate-400 bg-slate-800/80 dark:bg-slate-800 px-1.5 py-0.5 rounded">Klik untuk semua</span>
              </div>
              <div className="space-y-2 text-[11px]">
                <div className="flex items-center justify-between text-slate-200">
                  <span className="font-medium">Toggle Sidebar</span>
                  <kbd className="px-2 py-0.5 rounded bg-slate-800 dark:bg-slate-800 font-mono text-[10px] font-bold text-amber-300 border border-slate-700">
                    Ctrl + B
                  </kbd>
                </div>
                <div className="flex items-center justify-between text-slate-200">
                  <span className="font-medium">Pindah Halaman</span>
                  <kbd className="px-2 py-0.5 rounded bg-slate-800 dark:bg-slate-800 font-mono text-[10px] font-bold text-amber-300 border border-slate-700">
                    Alt + 1 / 2 / 3
                  </kbd>
                </div>
                <div className="flex items-center justify-between text-slate-200">
                  <span className="font-medium">Ganti Mode Tema</span>
                  <kbd className="px-2 py-0.5 rounded bg-slate-800 dark:bg-slate-800 font-mono text-[10px] font-bold text-amber-300 border border-slate-700">
                    Alt + T
                  </kbd>
                </div>
                <div className="flex items-center justify-between text-slate-200">
                  <span className="font-medium">Buka Dialog PDF</span>
                  <kbd className="px-2 py-0.5 rounded bg-slate-800 dark:bg-slate-800 font-mono text-[10px] font-bold text-amber-300 border border-slate-700">
                    Alt + P
                  </kbd>
                </div>
                <div className="flex items-center justify-between text-slate-200">
                  <span className="font-medium">Ekspor Spreadsheet</span>
                  <kbd className="px-2 py-0.5 rounded bg-slate-800 dark:bg-slate-800 font-mono text-[10px] font-bold text-amber-300 border border-slate-700">
                    Alt + X
                  </kbd>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Theme Quick Switcher Pill */}
        <button
          type="button"
          onClick={onToggleDarkMode}
          className={`h-9 px-3 rounded-xl flex items-center gap-2 transition-all duration-200 cursor-pointer border shadow-sm group select-none ${
            isDarkMode
              ? 'bg-slate-900 hover:bg-slate-800 border-amber-500/40 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
              : 'bg-amber-50/90 hover:bg-amber-100/90 border-amber-300/80 text-amber-900 shadow-amber-500/10'
          }`}
          title={isDarkMode ? 'Saat ini: Mode Gelap. Klik untuk beralih ke Mode Terang' : 'Saat ini: Mode Terang. Klik untuk beralih ke Mode Gelap'}
          aria-label="Toggle Dark / Light Mode"
        >
          <div
            className={`w-5 h-5 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110 ${
              isDarkMode
                ? 'bg-amber-400/20 text-amber-300 ring-1 ring-amber-400/40'
                : 'bg-amber-500 text-white shadow-xs'
            }`}
          >
            <i className={`fa-solid ${isDarkMode ? 'fa-moon text-xs' : 'fa-sun text-xs'}`}></i>
          </div>
          <div className="text-left hidden md:block">
            <p className="text-[11px] font-extrabold tracking-tight leading-none">
              {isDarkMode ? 'Mode Gelap' : 'Mode Terang'}
            </p>
            <p className="text-[9px] opacity-75 font-semibold leading-none mt-0.5">
              {isDarkMode ? 'Midnight Cyber' : 'Daylight Pro'}
            </p>
          </div>
        </button>

        {/* User Card */}
        <div className="flex items-center gap-2.5 pl-1 sm:pl-2 border-l border-slate-200 dark:border-slate-800">
          <div className="text-right hidden sm:block leading-tight">
            <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 truncate max-w-[140px] lg:max-w-[200px]">
              {currentUser.name || 'Mahmud Nurdiansyah'}
            </p>
            <p className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate font-medium">
              <span className="text-amber-700 dark:text-amber-400 font-semibold">{currentUser.role || 'HR Admin'}</span>
            </p>
          </div>

          {currentUser.avatarUrl ? (
            <img
              key={currentUser.avatarUrl}
              src={currentUser.avatarUrl}
              alt={currentUser.name || 'User Avatar'}
              className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl object-cover object-center shadow-sm shrink-0 ring-2 ring-amber-400/50 bg-slate-900"
              title={`${currentUser.name || 'Admin'} (${currentUser.role || 'HR Admin'})`}
            />
          ) : (
            <div
              className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center text-slate-950 font-black shadow-sm shrink-0 text-sm ring-2 ring-amber-400/50"
              style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}
              title={`${currentUser.name || 'Admin'} (${currentUser.role || 'HR Admin'})`}
            >
              {userInitial}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
