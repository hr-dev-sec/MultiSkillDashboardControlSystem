import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export interface ShortcutItem {
  id: string;
  category: 'navigation' | 'actions' | 'view';
  keys: string[];
  label: string;
  description: string;
  action?: () => void;
}

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: 'dashboard' | 'employee' | 'settings') => void;
  onToggleSidebar: () => void;
  onToggleDarkMode: () => void;
  onOpenImportModal: () => void;
  onOpenExcelModal: () => void;
  onOpenPdfModal: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  onToggleSidebar,
  onToggleDarkMode,
  onOpenImportModal,
  onOpenExcelModal,
  onOpenPdfModal
}) => {
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState<'ALL' | 'navigation' | 'actions' | 'view'>('ALL');
  const [searchFilter, setSearchFilter] = useState('');

  // Detect Mac vs Windows/Linux
  const isMac = typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const modKey = isMac ? '⌘' : 'Ctrl';

  const shortcuts: ShortcutItem[] = [
    {
      id: 'sidebar',
      category: 'navigation',
      keys: [modKey, 'B'],
      label: 'Toggle Sidebar Menu',
      description: 'Minimalkan atau lebarkan panel navigasi sebelah kiri',
      action: onToggleSidebar
    },
    {
      id: 'sidebar-alt',
      category: 'navigation',
      keys: ['Alt', 'S'],
      label: 'Alternatif Toggle Sidebar',
      description: 'Pintasan cepat alternatif untuk menciutkan sidebar',
      action: onToggleSidebar
    },
    {
      id: 'tab-dashboard',
      category: 'navigation',
      keys: ['Alt', '1'],
      label: 'Buka Dashboard Analisis',
      description: 'Langsung menuju halaman Ringkasan & KPI Multi-Skill',
      action: () => onNavigateTab('dashboard')
    },
    {
      id: 'tab-employee',
      category: 'navigation',
      keys: ['Alt', '2'],
      label: 'Buka Data Karyawan',
      description: 'Langsung menuju Matriks 92 Standar Kompetensi',
      action: () => onNavigateTab('employee')
    },
    {
      id: 'tab-settings',
      category: 'navigation',
      keys: ['Alt', '3'],
      label: 'Buka Pengaturan & Laporan',
      description: 'Menuju form tanda tangan, master user, & distribusi',
      action: () => onNavigateTab('settings')
    },
    {
      id: 'dark-mode',
      category: 'view',
      keys: ['Alt', 'T'],
      label: 'Ganti Mode Gelap / Terang',
      description: 'Beralih antara tema Daylight Pro dan Midnight Cyber',
      action: onToggleDarkMode
    },
    {
      id: 'help-shortcuts',
      category: 'view',
      keys: ['?'],
      label: 'Buka Panduan Pintasan Ini',
      description: 'Tampilkan atau sembunyikan dialog bantuan pintasan keyboard ini'
    },
    {
      id: 'ctrl-slash',
      category: 'view',
      keys: [modKey, '/'],
      label: 'Alternatif Panduan Pintasan',
      description: 'Pintasan standar membuka daftar shortcut'
    },
    {
      id: 'export-excel',
      category: 'actions',
      keys: ['Alt', 'X'],
      label: 'Ekspor Data ke Excel',
      description: 'Buka modal konfirmasi ekspor spreadsheet .xlsx lengkap',
      action: onOpenExcelModal
    },
    {
      id: 'export-pdf',
      category: 'actions',
      keys: ['Alt', 'P'],
      label: 'Cetak Laporan PDF Resmi',
      description: 'Buka modal pembuatan laporan dokumen PDF standar Ajinomoto',
      action: onOpenPdfModal
    },
    {
      id: 'import-sync',
      category: 'actions',
      keys: ['Alt', 'I'],
      label: 'Sinkronisasi / Impor Data',
      description: 'Buka pusat sinkronisasi database, Google Sheets, & Excel',
      action: onOpenImportModal
    },
    {
      id: 'close-modal',
      category: 'actions',
      keys: ['Esc'],
      label: 'Tutup Dialog / Modal',
      description: 'Menutup jendela pop-up, modal, atau panduan yang sedang aktif',
      action: onClose
    }
  ];

  // Key tracking when modal is open to give immediate feedback
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const keys = new Set<string>();
      if (e.ctrlKey) keys.add('Ctrl');
      if (e.metaKey) keys.add('⌘');
      if (e.altKey) keys.add('Alt');
      if (e.shiftKey) keys.add('Shift');

      let k = e.key;
      if (k === 'Escape') k = 'Esc';
      if (k === ' ') k = 'Space';
      if (k !== 'Control' && k !== 'Meta' && k !== 'Alt' && k !== 'Shift') {
        keys.add(k.toUpperCase());
      }
      setPressedKeys(keys);
    };

    const handleKeyUp = () => {
      setPressedKeys(new Set());
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isOpen]);

  const filteredShortcuts = shortcuts.filter((s) => {
    if (activeCategory !== 'ALL' && s.category !== activeCategory) return false;
    if (!searchFilter.trim()) return true;
    const query = searchFilter.toLowerCase();
    return (
      s.label.toLowerCase().includes(query) ||
      s.description.toLowerCase().includes(query) ||
      s.keys.join(' ').toLowerCase().includes(query)
    );
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 select-none overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
            aria-hidden="true"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative w-full max-w-2xl rounded-2xl bg-white dark:bg-[#0A192F] border border-slate-200/90 dark:border-white/10 shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="shortcuts-modal-title"
          >
            {/* Top Accent Strip */}
            <div className="h-1 bg-gradient-to-r from-amber-500 via-emerald-500 to-blue-500 shrink-0" />

            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-white/10 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 dark:bg-amber-400/20 text-amber-600 dark:text-amber-300 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-xs">
                  <i className="fa-solid fa-keyboard text-lg"></i>
                </div>
                <div>
                  <h2
                    id="shortcuts-modal-title"
                    className="font-display font-extrabold text-base sm:text-lg text-slate-900 dark:text-white leading-tight flex items-center gap-2"
                  >
                    <span>Pintasan Keyboard</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/50">
                      Shortcut Cepat
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Tingkatkan efisiensi kerja dengan tombol pintas sistem Multi-Skill Monitoring
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/10 transition cursor-pointer"
                aria-label="Tutup modal"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>

            {/* Filter & Live Key Detection Banner */}
            <div className="px-4 sm:px-5 pt-3 pb-2 border-b border-slate-100 dark:border-white/5 bg-white dark:bg-[#0A192F] shrink-0 space-y-2.5">
              <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
                {/* Search Bar */}
                <div className="relative flex-1">
                  <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400"></i>
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Cari pintasan keyboard (contoh: sidebar, excel, tema)..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                  {searchFilter && (
                    <button
                      onClick={() => setSearchFilter('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
                    >
                      <i className="fa-solid fa-circle-xmark"></i>
                    </button>
                  )}
                </div>

                {/* Category Pills */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                  <button
                    onClick={() => setActiveCategory('ALL')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer shrink-0 ${
                      activeCategory === 'ALL'
                        ? 'bg-amber-500 text-slate-950 shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    Semua
                  </button>
                  <button
                    onClick={() => setActiveCategory('navigation')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer shrink-0 ${
                      activeCategory === 'navigation'
                        ? 'bg-amber-500 text-slate-950 shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    Navigasi
                  </button>
                  <button
                    onClick={() => setActiveCategory('actions')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer shrink-0 ${
                      activeCategory === 'actions'
                        ? 'bg-amber-500 text-slate-950 shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    Aksi & Ekspor
                  </button>
                  <button
                    onClick={() => setActiveCategory('view')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer shrink-0 ${
                      activeCategory === 'view'
                        ? 'bg-amber-500 text-slate-950 shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    Tampilan
                  </button>
                </div>
              </div>

              {/* Active Pressed Key Indicator */}
              {pressedKeys.size > 0 && (
                <div className="flex items-center gap-2 py-1 px-3 rounded-lg bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs animate-pulse">
                  <span className="font-semibold text-[11px]">Tombol terdeteksi saat ini:</span>
                  <div className="flex items-center gap-1">
                    {Array.from(pressedKeys).map((k) => (
                      <kbd
                        key={k}
                        className="px-1.5 py-0.5 rounded text-[10px] font-mono font-black bg-amber-500 text-slate-950 shadow-xs"
                      >
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* List of Shortcuts */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 divide-y divide-slate-100 dark:divide-white/5 space-y-2.5">
              {filteredShortcuts.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  <i className="fa-solid fa-keyboard text-2xl mb-2 opacity-50 block"></i>
                  Tidak ada pintasan yang cocok dengan pencarian "{searchFilter}".
                </div>
              ) : (
                filteredShortcuts.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => {
                      if (s.action) {
                        s.action();
                        onClose();
                      }
                    }}
                    className={`pt-2.5 first:pt-0 flex items-center justify-between gap-4 group rounded-xl p-2 transition cursor-pointer hover:bg-amber-50/50 dark:hover:bg-white/[0.03] ${
                      s.action ? 'cursor-pointer' : ''
                    }`}
                    title={s.action ? 'Klik untuk langsung mengeksekusi pintasan ini' : undefined}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-colors">
                          {s.label}
                        </p>
                        {s.category === 'navigation' && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                            Navigasi
                          </span>
                        )}
                        {s.category === 'actions' && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                            Aksi
                          </span>
                        )}
                        {s.category === 'view' && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
                            Tampilan
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        {s.description}
                      </p>
                    </div>

                    {/* Key combo display */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {s.keys.map((k, idx) => (
                        <React.Fragment key={idx}>
                          {idx > 0 && <span className="text-[10px] text-slate-400 font-bold">+</span>}
                          <kbd className="min-w-[24px] px-2 py-1 rounded-md text-[11px] font-mono font-bold text-center bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300/80 dark:border-slate-700 shadow-[0_2px_0_rgba(0,0,0,0.08)] dark:shadow-[0_2px_0_rgba(0,0,0,0.4)] group-hover:border-amber-400 group-hover:bg-amber-100/50 dark:group-hover:bg-amber-950/40 transition">
                            {k}
                          </kbd>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-3.5 sm:p-4 border-t border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-slate-900/50 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0 text-xs">
              <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                <i className="fa-solid fa-circle-info text-amber-500"></i>
                <span>Tekan <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono font-bold text-slate-700 dark:text-slate-300">?</kbd> kapan saja untuk membuka panduan ini</span>
              </div>
              <button
                onClick={onClose}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-sm transition cursor-pointer"
              >
                Tutup (Esc)
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
