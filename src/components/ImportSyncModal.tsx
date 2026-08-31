import React, { useState, useEffect } from 'react';
import { Employee } from '../types';
import {
  SupabaseConfig,
  ImportPreview,
  DEFAULT_GOOGLE_SHEET_URL,
  getSavedGoogleSheetUrl,
  saveGoogleSheetUrl,
  getSupabaseConfig,
  saveSupabaseConfig,
  testSupabaseConnection,
  fetchSupabaseEmployees,
  pushEmployeesToSupabase,
  syncGoogleSheetsDirectToSupabase,
  generateSupabaseSqlTable,
  getSupabaseSchemaDictionary,
  SchemaFieldDoc,
  fetchGoogleSheetData,
  parseCsvString,
  parseRowsToEmployees,
  mergeEmployeesData,
  downloadSampleImportCsv
} from '../utils/syncService';
import confetti from 'canvas-confetti';
import { ConfirmationModal, ConfirmationVariant } from './ConfirmationModal';

interface ImportSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentEmployees: Employee[];
  onApplySync: (updatedEmployees: Employee[], message: string) => void;
}

type TabType = 'googlesheet' | 'supabase' | 'file';
type MergeMode = 'merge' | 'append' | 'replace';

export const ImportSyncModal: React.FC<ImportSyncModalProps> = ({
  isOpen,
  onClose,
  currentEmployees,
  onApplySync
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('googlesheet');
  
  // Google Sheets state
  const [sheetUrl, setSheetUrl] = useState<string>(() => getSavedGoogleSheetUrl());
  const [isFetchingSheet, setIsFetchingSheet] = useState(false);

  // Supabase state
  const [supabaseConfig, setSupabaseConfig] = useState<SupabaseConfig>(() => getSupabaseConfig());
  const [showAnonKey, setShowAnonKey] = useState(false);
  const [isTestingSupabase, setIsTestingSupabase] = useState(false);
  const [isFetchingSupabase, setIsFetchingSupabase] = useState(false);
  const [isPushingSupabase, setIsPushingSupabase] = useState(false);
  const [isSyncingDirect, setIsSyncingDirect] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{
    percent: number;
    current: number;
    total: number;
    batchIndex: number;
    totalBatches: number;
    phase: string;
  } | null>(null);
  const [showSqlSchema, setShowSqlSchema] = useState(false);
  const [showSchemaDictionary, setShowSchemaDictionary] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [supabaseSubTab, setSupabaseSubTab] = useState<'config' | 'dictionary' | 'pipeline'>('config');

  // File upload state
  const [fileContent, setFileContent] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isParsingFile, setIsParsingFile] = useState(false);

  // Shared Preview & Apply state
  const [previewData, setPreviewData] = useState<ImportPreview | null>(null);
  const [mergeMode, setMergeMode] = useState<MergeMode>('merge');
  const [statusAlert, setStatusAlert] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  // Custom Modal Confirmation State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: React.ReactNode | string;
    confirmLabel?: string;
    variant?: ConfirmationVariant;
    icon?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {}
  });

  // Reset or initialize when opened
  useEffect(() => {
    if (isOpen) {
      setSheetUrl(getSavedGoogleSheetUrl());
      setSupabaseConfig(getSupabaseConfig());
      setStatusAlert(null);
      setPreviewData(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // -------------------------------------------------------------
  // Handlers for Google Sheets
  // -------------------------------------------------------------
  const handleFetchGoogleSheet = async () => {
    setStatusAlert(null);
    if (!sheetUrl.trim()) {
      setStatusAlert({ type: 'error', message: 'Masukkan URL Google Sheet terlebih dahulu.' });
      return;
    }

    setIsFetchingSheet(true);
    try {
      const res = await fetchGoogleSheetData(sheetUrl, currentEmployees);
      setIsFetchingSheet(false);

      if (res.success && res.preview) {
        setPreviewData(res.preview);
        setStatusAlert({
          type: 'success',
          message: `${res.message} Tinjau preview di bawah lalu klik "Terapkan Data ke Database".`
        });
      } else {
        setStatusAlert({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setIsFetchingSheet(false);
      setStatusAlert({ type: 'error', message: `Gagal memuat: ${err.message || 'Kesalahan koneksi'}` });
    }
  };

  // -------------------------------------------------------------
  // Handlers for Supabase
  // -------------------------------------------------------------
  const handleTestSupabase = async () => {
    setStatusAlert(null);
    saveSupabaseConfig(supabaseConfig);

    setIsTestingSupabase(true);
    const res = await testSupabaseConnection(supabaseConfig);
    setIsTestingSupabase(false);

    if (res.success) {
      setStatusAlert({
        type: 'success',
        message: `${res.message} (Ditemukan ~${res.rowCount || 0} baris data).`
      });
    } else {
      setStatusAlert({ type: 'error', message: res.message });
    }
  };

  const handleFetchSupabase = async () => {
    setStatusAlert(null);
    saveSupabaseConfig(supabaseConfig);

    setIsFetchingSupabase(true);
    const res = await fetchSupabaseEmployees(supabaseConfig, currentEmployees);
    setIsFetchingSupabase(false);

    if (res.success && res.preview) {
      setPreviewData(res.preview);
      setStatusAlert({
        type: 'success',
        message: `${res.message} Tinjau preview di bawah sebelum menerapkan perubahan.`
      });
    } else {
      setStatusAlert({ type: 'error', message: res.message });
    }
  };

  const executePushSupabase = async () => {
    setIsPushingSupabase(true);
    const res = await pushEmployeesToSupabase(supabaseConfig, currentEmployees, (p) => {
      setSyncProgress(p);
    });
    setIsPushingSupabase(false);

    if (res.success) {
      setStatusAlert({ type: 'success', message: res.message });
      try {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
      } catch (_) {}
    } else {
      setStatusAlert({ type: 'error', message: res.message });
    }
  };

  const handlePushSupabase = () => {
    setStatusAlert(null);
    setSyncProgress(null);
    saveSupabaseConfig(supabaseConfig);

    setConfirmModal({
      isOpen: true,
      title: 'Konfirmasi Unggah ke Cloud Database Supabase',
      variant: 'success',
      icon: 'fa-solid fa-cloud-arrow-up',
      confirmLabel: 'Ya, Unggah Batch Data',
      description: (
        <div className="space-y-3">
          <p>
            Anda akan mengunggah dan mensinkronkan data lokal ke cloud database:
          </p>
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-900 dark:text-emerald-200">
            <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <i className="fa-solid fa-database text-emerald-500"></i>
              <span>Tabel: {supabaseConfig.tableName || 'employees_multi_skill'}</span>
            </div>
            <div className="text-[11px] text-slate-600 dark:text-slate-400 font-mono mt-1">
              Jumlah Rekam Data: <strong>{currentEmployees.length} Karyawan</strong> (Upsert by NIK + Tahun + Bulan)
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Data akan diunggah dalam batch aman tanpa menghapus data historis periode lainnya.
          </p>
        </div>
      ),
      onConfirm: () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        executePushSupabase();
      }
    });
  };

  const executeDirectSync = async () => {
    setIsSyncingDirect(true);
    setSyncProgress({
      percent: 5,
      current: 0,
      total: 100,
      batchIndex: 0,
      totalBatches: 1,
      phase: 'Menghubungi Google Sheets...'
    });

    const res = await syncGoogleSheetsDirectToSupabase(sheetUrl, supabaseConfig, currentEmployees, (p) => {
      setSyncProgress(p);
    });
    setIsSyncingDirect(false);

    if (res.success && res.data) {
      if (res.preview) {
        setPreviewData(res.preview);
      }
      setStatusAlert({
        type: 'success',
        message: `${res.message} Data siap juga untuk diterapkan ke state aplikasi lokal jika diinginkan.`
      });
      try {
        confetti({ particleCount: 75, spread: 80, origin: { y: 0.55 } });
      } catch (_) {}
    } else {
      setStatusAlert({ type: 'error', message: res.message });
    }
  };

  const handleDirectSyncGoogleSheetsToSupabase = () => {
    setStatusAlert(null);
    setSyncProgress(null);

    if (!sheetUrl.trim()) {
      setStatusAlert({ type: 'error', message: 'Masukkan URL Google Sheet terlebih dahulu.' });
      return;
    }
    if (!supabaseConfig.url || !supabaseConfig.anonKey) {
      setStatusAlert({ type: 'error', message: 'Lengkapi URL dan Anon Key Supabase terlebih dahulu.' });
      return;
    }

    saveGoogleSheetUrl(sheetUrl);
    saveSupabaseConfig(supabaseConfig);

    setConfirmModal({
      isOpen: true,
      title: 'Jalankan Pipeline Sinkronisasi Langsung',
      variant: 'info',
      icon: 'fa-solid fa-arrows-spin',
      confirmLabel: 'Mulai Sinkronisasi',
      description: (
        <div className="space-y-3">
          <p>
            Pipeline otomatis akan mengeksekusi tahapan berikut secara berurutan:
          </p>
          <div className="space-y-2 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center gap-2.5">
              <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 font-bold flex items-center justify-center text-[10px]">1</span>
              <span>Menarik live dataset CSV dari Google Sheets Master</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center gap-2.5">
              <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 font-bold flex items-center justify-center text-[10px]">2</span>
              <span>Validasi skema kolom 92 skill matriks Ajinomoto</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center gap-2.5">
              <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 font-bold flex items-center justify-center text-[10px]">3</span>
              <span>Unggah batch langsung ke tabel <strong>"{supabaseConfig.tableName}"</strong> di Supabase</span>
            </div>
          </div>
        </div>
      ),
      onConfirm: () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        executeDirectSync();
      }
    });
  };

  const handleCopySql = () => {
    const sql = generateSupabaseSqlTable(supabaseConfig.tableName || 'employees_multi_skill');
    navigator.clipboard.writeText(sql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  // -------------------------------------------------------------
  // Handlers for File Upload & CSV
  // -------------------------------------------------------------
  const handleFileProcess = (text: string) => {
    setIsParsingFile(true);
    setStatusAlert(null);
    try {
      const rows = parseCsvString(text);
      const { employees, preview, errors } = parseRowsToEmployees(rows, currentEmployees);

      setIsParsingFile(false);
      if (employees.length > 0) {
        setPreviewData(preview);
        setStatusAlert({
          type: 'success',
          message: `Berhasil memproses ${employees.length} baris data dari file CSV.`
        });
      } else {
        setStatusAlert({
          type: 'error',
          message: errors[0] || 'Tidak dapat membaca baris data karyawan dari file.'
        });
      }
    } catch (err: any) {
      setIsParsingFile(false);
      setStatusAlert({ type: 'error', message: `Gagal memproses file: ${err.message}` });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setFileContent(content);
      handleFileProcess(content);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setFileContent(content);
      handleFileProcess(content);
    };
    reader.readAsText(file);
  };

  // -------------------------------------------------------------
  // Final Apply Data to Application State
  // -------------------------------------------------------------
  const handleApplyToDatabase = () => {
    if (!previewData || !previewData.parsedEmployees.length) {
      setStatusAlert({ type: 'error', message: 'Belum ada data hasil sinkronisasi untuk diterapkan.' });
      return;
    }

    setIsApplying(true);
    setTimeout(() => {
      const result = mergeEmployeesData(currentEmployees, previewData.parsedEmployees, mergeMode);
      setIsApplying(false);

      let msg = '';
      if (mergeMode === 'replace') {
        msg = `Database berhasil digantikan dengan ${result.addedCount} data karyawan baru.`;
      } else if (mergeMode === 'append') {
        msg = `Berhasil menambahkan ${result.addedCount} data karyawan baru ke database.`;
      } else {
        msg = `Sinkronisasi selesai: ${result.updatedCount} data diperbarui, ${result.addedCount} data baru ditambahkan. Total: ${result.updatedEmployees.length} karyawan.`;
      }

      try {
        confetti({ particleCount: 70, spread: 80, origin: { y: 0.5 } });
      } catch (_) {}

      onApplySync(result.updatedEmployees, msg);
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto pt-14 pb-8 sm:pt-20 sm:pb-12 px-3 sm:px-6 flex items-start sm:items-center justify-center animate-fadeIn">
      {/* Backdrop */}
      <div onClick={onClose} className="fixed inset-0 bg-slate-950/75 dark:bg-black/85 backdrop-blur-xs transition-opacity" />

      {/* Modal Card */}
      <div className="relative modal-panel bg-white dark:bg-slate-900 w-full max-w-4xl my-auto max-h-[86vh] sm:max-h-[82vh] flex flex-col overflow-hidden shadow-2xl z-10 animate-scaleUp border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="modal-header px-5 sm:px-6 py-4 sm:py-5 flex items-start justify-between shrink-0 bg-gradient-to-r from-[#0E2340] to-[#173866]">
          <div className="text-white min-w-0 pr-4">
            <p className="eyebrow !text-amber-300 text-[10px] uppercase font-bold tracking-widest mb-1 flex items-center gap-1.5">
              <i className="fa-solid fa-cloud-arrow-down text-amber-400"></i> Cloud &amp; External Synchronization
            </p>
            <h3 className="font-display font-extrabold text-lg sm:text-xl text-white">
              Import &amp; Sinkronisasi Multi-Skill Data
            </h3>
            <p className="text-xs text-white/80 mt-0.5">
              Sinkronkan data secara langsung dengan Google Sheets, Database Supabase, atau File CSV/Excel
            </p>
          </div>

          <button
            onClick={onClose}
            className="text-white/80 hover:text-white h-8 w-8 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 shrink-0 transition cursor-pointer"
            aria-label="Tutup"
          >
            <i className="fa-solid fa-xmark text-base"></i>
          </button>
        </div>

        {/* Tab Switcher Bar */}
        <div className="px-5 sm:px-6 pt-3.5 pb-0 border-b border-slate-200 dark:border-slate-800 shrink-0 bg-slate-50/80 dark:bg-slate-850 flex gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => {
              setActiveTab('googlesheet');
              setStatusAlert(null);
            }}
            className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-t-xl transition-all flex items-center gap-2 border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'googlesheet'
                ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 bg-white dark:bg-slate-900 shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <i className="fa-solid fa-file-excel text-emerald-600 dark:text-emerald-400 text-sm"></i>
            <span>Google Sheets Live Sync</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('supabase');
              setStatusAlert(null);
            }}
            className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-t-xl transition-all flex items-center gap-2 border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'supabase'
                ? 'border-emerald-500 text-emerald-700 dark:text-emerald-400 bg-white dark:bg-slate-900 shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <i className="fa-solid fa-bolt text-emerald-500 text-sm"></i>
            <span>Supabase Cloud DB</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('file');
              setStatusAlert(null);
            }}
            className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-t-xl transition-all flex items-center gap-2 border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'file'
                ? 'border-blue-600 text-blue-700 dark:text-blue-400 bg-white dark:bg-slate-900 shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <i className="fa-solid fa-upload text-blue-600 dark:text-blue-400 text-sm"></i>
            <span>Upload File CSV / Excel</span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-5">
          {/* Status Alert Banner */}
          {statusAlert && (
            <div
              className={`rounded-xl px-4 py-3 text-xs sm:text-sm font-semibold flex items-start gap-3 animate-fadeIn ${
                statusAlert.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                  : statusAlert.type === 'error'
                  ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                  : 'bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800'
              }`}
            >
              <i
                className={`fa-solid mt-0.5 shrink-0 ${
                  statusAlert.type === 'success'
                    ? 'fa-circle-check text-emerald-600 dark:text-emerald-400'
                    : statusAlert.type === 'error'
                    ? 'fa-circle-exclamation text-rose-600 dark:text-rose-400'
                    : 'fa-circle-info text-blue-600 dark:text-blue-400'
                }`}
              ></i>
              <div className="flex-1 leading-relaxed">{statusAlert.message}</div>
            </div>
          )}

          {/* ================= TAB 1: GOOGLE SHEETS ================= */}
          {activeTab === 'googlesheet' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="card-elegant p-4 sm:p-5 border border-slate-200 dark:border-slate-800 space-y-4">
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-1.5">
                    <label className="block text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                      URL Spreadsheet Google Sheets:
                    </label>
                    <div className="flex items-center gap-2 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setSheetUrl(DEFAULT_GOOGLE_SHEET_URL)}
                        className="text-emerald-700 dark:text-emerald-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                        title="Terapkan link Google Sheets master"
                      >
                        <i className="fa-solid fa-arrows-rotate text-[10px]"></i> Link Master Anda
                      </button>
                      <span className="text-slate-300 dark:text-slate-700">&bull;</span>
                      <a
                        href={sheetUrl || DEFAULT_GOOGLE_SHEET_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i> Buka di Google Sheets
                      </a>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <i className="fa-solid fa-link absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                      <input
                        type="url"
                        value={sheetUrl}
                        onChange={(e) => setSheetUrl(e.target.value)}
                        placeholder="https://docs.google.com/spreadsheets/d/1FJTXnDq4bVTFfxcpCyML5GGh4qeiZjMfV0OmzGY56yI/edit#gid=2036340139"
                        className="input-elegant w-full pl-9 pr-3 py-2.5 outline-none text-xs sm:text-sm text-slate-800 dark:text-slate-100 font-mono"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleFetchGoogleSheet}
                      disabled={isFetchingSheet}
                      className="btn-navy px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 whitespace-nowrap shadow-sm cursor-pointer disabled:opacity-60 hover:opacity-95 transition"
                    >
                      {isFetchingSheet ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                          <span>Menarik Data...</span>
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-rotate text-xs"></i>
                          <span>Tarik &amp; Analisis Data</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Active Sheet Badge */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-800/80">
                      <i className="fa-solid fa-table text-[10px]"></i> ID: 1FJTXnDq4bVTFfxcpCyML5GGh4qeiZjMfV0OmzGY56yI
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border border-slate-200 dark:border-slate-700">
                      <i className="fa-solid fa-hashtag text-[10px]"></i> GID: 2036340139
                    </span>
                  </div>
                </div>

                {/* Quick Guide Card */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-xs text-slate-600 dark:text-slate-300 space-y-2">
                  <p className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <i className="fa-solid fa-lightbulb text-amber-500"></i> Petunjuk Akses Google Sheets:
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-[11.5px] leading-relaxed text-slate-600 dark:text-slate-300">
                    <li>
                      Pastikan izin sharing spreadsheet telah dibuka: Klik <b>Bagikan (Share)</b> di kanan atas &rarr; ubah menjadi{' '}
                      <span className="font-bold text-emerald-700 dark:text-emerald-400">
                        "Siapa saja yang memiliki link dapat melihat" (Anyone with the link can view)
                      </span>.
                    </li>
                    <li>
                      Klik tombol <b>"Tarik &amp; Analisis Data"</b> untuk membaca data karyawan, divisi, periode, serta seluruh 92+ kolom matriks skill.
                    </li>
                    <li>
                      Pilih strategi integrasi (<b>Merge / Update</b>, <b>Append Baru</b>, atau <b>Replace Seluruh Database</b>), lalu klik <b>Terapkan Data ke Database</b>.
                    </li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 2: SUPABASE DATABASE ================= */}
          {activeTab === 'supabase' && (
            <div className="space-y-4 animate-fadeIn">
              {/* Sub-tab Switcher within Supabase */}
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80">
                <button
                  type="button"
                  onClick={() => setSupabaseSubTab('config')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    supabaseSubTab === 'config'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <i className="fa-solid fa-plug text-emerald-500 text-xs"></i>
                  <span>Koneksi &amp; Operasi</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSupabaseSubTab('pipeline')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    supabaseSubTab === 'pipeline'
                      ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <i className="fa-solid fa-arrow-right-arrow-left text-blue-500 text-xs"></i>
                  <span>Pipeline Google Sheets ➔ Supabase</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSupabaseSubTab('dictionary')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    supabaseSubTab === 'dictionary'
                      ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <i className="fa-solid fa-book-bookmark text-amber-500 text-xs"></i>
                  <span>Kamus Skema Database</span>
                </button>
              </div>

              {/* Progress Bar Indicator during sync operations */}
              {(isPushingSupabase || isSyncingDirect) && syncProgress && (
                <div className="p-4 rounded-xl bg-emerald-50/90 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-700 space-y-2.5 animate-fadeIn">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-900 dark:text-emerald-200">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                      <span>{syncProgress.phase}</span>
                    </span>
                    <span>{syncProgress.percent}%</span>
                  </div>
                  <div className="w-full bg-emerald-200/70 dark:bg-emerald-900 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-emerald-500 to-teal-500 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(5, syncProgress.percent)}%` }}
                    ></div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-emerald-700 dark:text-emerald-300 font-mono">
                    <span>
                      Batch: {syncProgress.batchIndex + 1} / {syncProgress.totalBatches}
                    </span>
                    <span>
                      {syncProgress.current} / {syncProgress.total} Baris Data
                    </span>
                  </div>
                </div>
              )}

              {/* SUB-VIEW 1: CONFIG & REST API */}
              {supabaseSubTab === 'config' && (
                <div className="card-elegant p-4 sm:p-5 border border-slate-200 dark:border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                        Kredensial &amp; Konfigurasi Supabase Project
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowSqlSchema(!showSqlSchema)}
                      className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <i className="fa-solid fa-code text-[11px]"></i>
                      {showSqlSchema ? 'Tutup Script SQL' : 'Lihat Script SQL DDL'}
                    </button>
                  </div>

                  {/* SQL Schema helper box */}
                  {showSqlSchema && (
                    <div className="p-4 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-xs space-y-2.5 animate-fadeIn">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-mono font-bold text-amber-300 text-xs">
                            PostgreSQL Schema (Jalankan di Supabase &gt; SQL Editor):
                          </p>
                          <p className="text-[11px] text-slate-400">
                            Membuat tabel, index performa, GIN index JSONB, RLS policies, &amp; summary view otomatis.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleCopySql}
                          className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0 ml-2"
                        >
                          <i className={`fa-solid ${copiedSql ? 'fa-check text-emerald-400' : 'fa-copy'}`}></i>
                          <span>{copiedSql ? 'Tersalin!' : 'Salin SQL'}</span>
                        </button>
                      </div>
                      <pre className="overflow-x-auto p-3 rounded-lg bg-black/40 text-[11px] font-mono text-emerald-400 max-h-56 leading-relaxed">
                        {generateSupabaseSqlTable(supabaseConfig.tableName || 'employees_multi_skill')}
                      </pre>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Project URL Supabase *
                      </label>
                      <input
                        type="url"
                        value={supabaseConfig.url}
                        onChange={(e) => setSupabaseConfig({ ...supabaseConfig, url: e.target.value })}
                        placeholder="https://xyzcompany.supabase.co"
                        className="input-elegant w-full px-3 py-2 outline-none text-xs sm:text-sm font-mono text-slate-800 dark:text-slate-100"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Nama Tabel *
                      </label>
                      <input
                        type="text"
                        value={supabaseConfig.tableName}
                        onChange={(e) => setSupabaseConfig({ ...supabaseConfig, tableName: e.target.value })}
                        placeholder="employees_multi_skill"
                        className="input-elegant w-full px-3 py-2 outline-none text-xs sm:text-sm font-mono text-slate-800 dark:text-slate-100"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 flex items-center justify-between">
                        <span>Anon Key / API Key *</span>
                        <button
                          type="button"
                          onClick={() => setShowAnonKey(!showAnonKey)}
                          className="text-[10px] text-slate-400 hover:text-slate-600"
                        >
                          {showAnonKey ? 'Sembunyikan' : 'Tampilkan'}
                        </button>
                      </label>
                      <input
                        type={showAnonKey ? 'text' : 'password'}
                        value={supabaseConfig.anonKey}
                        onChange={(e) => setSupabaseConfig({ ...supabaseConfig, anonKey: e.target.value })}
                        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                        className="input-elegant w-full px-3 py-2 outline-none text-xs sm:text-sm font-mono text-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={handleTestSupabase}
                      disabled={isTestingSupabase || !supabaseConfig.url}
                      className="btn-ghost-navy px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isTestingSupabase ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-slate-400 border-t-slate-800 dark:border-t-white rounded-full animate-spin"></span>
                          <span>Menguji...</span>
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-plug text-xs"></i>
                          <span>Uji Koneksi Supabase</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleFetchSupabase}
                      disabled={isFetchingSupabase || !supabaseConfig.url}
                      className="btn-navy px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
                    >
                      {isFetchingSupabase ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                          <span>Menarik Data Supabase...</span>
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-cloud-arrow-down text-xs"></i>
                          <span>Tarik Data dari Supabase (Pull)</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handlePushSupabase}
                      disabled={isPushingSupabase || !supabaseConfig.url || !currentEmployees.length}
                      className="btn-gold px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50 hover:opacity-95 transition"
                    >
                      {isPushingSupabase ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></span>
                          <span>Mengirim ({syncProgress?.percent || 0}%)...</span>
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-cloud-arrow-up text-xs"></i>
                          <span>Push Data Lokal ➔ Supabase</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* SUB-VIEW 2: DIRECT PIPELINE GOOGLE SHEETS ➔ SUPABASE */}
              {supabaseSubTab === 'pipeline' && (
                <div className="card-elegant p-4 sm:p-5 border border-slate-200 dark:border-slate-800 space-y-4 animate-fadeIn">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <i className="fa-solid fa-bolt-lightning text-lg"></i>
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">
                        Pipeline Sinkronisasi Otomatis: Google Sheets &rarr; Supabase DB
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                        Membaca data master dari spreadsheet Google Sheets, memetakan 92+ kolom matriks skill ke dalam format JSONB PostgreSQL terstandar, dan menyimpannya secara bertahap (batch upsert) ke database Supabase Anda.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700/80 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Sumber Data:</span>
                      <span className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400 font-bold truncate max-w-[280px]">
                        Google Sheets Master (Live CSV)
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Target Database:</span>
                      <span className="font-mono text-[11px] text-blue-700 dark:text-blue-400 font-bold">
                        Supabase &gt; {supabaseConfig.tableName || 'employees_multi_skill'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Resolusi Konflik:</span>
                      <span className="badge-pill bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-[10px] font-mono">
                        UPSERT ON CONFLICT (emp_id, tahun, bulan)
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleDirectSyncGoogleSheetsToSupabase}
                      disabled={isSyncingDirect || !supabaseConfig.url || !sheetUrl}
                      className="btn-navy px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      {isSyncingDirect ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                          <span>Sinkronisasi Berjalan ({syncProgress?.percent || 0}%)...</span>
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-arrows-rotate text-amber-400 text-xs"></i>
                          <span>Jalankan Sinkronisasi Google Sheets ➔ Supabase</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* SUB-VIEW 3: SCHEMA DICTIONARY (EASY TO UNDERSTAND) */}
              {supabaseSubTab === 'dictionary' && (
                <div className="card-elegant p-4 sm:p-5 border border-slate-200 dark:border-slate-800 space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <i className="fa-solid fa-book-bookmark text-amber-500"></i>
                        Kamus Struktur &amp; Skema Database Supabase
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Panduan kolom tabel PostgreSQL dan pemetaan asal datanya dari Google Sheets
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopySql}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                    >
                      <i className={`fa-solid ${copiedSql ? 'fa-check' : 'fa-copy'} text-xs`}></i>
                      <span>{copiedSql ? 'Tersalin!' : 'Salin Skema SQL'}</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 max-h-[380px]">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 font-bold sticky top-0 border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <th className="py-2.5 px-3">Nama Kolom (Supabase)</th>
                          <th className="py-2.5 px-3">Tipe Data</th>
                          <th className="py-2.5 px-3">Asal di Google Sheets</th>
                          <th className="py-2.5 px-3 min-w-[200px]">Keterangan</th>
                          <th className="py-2.5 px-3">Contoh Nilai</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {getSupabaseSchemaDictionary().map((field, idx) => (
                          <tr
                            key={field.column}
                            className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition ${
                              idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/50 dark:bg-slate-850/50'
                            }`}
                          >
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-slate-100 text-[11.5px]">
                              {field.column}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-amber-700 dark:text-amber-400">
                              {field.type}
                            </td>
                            <td className="py-2.5 px-3 text-emerald-700 dark:text-emerald-400 font-medium">
                              {field.sheetSource}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 leading-relaxed">
                              {field.description}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-500 dark:text-slate-400 text-[11px]">
                              {field.sample}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 3: FILE CSV / EXCEL ================= */}
          {activeTab === 'file' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="card-elegant p-4 sm:p-5 border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                      Unggah File CSV Data Karyawan
                    </h4>
                    <p className="text-xs text-slate-500">Mendukung format CSV standar (koma atau titik koma)</p>
                  </div>
                  <button
                    type="button"
                    onClick={downloadSampleImportCsv}
                    className="btn-ghost-navy px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <i className="fa-solid fa-download text-xs text-amber-500"></i>
                    <span>Download Template CSV</span>
                  </button>
                </div>

                {/* Drag and Drop Zone */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition-all cursor-pointer ${
                    isDragging
                      ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20'
                      : 'border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-850 hover:bg-slate-100/50'
                  }`}
                  onClick={() => document.getElementById('csv-file-input')?.click()}
                >
                  <input
                    type="file"
                    id="csv-file-input"
                    accept=".csv,text/csv,application/vnd.ms-excel"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center text-xl mb-3 shadow-xs">
                    <i className="fa-solid fa-file-csv"></i>
                  </div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Klik untuk memilih file CSV atau seret file ke sini
                  </p>
                  <p className="text-xs text-slate-400 mt-1">Format file .csv (UTF-8)</p>
                </div>
              </div>
            </div>
          )}

          {/* ================= PREVIEW & CONFIRMATION SECTION ================= */}
          {previewData && (
            <div className="card-elegant p-4 sm:p-5 border-2 border-emerald-500/40 dark:border-emerald-500/30 bg-emerald-50/10 space-y-4 animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                <div>
                  <p className="eyebrow !text-emerald-600 dark:text-emerald-400 text-[10px] uppercase font-bold tracking-wider">
                    Hasil Validasi Data Masuk
                  </p>
                  <h4 className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-100">
                    Pratinjau Data Sinkronisasi ({previewData.totalRows} Karyawan)
                  </h4>
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold">
                    + {previewData.newRows} Karyawan Baru
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 font-bold">
                    &bull; {previewData.updateRows} Karyawan Update
                  </span>
                </div>
              </div>

              {/* Mode Selection Options */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Pilih Metode Penggabungan Data (Merge Strategy):
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <label
                    className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition ${
                      mergeMode === 'merge'
                        ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name="mergeMode"
                      checked={mergeMode === 'merge'}
                      onChange={() => setMergeMode('merge')}
                      className="mt-0.5"
                    />
                    <div className="text-xs">
                      <span className="block font-bold">Merge &amp; Update (Disarankan)</span>
                      <span className="text-[11px] opacity-80">Perbarui data yang cocok, tambahkan yang baru.</span>
                    </div>
                  </label>

                  <label
                    className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition ${
                      mergeMode === 'append'
                        ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name="mergeMode"
                      checked={mergeMode === 'append'}
                      onChange={() => setMergeMode('append')}
                      className="mt-0.5"
                    />
                    <div className="text-xs">
                      <span className="block font-bold">Append Only</span>
                      <span className="text-[11px] opacity-80">Hanya tambahkan data yang belum pernah ada.</span>
                    </div>
                  </label>

                  <label
                    className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition ${
                      mergeMode === 'replace'
                        ? 'border-rose-500 bg-rose-50/60 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name="mergeMode"
                      checked={mergeMode === 'replace'}
                      onChange={() => setMergeMode('replace')}
                      className="mt-0.5"
                    />
                    <div className="text-xs">
                      <span className="block font-bold">Replace All</span>
                      <span className="text-[11px] opacity-80">Ganti seluruh data aplikasi dengan data ini.</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Sample Table Preview */}
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 max-h-48">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase font-bold text-[10px] tracking-wider">
                    <tr>
                      <th className="px-3 py-2">Emp ID</th>
                      <th className="px-3 py-2">Nama</th>
                      <th className="px-3 py-2">Divisi</th>
                      <th className="px-3 py-2">Jabatan</th>
                      <th className="px-3 py-2 text-center">Skor Skill</th>
                      <th className="px-3 py-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300">
                    {previewData.sampleRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="px-3 py-2 font-mono font-bold text-slate-800 dark:text-slate-200">{row.empId}</td>
                        <td className="px-3 py-2 font-semibold">{row.empName}</td>
                        <td className="px-3 py-2">{row.divisi || '-'}</td>
                        <td className="px-3 py-2">{row.jabatan || '-'}</td>
                        <td className="px-3 py-2 text-center font-bold text-emerald-600 dark:text-emerald-400">
                          {row.totalScore || 0}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              row.result === 'MS'
                                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                                : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                            }`}
                          >
                            {row.result || 'US'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/80 dark:bg-slate-900">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleApplyToDatabase}
            disabled={isApplying || !previewData || !previewData.parsedEmployees.length}
            className="btn-navy px-6 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50 hover:opacity-95 transition"
          >
            {isApplying ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                <span>Menerapkan Sinkronisasi...</span>
              </>
            ) : (
              <>
                <i className="fa-solid fa-check text-xs"></i>
                <span>Terapkan Data ke Database ({previewData?.totalRows || 0})</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        description={confirmModal.description}
        confirmLabel={confirmModal.confirmLabel}
        variant={confirmModal.variant}
        icon={confirmModal.icon}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
