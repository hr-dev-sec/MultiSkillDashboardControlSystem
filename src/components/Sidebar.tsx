import React from 'react';
import { AJINOMOTO_LOGO_URL } from '../utils/storage';
import { UserSession } from '../types';

interface SidebarProps {
  activeTab: 'dashboard' | 'employee' | 'settings';
  onSelectTab: (tab: 'dashboard' | 'employee' | 'settings') => void;
  onLogout: () => void;
  currentUser: UserSession;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isDarkMode?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  onLogout,
  currentUser,
  isMobileOpen,
  onCloseMobile,
  isCollapsed,
  onToggleCollapse,
  isDarkMode = false
}) => {
  const userInitial = currentUser.name ? currentUser.name.trim().charAt(0).toUpperCase() : 'U';

  const menuItems = [
    {
      id: 'dashboard' as const,
      label: 'Dashboard',
      subtitle: 'Ringkasan & Analisis KPI',
      icon: 'fa-chart-line',
      badge: 'Aktif'
    },
    {
      id: 'employee' as const,
      label: 'Data Karyawan',
      subtitle: 'Matriks 92 Kompetensi',
      icon: 'fa-users-gear',
      badge: '92 Skill'
    },
    {
      id: 'settings' as const,
      label: 'Pengaturan & Laporan',
      subtitle: 'Tanda Tangan & Unduh Laporan',
      icon: 'fa-file-signature',
      badge: 'Laporan'
    }
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-40 lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        id="sidebar"
        className={`shrink-0 flex flex-col z-50 transition-all duration-300 ease-in-out fixed lg:static top-0 bottom-0 left-0 border-r ${
          isDarkMode
            ? 'text-white border-white/10'
            : 'text-slate-800 bg-white border-slate-200/90 shadow-sm'
        } ${
          isCollapsed ? 'lg:w-20' : 'lg:w-64'
        } w-64 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        style={
          isDarkMode
            ? {
                background: 'linear-gradient(185deg, #0A192F 0%, #0E2340 50%, #081220 100%)',
                boxShadow: '4px 0 24px rgba(0, 0, 0, 0.25)'
              }
            : {
                backgroundColor: '#FFFFFF',
                boxShadow: '2px 0 12px rgba(0, 0, 0, 0.03)'
              }
        }
      >
        {/* Subtle Brand Accent Line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[color:var(--red)] via-[color:var(--gold)] to-[color:var(--emerald)] z-10" />

        {/* Top Header / Branding */}
        <div className={`h-16 flex items-center border-b relative shrink-0 transition-all duration-300 ${
          isDarkMode ? 'border-white/10' : 'border-slate-100'
        } ${
          isCollapsed ? 'justify-center px-2' : 'justify-between px-4'
        }`}>
          {!isCollapsed ? (
            <div className="flex items-center gap-3 min-w-0">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center p-1.5 shrink-0 shadow-md ring-2 transition-transform hover:scale-105 ${
                isDarkMode ? 'bg-white ring-[color:var(--gold-light)]/40' : 'bg-white ring-amber-400/40 border border-slate-200'
              }`}>
                <img src={AJINOMOTO_LOGO_URL} alt="Ajinomoto" className="w-full h-full object-contain" />
              </div>
              <div className="leading-tight min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className={`font-display font-black text-sm tracking-tight truncate ${
                    isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}>
                    Multi-Skill
                  </p>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-400/20 text-amber-600 dark:text-amber-300 border border-amber-400/30">
                    MSM
                  </span>
                </div>
                <p className={`text-[10px] tracking-wide font-semibold truncate ${
                  isDarkMode ? 'text-amber-300/90' : 'text-amber-700'
                }`}>
                  Ajinomoto - Ajinex
                </p>
              </div>
            </div>
          ) : (
            <button
              onClick={onToggleCollapse}
              title="Perbesar Menu Sidebar"
              className={`h-10 w-10 rounded-xl flex items-center justify-center p-1.5 shadow-md ring-2 transition cursor-pointer group hover:scale-110 ${
                isDarkMode ? 'bg-white ring-[color:var(--gold-light)]/40' : 'bg-white ring-amber-400/40 border border-slate-200'
              }`}
            >
              <img src={AJINOMOTO_LOGO_URL} alt="Ajinomoto" className="w-full h-full object-contain" />
            </button>
          )}

          {/* Close button on Mobile */}
          <button
            onClick={onCloseMobile}
            className={`lg:hidden p-1.5 rounded-lg transition ${
              isDarkMode ? 'text-slate-400 hover:text-white bg-white/5 hover:bg-white/10' : 'text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200'
            }`}
            aria-label="Tutup menu"
          >
            <i className="fa-solid fa-xmark text-sm"></i>
          </button>

          {/* Desktop Toggle Button (Inside header when expanded) */}
          {!isCollapsed && (
            <button
              onClick={onToggleCollapse}
              title="Perkecil Sidebar"
              className={`hidden lg:flex h-8 w-8 items-center justify-center rounded-lg transition cursor-pointer border ${
                isDarkMode
                  ? 'bg-white/5 hover:bg-white/15 text-white/70 hover:text-white border-white/10 hover:border-white/20'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border-slate-200'
              }`}
              aria-label="Perkecil Sidebar"
            >
              <i className={`fa-solid fa-angles-left text-xs ${isDarkMode ? 'text-amber-300/90' : 'text-amber-700'}`}></i>
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <nav className={`flex-1 space-y-1.5 relative overflow-y-auto overflow-x-hidden ${
          isCollapsed ? 'px-2 py-4' : 'px-3 py-4'
        }`}>
          {!isCollapsed && (
            <div className="px-3 pb-2 flex items-center justify-between">
              <span className={`text-[10px] font-extrabold uppercase tracking-wider ${
                isDarkMode ? 'text-white/40' : 'text-slate-400'
              }`}>
                Menu Utama
              </span>
              <span className={`text-[9px] font-mono font-semibold ${
                isDarkMode ? 'text-amber-400/60' : 'text-amber-600'
              }`}>
                FACTORY
              </span>
            </div>
          )}

          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <div key={item.id} className="relative group">
                <button
                  onClick={() => {
                    onSelectTab(item.id);
                    onCloseMobile();
                  }}
                  className={`w-full flex items-center rounded-xl text-sm font-semibold transition-all duration-200 relative cursor-pointer ${
                    isCollapsed
                      ? 'justify-center p-3 h-12'
                      : 'gap-3 px-3 py-2.5'
                  } ${
                    isActive
                      ? isDarkMode
                        ? 'text-white bg-white/15 shadow-inner ring-1 ring-white/20'
                        : 'text-amber-900 bg-amber-50 shadow-xs border border-amber-200/80 font-bold'
                      : isDarkMode
                        ? 'text-white/70 hover:text-white hover:bg-white/5'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {/* Left Active Glow Bar */}
                  {isActive && (
                    <span
                      className={`absolute left-0 top-2 bottom-2 w-1.5 rounded-r-md ${
                        item.id === 'dashboard'
                          ? 'bg-amber-500 shadow-[0_0_8px_rgba(251,191,36,0.6)]'
                          : item.id === 'employee'
                          ? 'bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
                          : 'bg-blue-500 shadow-[0_0_8px_rgba(96,165,250,0.6)]'
                      }`}
                    />
                  )}

                  {/* Icon Tile */}
                  <span
                    className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200 text-sm ${
                      isActive
                        ? 'bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 text-slate-950 font-bold shadow-md scale-105'
                        : isDarkMode
                          ? 'bg-white/10 text-white/80 group-hover:bg-white/20 group-hover:text-white'
                          : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200 group-hover:text-slate-900'
                    }`}
                  >
                    <i className={`fa-solid ${item.icon}`}></i>
                  </span>

                  {/* Label & Details (Expanded Only) */}
                  {!isCollapsed && (
                    <div className="flex-1 text-left min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="truncate leading-snug">{item.label}</span>
                        {isActive && (
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                            isDarkMode
                              ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}>
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <p className={`text-[10px] font-normal truncate ${
                        isDarkMode ? 'text-white/50' : 'text-slate-400'
                      }`}>
                        {item.subtitle}
                      </p>
                    </div>
                  )}

                  {!isCollapsed && (
                    <i
                      className={`fa-solid fa-chevron-right text-[10px] transition-transform duration-200 ${
                        isActive
                          ? isDarkMode ? 'text-amber-300 translate-x-0.5' : 'text-amber-700 translate-x-0.5'
                          : isDarkMode ? 'text-white/20 group-hover:text-white/50 group-hover:translate-x-0.5' : 'text-slate-300 group-hover:text-slate-600 group-hover:translate-x-0.5'
                      }`}
                    ></i>
                  )}
                </button>

                {/* Collapsed Tooltip (Desktop Only) */}
                {isCollapsed && (
                  <div className={`hidden lg:group-hover:flex absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 flex-col py-1.5 px-3 rounded-xl text-xs font-semibold shadow-2xl backdrop-blur-md pointer-events-none whitespace-nowrap animate-in fade-in zoom-in-95 duration-150 min-w-[150px] ${
                    isDarkMode
                      ? 'bg-slate-900/95 border border-white/20 text-white'
                      : 'bg-white border border-slate-200 text-slate-900 shadow-xl'
                  }`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-amber-600 dark:text-amber-300">{item.label}</span>
                      <span className={`text-[9px] font-bold px-1 py-0.2 rounded ${
                        isDarkMode ? 'bg-white/10 text-white/80' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {item.badge}
                      </span>
                    </div>
                    <span className={`text-[10px] font-normal ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>{item.subtitle}</span>
                    <div className={`absolute top-1/2 -translate-y-1/2 -left-1.5 w-3 h-3 rotate-45 ${
                      isDarkMode ? 'bg-slate-900 border-l border-b border-white/20' : 'bg-white border-l border-b border-slate-200'
                    }`} />
                  </div>
                )}
              </div>
            );
          })}

          {/* Divider */}
          <div className={`my-4 border-t ${isDarkMode ? 'border-white/10' : 'border-slate-200/80'}`} />

          {/* User Account Card */}
          {!isCollapsed ? (
            <div className="px-1">
              <div className={`px-2 pb-1.5 text-[10px] font-extrabold uppercase tracking-wider flex items-center justify-between ${
                isDarkMode ? 'text-white/40' : 'text-slate-400'
              }`}>
                <span>Pengguna Aktif</span>
                <span className="flex items-center gap-1 text-[9px] text-emerald-600 dark:text-emerald-400 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Online
                </span>
              </div>
              <div className={`rounded-xl p-2.5 flex items-center gap-3 transition ${
                isDarkMode
                  ? 'bg-white/5 border border-white/10 hover:bg-white/10'
                  : 'bg-slate-50 border border-slate-200/90 hover:bg-slate-100'
              }`}>
                {currentUser.avatarUrl ? (
                  <img
                    key={currentUser.avatarUrl}
                    src={currentUser.avatarUrl}
                    alt={currentUser.name || 'Avatar'}
                    className="w-9 h-9 rounded-lg object-cover object-center shadow-sm shrink-0 ring-1 ring-amber-400/50 bg-slate-900"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-black flex items-center justify-center text-sm shadow-sm shrink-0">
                    {userInitial}
                  </div>
                )}
                <div className="leading-tight min-w-0 flex-1">
                  <p className={`text-xs font-bold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{currentUser.name || 'Mahmud Nurdiansyah'}</p>
                  <p className={`text-[10px] truncate font-semibold ${isDarkMode ? 'text-amber-300/80' : 'text-amber-700'}`}>{currentUser.role || 'HR Admin'}</p>
                  <p className={`text-[9px] truncate ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>{currentUser.department || 'HR Development'}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative group flex justify-center">
              {currentUser.avatarUrl ? (
                <div className="relative">
                  <img
                    key={currentUser.avatarUrl}
                    src={currentUser.avatarUrl}
                    alt={currentUser.name || 'Avatar'}
                    className="w-10 h-10 rounded-xl object-cover object-center shadow-md cursor-default ring-2 ring-amber-400/50 bg-slate-900"
                  />
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-black flex items-center justify-center text-sm shadow-md cursor-default relative">
                  {userInitial}
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
                </div>
              )}
              {/* Tooltip for user avatar */}
              <div className={`hidden lg:group-hover:flex absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 flex-col py-1.5 px-3 rounded-xl text-xs font-semibold shadow-2xl backdrop-blur-md pointer-events-none whitespace-nowrap min-w-[160px] ${
                isDarkMode
                  ? 'bg-slate-900/95 border border-white/20 text-white'
                  : 'bg-white border border-slate-200 text-slate-900 shadow-xl'
              }`}>
                <p className="font-bold truncate">{currentUser.name}</p>
                <p className="text-[10px] text-amber-600 dark:text-amber-300 font-semibold">{currentUser.role}</p>
                <p className="text-[9px] text-slate-400">{currentUser.department}</p>
                <div className={`absolute top-1/2 -translate-y-1/2 -left-1.5 w-3 h-3 rotate-45 ${
                  isDarkMode ? 'bg-slate-900 border-l border-b border-white/20' : 'bg-white border-l border-b border-slate-200'
                }`} />
              </div>
            </div>
          )}
        </nav>

        {/* Footer & Toggle Action */}
        <div className={`border-t relative shrink-0 ${
          isDarkMode ? 'border-white/10' : 'border-slate-200/80'
        } ${
          isCollapsed ? 'p-2 space-y-2' : 'p-3 space-y-2'
        }`}>
          {/* Collapse/Expand Toggle Button (Desktop bottom) */}
          <button
            onClick={onToggleCollapse}
            className={`hidden lg:flex w-full items-center rounded-xl text-xs font-semibold transition group cursor-pointer ${
              isDarkMode
                ? 'text-white/70 hover:text-white bg-white/5 hover:bg-white/15 border border-white/10'
                : 'text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200'
            } ${
              isCollapsed ? 'justify-center h-10' : 'gap-2.5 px-3 py-2'
            }`}
            title={isCollapsed ? 'Perbesar Sidebar (Klik)' : 'Perkecil Sidebar (Klik)'}
          >
            <i
              className={`fa-solid ${
                isCollapsed ? 'fa-angles-right' : 'fa-angles-left'
              } text-xs transition-transform group-hover:scale-110 ${isDarkMode ? 'text-amber-300' : 'text-amber-700'}`}
            ></i>
            {!isCollapsed && (
              <div className="flex-1 flex items-center justify-between">
                <span>Perkecil Sidebar</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                  isDarkMode ? 'bg-white/10 text-white/50' : 'bg-slate-200/70 text-slate-600'
                }`}>
                  Alt+S
                </span>
              </div>
            )}
          </button>

          {/* Logout Button */}
          <div className="relative group">
            <button
              onClick={onLogout}
              className={`w-full flex items-center rounded-xl text-xs sm:text-sm font-semibold transition group cursor-pointer ${
                isDarkMode
                  ? 'text-red-200 hover:text-white bg-red-500/10 hover:bg-red-600/90 border border-red-500/20 hover:border-red-500'
                  : 'text-red-700 hover:text-red-900 bg-red-50 hover:bg-red-100 border border-red-200 hover:border-red-300'
              } ${
                isCollapsed ? 'justify-center h-10' : 'gap-3 px-3 py-2.5'
              }`}
            >
              <span className={`flex items-center justify-center shrink-0 ${
                isCollapsed ? 'text-red-500 text-sm' : 'h-7 w-7 rounded-lg bg-red-500/10 dark:bg-red-500/20'
              }`}>
                <i className="fa-solid fa-right-from-bracket text-red-600 dark:text-red-300 text-xs"></i>
              </span>
              {!isCollapsed && <span>Keluar Sistem</span>}
            </button>

            {isCollapsed && (
              <div className="hidden lg:group-hover:flex absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 py-1.5 px-3 rounded-xl bg-red-950/95 border border-red-500/40 text-red-100 text-xs font-bold shadow-2xl backdrop-blur-md pointer-events-none whitespace-nowrap">
                Keluar Sesi (Logout)
                <div className="absolute top-1/2 -translate-y-1/2 -left-1.5 w-3 h-3 bg-red-950 border-l border-b border-red-500/40 rotate-45" />
              </div>
            )}
          </div>

          {!isCollapsed && (
            <p className={`text-center pt-1 text-[9px] tracking-wider font-mono ${
              isDarkMode ? 'text-white/30' : 'text-slate-400'
            }`}>
              MSM AJINOMOTO &bull; v2.2
            </p>
          )}
        </div>
      </aside>
    </>
  );
};
