import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Employee, AppFiltersState, UserSession } from '../types';
import { generateMultiSkillReportPdf } from '../utils/pdfExport';
import { computeDashboardStats, saveStoredEmployees } from '../utils/storage';
import { fetchEmployeesFromServer } from '../utils/systemDbService';
import {
  fetchSupabaseEmployees,
  getSupabaseConfig,
  fetchGoogleSheetData,
  getSavedGoogleSheetUrl
} from '../utils/syncService';
import { BULAN_LABELS } from '../data/initialData';
import confetti from 'canvas-confetti';

interface RecipientDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  currentUser: UserSession;
  urlParams: {
    report?: string;
    month?: string;
    year?: string;
    divisi?: string;
    dept?: string;
  };
}

export const RecipientDownloadModal: React.FC<RecipientDownloadModalProps> = ({
  isOpen,
  onClose,
  employees,
  currentUser,
  urlParams
}) => {
  const [downloadStep, setDownloadStep] = useState<'syncing' | 'ready' | 'preparing' | 'downloaded' | 'error'>('syncing');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isAutoDownloaded, setIsAutoDownloaded] = useState(false);
  const [realEmployees, setRealEmployees] = useState<Employee[]>(employees);
  const [dataSourceLabel, setDataSourceLabel] = useState<string>('Sinkronisasi Database...');

  // Derive active filters from URL parameters
  const targetYear = useMemo(() => {
    if (!urlParams.year) return [];
    return urlParams.year.split(',').map((s) => s.trim()).filter(Boolean);
  }, [urlParams.year]);

  const targetMonth = useMemo(() => {
    if (!urlParams.month) return [];
    return urlParams.month.split(',').map((s) => s.trim()).filter(Boolean);
  }, [urlParams.month]);

  const targetDivisi = useMemo(() => {
    if (!urlParams.divisi || urlParams.divisi === 'Semua') return [];
    return urlParams.divisi.split(',').map((s) => s.trim()).filter(Boolean);
  }, [urlParams.divisi]);

  const targetDept = useMemo(() => {
    if (!urlParams.dept || urlParams.dept === 'Semua') return [];
    return urlParams.dept.split(',').map((s) => s.trim()).filter(Boolean);
  }, [urlParams.dept]);

  const filters: AppFiltersState = useMemo(() => ({
    tahun: targetYear,
    bulan: targetMonth,
    divisi: targetDivisi,
    department: targetDept,
    jabatan: []
  }), [targetYear, targetMonth, targetDivisi, targetDept]);

  // Actively fetch real live database from Server DB, Supabase, or Google Sheet on mount
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchLatestDatabase = async () => {
      setDownloadStep('syncing');
      setDataSourceLabel('Menghubungi Server Database Real...');

      // 1. Check Server Database (/api/employees)
      try {
        const serverEmps = await fetchEmployeesFromServer();
        if (serverEmps && Array.isArray(serverEmps) && serverEmps.length > 0) {
          if (isMounted) {
            setRealEmployees(serverEmps);
            saveStoredEmployees(serverEmps);
            setDataSourceLabel(`Server Database Terhubung (${serverEmps.length} Record)`);
            setDownloadStep('ready');
            return;
          }
        }
      } catch (err) {
        console.warn('Server employee fetch note in recipient modal:', err);
      }

      // 2. Check Supabase Cloud
      try {
        const sbConfig = getSupabaseConfig();
        if (sbConfig.url && sbConfig.anonKey) {
          setDataSourceLabel('Memuat Data Cloud Supabase...');
          const sbRes = await fetchSupabaseEmployees(sbConfig);
          if (sbRes.success && sbRes.data && sbRes.data.length > 0) {
            if (isMounted) {
              setRealEmployees(sbRes.data);
              saveStoredEmployees(sbRes.data);
              setDataSourceLabel(`Supabase Cloud Terhubung (${sbRes.data.length} Record)`);
              setDownloadStep('ready');
              return;
            }
          }
        }
      } catch (err) {
        console.warn('Supabase fetch note in recipient modal:', err);
      }

      // 3. Check Google Sheets Master
      try {
        const sheetUrl = getSavedGoogleSheetUrl();
        if (sheetUrl) {
          setDataSourceLabel('Memuat Data Live Google Sheets Master...');
          const sheetRes = await fetchGoogleSheetData(sheetUrl);
          if (sheetRes.success && sheetRes.data && sheetRes.data.length > 0) {
            if (isMounted) {
              setRealEmployees(sheetRes.data);
              saveStoredEmployees(sheetRes.data);
              setDataSourceLabel(`Google Sheets Live Terhubung (${sheetRes.data.length} Record)`);
              setDownloadStep('ready');
              return;
            }
          }
        }
      } catch (err) {
        console.warn('Google Sheet fetch note in recipient modal:', err);
      }

      // 4. Fallback to passed employees prop if available
      if (isMounted) {
        setRealEmployees(employees.length > 0 ? employees : employees);
        setDataSourceLabel(`Database Aktif Terhubung (${employees.length} Record)`);
        setDownloadStep('ready');
      }
    };

    fetchLatestDatabase();

    return () => {
      isMounted = false;
    };
  }, [isOpen, employees]);

  // Robust employee filtering based on URL parameters
  const filteredEmployees = useMemo(() => {
    return realEmployees.filter((emp) => {
      if (targetYear.length > 0) {
        const matchYear = targetYear.some(
          (y) => String(emp.tahun).trim() === y || Number(emp.tahun) === Number(y)
        );
        if (!matchYear) return false;
      }

      if (targetMonth.length > 0) {
        const matchMonth = targetMonth.some(
          (m) => String(emp.bulan).trim() === m || Number(emp.bulan) === Number(m)
        );
        if (!matchMonth) return false;
      }

      if (targetDivisi.length > 0 && !targetDivisi.includes('Semua') && !targetDivisi.includes('')) {
        const matchDiv = targetDivisi.some(
          (d) => emp.divisi && emp.divisi.trim().toLowerCase() === d.trim().toLowerCase()
        );
        if (!matchDiv) return false;
      }

      if (targetDept.length > 0 && !targetDept.includes('Semua') && !targetDept.includes('')) {
        const matchDept = targetDept.some(
          (dept) => emp.department && emp.department.trim().toLowerCase() === dept.trim().toLowerCase()
        );
        if (!matchDept) return false;
      }

      return true;
    });
  }, [realEmployees, targetYear, targetMonth, targetDivisi, targetDept]);

  const dataset = useMemo(() => {
    return filteredEmployees.length > 0 ? filteredEmployees : realEmployees;
  }, [filteredEmployees, realEmployees]);

  const stats = useMemo(() => computeDashboardStats(dataset), [dataset]);

  // Derive display labels
  const uniqueTahunInDataset = useMemo(() => {
    return Array.from(new Set(dataset.map((e) => e.tahun).filter(Boolean)));
  }, [dataset]);

  const uniqueBulanInDataset = useMemo(() => {
    return Array.from(new Set(dataset.map((e) => e.bulan).filter(Boolean)));
  }, [dataset]);

  const thnLabel = targetYear[0] || (uniqueTahunInDataset[0] ? String(uniqueTahunInDataset[0]) : String(new Date().getFullYear()));
  const blnLabel = targetMonth[0]
    ? BULAN_LABELS[Number(targetMonth[0]) - 1] || targetMonth[0]
    : (uniqueBulanInDataset[0] ? BULAN_LABELS[Number(uniqueBulanInDataset[0]) - 1] || String(uniqueBulanInDataset[0]) : BULAN_LABELS[new Date().getMonth()]);

  const executeDownload = useCallback(() => {
    try {
      setDownloadStep('preparing');
      const result = generateMultiSkillReportPdf({
        scope: filteredEmployees.length > 0 ? 'filtered' : 'all',
        filteredEmployees: dataset,
        allEmployees: realEmployees,
        filters,
        currentUser: {
          ...currentUser,
          name: currentUser.name || 'Mahmud Nurdiansyah',
          role: currentUser.role || 'HR Development Admin'
        },
        reportType: (urlParams.report as any) || 'comprehensive',
        orientation: 'portrait',
        approvers: {
          preparedBy: {
            name: currentUser.name || 'Mahmud Nurdiansyah',
            title: currentUser.role || 'HR Development Admin'
          }
        }
      });

      result.doc.save(result.filename);
      setDownloadStep('downloaded');
      setIsAutoDownloaded(true);

      try {
        confetti({ particleCount: 80, spread: 90, origin: { y: 0.6 } });
      } catch (_) {}
    } catch (err: any) {
      setDownloadStep('error');
      setErrorMessage(err?.message || 'Gagal meng-generate berkas PDF dari database.');
    }
  }, [filteredEmployees.length, dataset, realEmployees, filters, currentUser, urlParams.report]);

  // Auto-generate once real database data is loaded and confirmed ready
  useEffect(() => {
    if (isOpen && downloadStep === 'ready' && !isAutoDownloaded && realEmployees.length > 0) {
      const timer = setTimeout(() => {
        executeDownload();
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [isOpen, downloadStep, isAutoDownloaded, realEmployees.length, executeDownload]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-lg shadow-2xl overflow-hidden animate-scaleUp">
        {/* Header Banner */}
        <div
          className="p-6 text-white text-center relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #0E2340 0%, #16345E 100%)' }}
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-amber-400"></div>

          <div className="w-14 h-14 mx-auto rounded-2xl bg-white p-2 shadow-lg mb-3 flex items-center justify-center">
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/0/01/Ajinomoto_Group_Global_Brand_logo.png"
              alt="Logo Ajinomoto"
              className="max-h-full max-w-full object-contain"
            />
          </div>

          <p className="text-[11px] font-bold tracking-widest text-amber-300 uppercase">
            PT AJINOMOTO INDONESIA &bull; MOJOKERTO FACTORY
          </p>
          <h2 className="text-xl font-extrabold text-white mt-1">Portal Unduh Laporan Resmi</h2>
          <p className="text-xs text-slate-300 mt-1">Multi-Skill Monitoring &amp; Competency Development</p>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {/* Real Data Status Badge */}
          <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-xs">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${downloadStep === 'syncing' ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'}`}></span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">Sumber Data:</span>
            </div>
            <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300 font-medium">
              {dataSourceLabel}
            </span>
          </div>

          {/* Metadata Card */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-200 dark:border-slate-700">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Periode Monitoring:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {blnLabel} {thnLabel}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-200 dark:border-slate-700">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Divisi / Dept:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {targetDivisi[0] || 'Semua Divisi'} &bull; {targetDept[0] || 'Semua Dept'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1 text-center">
              <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <p className="text-[10px] text-slate-400 font-medium">Total Terdata</p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{stats.totalManpower} Org</p>
              </div>
              <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <p className="text-[10px] text-emerald-500 font-medium">Standar (MS)</p>
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{stats.totalMS} Org</p>
              </div>
              <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <p className="text-[10px] text-amber-500 font-medium">Pencapaian KPI</p>
                <p className="text-sm font-bold text-amber-600 dark:text-amber-400">
                  {(stats.percentMS * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </div>

          {/* Status Messages */}
          {downloadStep === 'syncing' && (
            <div className="text-center py-4 space-y-3">
              <div className="w-10 h-10 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto"></div>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                Menyinkronkan Database Real Terkini...
              </p>
              <p className="text-[11px] text-slate-400">
                Memastikan seluruh data karyawan terverifikasi langsung dari database master.
              </p>
            </div>
          )}

          {downloadStep === 'preparing' && (
            <div className="text-center py-4 space-y-3">
              <div className="w-10 h-10 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto"></div>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                Menyusun Dokumen PDF Resmi 3 Halaman dari Data Real...
              </p>
              <p className="text-[11px] text-slate-400">
                Memproses Matriks Multi-Skill, Rekap Divisi, Departemen, Grade, &amp; Job Position.
              </p>
            </div>
          )}

          {downloadStep === 'downloaded' && (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center space-y-2 animate-fadeIn">
              <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300 flex items-center justify-center mx-auto text-sm">
                <i className="fa-solid fa-check"></i>
              </div>
              <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                Dokumen PDF Database Real Berhasil Diunduh!
              </p>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                Periksa folder Download pada perangkat Anda. Data sesuai dengan redaksional email dan database live terkini.
              </p>
            </div>
          )}

          {downloadStep === 'error' && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-center space-y-2">
              <i className="fa-solid fa-circle-exclamation text-rose-600 text-xl"></i>
              <p className="text-xs font-bold text-rose-900 dark:text-rose-200">Gagal Mengunduh Laporan</p>
              <p className="text-[11px] text-rose-700 dark:text-rose-300">{errorMessage}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2.5 pt-2">
            <button
              type="button"
              disabled={downloadStep === 'syncing'}
              onClick={executeDownload}
              className={`w-full py-3 rounded-2xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-600/20 cursor-pointer transition active:scale-98 ${
                downloadStep === 'syncing' ? 'opacity-60 cursor-not-allowed' : ''
              }`}
            >
              <i className="fa-solid fa-file-arrow-down text-sm"></i>
              <span>{downloadStep === 'downloaded' ? 'Unduh Ulang Dokumen PDF (Real DB)' : 'Unduh Dokumen PDF Sekarang'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition"
            >
              <i className="fa-solid fa-arrow-right-to-bracket text-xs"></i>
              <span>Buka Aplikasi Sistem Multi-Skill Lengkap</span>
            </button>
          </div>
        </div>

        {/* Footer info */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 text-center text-[10.5px] text-slate-400 flex items-center justify-center gap-1.5">
          <i className="fa-solid fa-shield-halved text-emerald-500"></i>
          <span>Multi-Skill Monitoring System &bull; Ajinomoto Mojokerto Factory</span>
        </div>
      </div>
    </div>
  );
};

