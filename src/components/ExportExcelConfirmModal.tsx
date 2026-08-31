import React, { useState } from 'react';
import { Employee, AppFiltersState, UserSession } from '../types';
import { exportDatabaseExcel } from '../utils/excelExport';
import { AJINOMOTO_LOGO_URL } from '../utils/storage';
import { BULAN_LABELS } from '../data/initialData';
import confetti from 'canvas-confetti';

interface ExportExcelConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  filteredEmployees: Employee[];
  allEmployees: Employee[];
  filters: AppFiltersState;
  currentUser: UserSession;
  onExportSuccess?: (msg: string) => void;
}

export const ExportExcelConfirmModal: React.FC<ExportExcelConfirmModalProps> = ({
  isOpen,
  onClose,
  filteredEmployees,
  allEmployees,
  filters,
  currentUser,
  onExportSuccess
}) => {
  const [scope, setScope] = useState<'filtered' | 'all'>('filtered');
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const targetData = scope === 'filtered' ? filteredEmployees : allEmployees;
  const totalCount = targetData.length;
  const totalMS = targetData.filter((e) => e.result === 'MS').length;
  const totalUS = targetData.filter((e) => e.result === 'US').length;
  const percentMS = totalCount > 0 ? ((totalMS / totalCount) * 100).toFixed(1) : '0.0';

  const bulanLabelsText = filters.bulan.length
    ? filters.bulan.map((b) => BULAN_LABELS[Number(b) - 1] || b).join(', ')
    : 'Semua Bulan';

  const handleDownload = () => {
    setIsExporting(true);
    setTimeout(() => {
      const res = exportDatabaseExcel({
        scope,
        filteredEmployees,
        allEmployees,
        filters,
        currentUser
      });
      setIsExporting(false);

      try {
        confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
      } catch (_) {}

      const msg = `Berhasil mengunduh ${res.rowCount} data database Multi-Skill dalam format Excel resmi berlogo Ajinomoto.`;
      if (onExportSuccess) {
        onExportSuccess(msg);
      }
      onClose();
    }, 450);
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto pt-14 pb-8 sm:pt-20 sm:pb-12 px-3 sm:px-6 flex items-start sm:items-center justify-center animate-fadeIn">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/75 dark:bg-black/85 backdrop-blur-xs transition-opacity"
      />

      {/* Modal Dialog Card */}
      <div className="relative modal-panel bg-white dark:bg-slate-900 w-full max-w-2xl my-auto max-h-[86vh] sm:max-h-[82vh] flex flex-col overflow-hidden shadow-2xl z-10 border border-slate-200 dark:border-slate-800 animate-scaleUp">
        {/* Header */}
        <div className="modal-header px-5 sm:px-6 py-4 sm:py-5 flex items-start justify-between shrink-0 bg-gradient-to-r from-[#0E2340] to-[#173866]">
          <div className="text-white min-w-0 pr-4">
            <p className="eyebrow !text-amber-300 text-[10px] uppercase font-bold tracking-widest mb-1 flex items-center gap-1.5">
              <i className="fa-solid fa-file-excel text-emerald-400"></i> Konfirmasi Export Database
            </p>
            <h3 className="font-display font-extrabold text-lg sm:text-xl text-white flex items-center gap-2">
              <span>Download Database Excel (.xls)</span>
              <span className="badge-pill bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] px-2 py-0.5 font-bold">
                OFFICIAL REPORT
              </span>
            </h3>
            <p className="text-xs text-white/80 mt-0.5">
              Format tabel rapi dengan logo Ajinomoto, rekapitulasi KPI, dan seluruh 92 kolom skill matrix
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

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-5">
          {/* Company Preview Card */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 flex items-center gap-3.5 shadow-2xs">
            <div className="w-12 h-12 rounded-xl bg-white p-1 flex items-center justify-center shrink-0 border border-slate-200 shadow-xs">
              <img src={AJINOMOTO_LOGO_URL} alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                PT AJINOMOTO INDONESIA - PT AJINEX INTERNATIONAL
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Mojokerto Factory &bull; Multi-Skill Monitoring Portal Database
              </p>
            </div>
          </div>

          {/* Scope Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
              Pilih Cakupan Data yang Ingin Diunduh:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option 1: Filtered Data */}
              <label
                onClick={() => setScope('filtered')}
                className={`p-3.5 rounded-xl border-2 flex items-start gap-3 cursor-pointer transition select-none ${
                  scope === 'filtered'
                    ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/30 dark:border-emerald-500'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-850'
                }`}
              >
                <input
                  type="radio"
                  name="excelScope"
                  checked={scope === 'filtered'}
                  onChange={() => setScope('filtered')}
                  className="mt-1"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                      Data Terfilter Saat Ini
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold text-[11px]">
                      {filteredEmployees.length} Baris
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    Hanya data yang sesuai filter aktif (Tahun, Bulan, Divisi, Dept, Jabatan).
                  </p>
                </div>
              </label>

              {/* Option 2: All Data */}
              <label
                onClick={() => setScope('all')}
                className={`p-3.5 rounded-xl border-2 flex items-start gap-3 cursor-pointer transition select-none ${
                  scope === 'all'
                    ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/30 dark:border-emerald-500'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-850'
                }`}
              >
                <input
                  type="radio"
                  name="excelScope"
                  checked={scope === 'all'}
                  onChange={() => setScope('all')}
                  className="mt-1"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                      Seluruh Master Database
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 font-bold text-[11px]">
                      {allEmployees.length} Baris
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    Seluruh riwayat data karyawan di semua divisi dan periode.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Quick Statistics Summary */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <i className="fa-solid fa-chart-pie text-amber-500"></i> Ringkasan Data yang Akan Diexport:
              </span>
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                Total Kolom: 110 Kolom
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-750 text-center">
                <p className="text-[10px] uppercase font-bold text-slate-400">Total Karyawan</p>
                <p className="text-base font-extrabold text-[#0E2340] dark:text-slate-100">{totalCount}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center">
                <p className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400">Standar (MS)</p>
                <p className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">{totalMS}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-center">
                <p className="text-[10px] uppercase font-bold text-rose-700 dark:text-rose-400">Belum Standar</p>
                <p className="text-base font-extrabold text-rose-600 dark:text-rose-400">{totalUS}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-center">
                <p className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400">Pencapaian</p>
                <p className="text-base font-extrabold text-amber-700 dark:text-amber-400">{percentMS}%</p>
              </div>
            </div>

            {scope === 'filtered' && (
              <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-dashed border-slate-200 dark:border-slate-700">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Filter Terapan:</span> Tahun ({filters.tahun.join(', ') || 'Semua'}), Bulan ({bulanLabelsText}), Divisi ({filters.divisi.join(', ') || 'Semua'}), Dept ({filters.department.join(', ') || 'Semua'}), Jabatan ({filters.jabatan.join(', ') || 'Semua'})
              </div>
            )}
          </div>

          {/* Included Features Bullet Points */}
          <div className="p-3.5 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/60 text-xs text-slate-700 dark:text-slate-300 space-y-1.5">
            <p className="font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
              <i className="fa-solid fa-circle-check text-emerald-600 dark:text-emerald-400"></i> Format File Excel yang Dihasilkan:
            </p>
            <ul className="list-disc list-inside space-y-1 text-[11.5px] text-slate-600 dark:text-slate-300">
              <li>Kop surat resmi PT Ajinomoto Indonesia &amp; PT Ajinex International dengan <b>Logo Resmi Ajinomoto</b>.</li>
              <li>Tabel ringkasan KPI dan informasi metadata waktu &amp; PIC pencetakan laporan.</li>
              <li>14 kolom data profil karyawan lengkap (ID, Nama, Divisi, Department, Section, Grade, dll).</li>
              <li>92 kolom kode standar kompetensi teknis &amp; manajerial dengan highlight visual.</li>
              <li>4 kolom penilaian akhir: Total Score, Standard Target, Status Kelayakan (MS/US), dan GAP.</li>
            </ul>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-5 sm:px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/80 dark:bg-slate-900">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleDownload}
            disabled={isExporting || totalCount === 0}
            className="btn-navy px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50 hover:opacity-95 transition bg-emerald-700 hover:bg-emerald-800 text-white"
          >
            {isExporting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                <span>Menyiapkan Excel...</span>
              </>
            ) : (
              <>
                <i className="fa-solid fa-file-excel text-sm text-emerald-300"></i>
                <span>Unduh File Excel ({totalCount} Karyawan)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
