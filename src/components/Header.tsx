import React, { useState, useEffect } from 'react';
import { UserSession, AppTab } from '../types';
import { onDatabaseSyncStatusChange, DatabaseSyncStatus } from '../utils/syncService';

interface HeaderProps {
  activeTab: AppTab;
  currentUser: UserSession;
  onOpenMobileMenu: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  isSidebarCollapsed: boolean;
  onToggleSidebarCollapse: () => void;
  onOpenPdfModal?: () => void;
  onOpenShortcutsModal?: () => void;
  onSelectTab?: (tab: AppTab) => void;
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
  onOpenShortcutsModal,
  onSelectTab
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
    presentation: {
      title: 'Presentasi & Laporan Top Management',
      tag: 'Executive Briefing & Boardroom Deck',
      icon: 'fa-chalkboard-user',
      color: 'from-amber-500 via-indigo-600 to-[#0E2340]'
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
      id="main-header"
      className="min-h-16 h-16 shrink-0 bg-white/95 dark:bg-[#0A192F]/95 backdrop-blur-md border-b border-slate-200/90 dark:border-white/10 flex items-center justify-between px-3 sm:px-5 lg:px-6 gap-2 sm:gap-3 relative z-40 transition-colors shadow-2xs"
    >
      {/* Left: Sidebar Toggle & Page Title */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
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
        <div className="hidden sm:block h-6 w-px bg-slate-200 dark:bg-slate-800 shrink-0" />

        {/* Page Title & Breadcrumb */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 leading-none mb-0.5">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Mojokerto Plant
            </span>
            <span className="hidden sm:inline text-[10px] text-slate-400">&bull;</span>
            <span className="hidden sm:inline text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate max-w-[180px] xl:max-w-xs">
              {currentTab.tag}
            </span>
          </div>
          <h1 className="font-display font-extrabold text-slate-900 dark:text-white text-xs sm:text-sm lg:text-base truncate leading-tight tracking-tight">
            {currentTab.title}
          </h1>
        </div>
      </div>

      {/* Right: Status, Actions, Theme Toggle & User Info */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Live Database Auto-Save Status Indicator */}
        <div
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs transition-all shadow-2xs bg-slate-100/80 dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700/80"
          title={
            dbSyncStatus === 'saving'
              ? 'Sedang menyimpan perubahan ke database...'
              : `Semua perubahan data otomatis tersimpan ke database ${lastSavedTime ? `(terakhir pukul ${lastSavedTime} WIB)` : ''}. Tidak perlu push manual.`
          }
        >
          {dbSyncStatus === 'saving' ? (
            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold">
              <i className="fa-solid fa-circle-notch animate-spin text-[10px]"></i>
              <span className="text-[11px] hidden xl:inline">Menyimpan...</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <i className="fa-solid fa-cloud-arrow-up text-[10px]"></i>
              <span className="text-[11px] hidden xl:inline">Auto-Saved</span>
            </div>
          )}
        </div>

        {/* Factory Live Clock */}
        <div className="hidden 2xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-xs font-mono text-slate-700 dark:text-slate-300 shadow-2xs">
          <i className="fa-regular fa-clock text-amber-600 dark:text-amber-400 text-xs"></i>
          <span className="font-bold tracking-tight text-[11px]">{timeStr || '00:00:00 WIB'}</span>
        </div>

        {/* Presentasi Direksi / Top Management Trigger */}
        {onSelectTab && (
          <button
            type="button"
            onClick={() => onSelectTab(activeTab === 'presentation' ? 'dashboard' : 'presentation')}
            className={`h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl flex items-center gap-1.5 transition-all duration-200 cursor-pointer border shadow-2xs ${
              activeTab === 'presentation'
                ? 'bg-amber-400 hover:bg-amber-500 text-slate-950 border-amber-500 font-black shadow-xs'
                : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 dark:text-indigo-200 border-indigo-200 dark:border-indigo-800 font-bold'
            }`}
            title="Buka Mode Presentasi & Laporan Direksi (Top Management Briefing)"
          >
            <i className={`fa-solid fa-chalkboard-user text-xs ${activeTab === 'presentation' ? 'text-slate-950' : 'text-indigo-600 dark:text-indigo-400'}`}></i>
            <span className="text-xs hidden md:inline">
              {activeTab === 'presentation' ? 'Tutup Presentasi' : 'Presentasi'}
            </span>
          </button>
        )}

        {/* Quick Report PDF Button */}
        {onOpenPdfModal && (
          <button
            type="button"
            onClick={onOpenPdfModal}
            className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl flex items-center gap-1.5 transition-all duration-200 cursor-pointer border shadow-2xs bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-300 border-rose-200 dark:border-rose-800 font-bold text-xs"
            title="Cetak & Unduh Laporan PDF Resmi Standar PT Ajinomoto Indonesia (Alt+P)"
          >
            <i className="fa-solid fa-file-pdf text-rose-600 dark:text-rose-400 text-xs"></i>
            <span className="hidden sm:inline">PDF</span>
          </button>
        )}

        {/* Keyboard Shortcuts Trigger with Non-Intrusive Tooltip */}
        {onOpenShortcutsModal && (
          <div className="relative group hidden sm:block">
            <button
              type="button"
              onClick={onOpenShortcutsModal}
              className="h-8 sm:h-9 px-2 sm:px-2.5 rounded-xl flex items-center gap-1 transition-all duration-200 cursor-pointer border shadow-2xs bg-slate-100 hover:bg-amber-50 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 border-slate-200/80 dark:border-slate-700 group-hover:border-amber-400"
              aria-label="Pintasan Keyboard"
              title="Pintasan Keyboard (?)"
            >
              <i className="fa-solid fa-keyboard text-xs text-amber-600 dark:text-amber-400"></i>
              <kbd className="inline-block px-1 py-0.2 rounded text-[10px] font-mono font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300">
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
          className={`h-8 sm:h-9 px-2 sm:px-2.5 rounded-xl flex items-center gap-1.5 transition-all duration-200 cursor-pointer border shadow-2xs group select-none ${
            isDarkMode
              ? 'bg-slate-900 hover:bg-slate-800 border-amber-500/40 text-amber-300'
              : 'bg-amber-50 hover:bg-amber-100 border-amber-300/80 text-amber-900'
          }`}
          title={isDarkMode ? 'Mode Gelap Aktif (Klik untuk Mode Terang)' : 'Mode Terang Aktif (Klik untuk Mode Gelap)'}
          aria-label="Toggle Dark / Light Mode"
        >
          <div
            className={`w-5 h-5 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110 ${
              isDarkMode
                ? 'bg-amber-400/20 text-amber-300 ring-1 ring-amber-400/40'
                : 'bg-amber-500 text-white shadow-2xs'
            }`}
          >
            <i className={`fa-solid ${isDarkMode ? 'fa-moon text-[11px]' : 'fa-sun text-[11px]'}`}></i>
          </div>
          <span className="text-[11px] font-extrabold hidden xl:inline">
            {isDarkMode ? 'Dark' : 'Light'}
          </span>
        </button>

        {/* User Card */}
        <div className="flex items-center gap-2 pl-1.5 sm:pl-2 border-l border-slate-200 dark:border-slate-800">
          <div className="text-right hidden xl:block leading-tight">
            <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate max-w-[120px] 2xl:max-w-[160px]">
              {currentUser.name || 'Mahmud Nurdiansyah'}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate font-medium">
              <span className="text-amber-700 dark:text-amber-400 font-semibold">{currentUser.role || 'HR Admin'}</span>
            </p>
          </div>

          {currentUser.avatarUrl ? (
            <img
              key={currentUser.avatarUrl}
              src={currentUser.avatarUrl}
              alt={currentUser.name || 'User Avatar'}
              className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl object-cover object-center shadow-xs shrink-0 ring-2 ring-amber-400/50 bg-slate-900"
              title={`${currentUser.name || 'Admin'} (${currentUser.role || 'HR Admin'})`}
            />
          ) : (
            <div
              className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl flex items-center justify-center text-slate-950 font-black shadow-xs shrink-0 text-xs sm:text-sm ring-2 ring-amber-400/50"
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
