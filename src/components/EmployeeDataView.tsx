import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Employee, SkillMeta, PeriodsData } from '../types';
import { BULAN_LABELS, INITIAL_SKILL_META } from '../data/initialData';
import confetti from 'canvas-confetti';

interface EmployeeDataViewProps {
  employees: Employee[];
  filteredEmployees: Employee[];
  skillMeta: SkillMeta[];
  periods: PeriodsData;
  onUpdateSkill: (rowIndex: number, skillCode: string, checked: boolean) => void;
  onAddEmployee: (payload: any) => { success: boolean; message: string };
  onDeleteEmployee: (rowIndex: number, empName: string) => void;
  onOpenImportModal?: () => void;
  onOpenExcelModal?: () => void;
  onOpenPdfModal?: () => void;
}

export const EmployeeDataView: React.FC<EmployeeDataViewProps> = ({
  employees,
  filteredEmployees,
  skillMeta,
  periods,
  onUpdateSkill,
  onAddEmployee,
  onDeleteEmployee,
  onOpenImportModal,
  onOpenExcelModal,
  onOpenPdfModal
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'MS' | 'US'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Modals state
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [skillModalSearch, setSkillModalSearch] = useState('');

  // Add Employee Form State
  const [addForm, setAddForm] = useState({
    empId: '',
    empName: '',
    divisi: '',
    department: '',
    section: '',
    grade: '',
    jobGrade: '',
    jabatan: '',
    gender: 'L',
    pic: '',
    tahun: periods.currentTahun,
    bulan: periods.currentBulan
  });
  const [addAlert, setAddAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  // Filter with local search & status
  const displayedEmployees = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return filteredEmployees.filter((e) => {
      const matchQuery =
        !q || e.empName.toLowerCase().includes(q) || e.empId.toLowerCase().includes(q);
      const matchStatus =
        statusFilter === 'ALL' || (statusFilter === 'MS' && e.result === 'MS') || (statusFilter === 'US' && e.result === 'US');
      return matchQuery && matchStatus;
    });
  }, [filteredEmployees, searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(displayedEmployees.length / pageSize));
  const currentSafePage = Math.min(currentPage, totalPages);
  const startIdx = (currentSafePage - 1) * pageSize;
  const pageItems = displayedEmployees.slice(startIdx, startIdx + pageSize);

  // Active Employee for Skill Matrix Modal
  const activeEmployee = useMemo(() => {
    if (editingRowIndex === null) return null;
    return employees.find((e) => e.rowIndex === editingRowIndex) || null;
  }, [employees, editingRowIndex]);

  // Autocomplete Datalist sets
  const getUniqueValues = (key: keyof Employee): string[] => {
    const set: Record<string, boolean> = {};
    employees.forEach((e) => {
      const v = e[key];
      if (typeof v === 'string' && v.trim()) set[v.trim()] = true;
    });
    return Object.keys(set).sort();
  };

  const initialsOf = (name: string): string => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const getPeriodeText = (e: Employee): string => {
    if (!e.tahun) return '-';
    const bName = e.bulan ? BULAN_LABELS[e.bulan - 1] || e.bulan : '';
    return `${bName} ${e.tahun}`.trim();
  };

  // Handle Add Form Submission
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAddAlert(null);

    if (!addForm.empId.trim() || !addForm.empName.trim()) {
      setAddAlert({ type: 'error', message: 'Emp. ID dan Nama Karyawan wajib diisi.' });
      return;
    }

    setIsSubmittingAdd(true);
    setTimeout(() => {
      const res = onAddEmployee({
        ...addForm,
        tahun: Number(addForm.tahun),
        bulan: Number(addForm.bulan)
      });
      setIsSubmittingAdd(false);

      if (res.success) {
        setAddAlert({ type: 'success', message: res.message });
        try {
          confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
        } catch (_) {}
        setTimeout(() => {
          setIsAddModalOpen(false);
          setAddAlert(null);
          setAddForm({
            empId: '',
            empName: '',
            divisi: '',
            department: '',
            section: '',
            grade: '',
            jobGrade: '',
            jabatan: '',
            gender: 'L',
            pic: '',
            tahun: periods.currentTahun,
            bulan: periods.currentBulan
          });
        }, 800);
      } else {
        setAddAlert({ type: 'error', message: res.message });
      }
    }, 300);
  };

  // Skill Matrix grouping
  const filteredSkillGroups = useMemo(() => {
    const q = skillModalSearch.trim().toLowerCase();
    const groups: Record<string, SkillMeta[]> = {};

    skillMeta.forEach((s) => {
      const match = !q || s.code.toLowerCase().includes(q) || s.family.toLowerCase().includes(q);
      if (match) {
        if (!groups[s.group]) groups[s.group] = [];
        groups[s.group].push(s);
      }
    });
    return groups;
  }, [skillMeta, skillModalSearch]);

  const activeMasteredCount = activeEmployee
    ? Object.values(activeEmployee.skills).filter(Boolean).length
    : 0;
  const activeMasteredPercent = skillMeta.length
    ? Math.round((activeMasteredCount / skillMeta.length) * 100)
    : 0;

  return (
    <div className="space-y-4">
      {/* TOOLBAR LOKAL: SEARCH + STATUS + ADD BUTTON */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="card-elegant p-4 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between"
      >
        <div className="relative flex-1 max-w-md">
          <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Cari berdasarkan nama karyawan atau Emp. ID / NIK..."
            className="input-elegant w-full pl-9 pr-3 py-2 outline-none text-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
          />
        </div>

        <div className="flex flex-wrap gap-2.5 items-center">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as any);
              setCurrentPage(1);
            }}
            className="input-elegant text-xs sm:text-sm px-3 py-2 outline-none font-semibold cursor-pointer bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
          >
            <option value="ALL">Semua Karyawan (MS &amp; US)</option>
            <option value="MS">Memenuhi Standar (MS)</option>
            <option value="US">Perlu Peningkatan (US)</option>
          </select>

          {onOpenPdfModal && (
            <motion.button
              type="button"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              onClick={onOpenPdfModal}
              className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 whitespace-nowrap shadow-sm cursor-pointer hover:opacity-95 transition bg-red-700 hover:bg-red-800 text-white"
              title="Cetak & Unduh Laporan PDF Resmi Standar PT Ajinomoto Indonesia"
            >
              <i className="fa-solid fa-file-pdf text-xs text-red-200"></i>
              <span>Laporan PDF</span>
            </motion.button>
          )}

          {onOpenExcelModal && (
            <motion.button
              type="button"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              onClick={onOpenExcelModal}
              className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 whitespace-nowrap shadow-sm cursor-pointer hover:opacity-95 transition bg-emerald-700 hover:bg-emerald-800 text-white"
              title="Unduh data ke file Excel resmi berlogo Ajinomoto"
            >
              <i className="fa-solid fa-file-excel text-xs text-emerald-300"></i>
              <span>Unduh Excel</span>
            </motion.button>
          )}

          {onOpenImportModal && (
            <motion.button
              type="button"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              onClick={onOpenImportModal}
              className="btn-gold px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 whitespace-nowrap shadow-sm cursor-pointer hover:opacity-95 transition"
            >
              <i className="fa-solid fa-cloud-arrow-down text-xs"></i>
              <span>Impor / Sinkronisasi</span>
            </motion.button>
          )}

          <motion.button
            type="button"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => {
              setAddAlert(null);
              setIsAddModalOpen(true);
            }}
            className="btn-navy px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 whitespace-nowrap shadow-sm cursor-pointer"
          >
            <i className="fa-solid fa-user-plus text-xs"></i> Tambah Karyawan
          </motion.button>
        </div>
      </motion.div>

      {/* TABLE */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05 }}
        className="card-elegant overflow-hidden"
      >
        {/* Mobile Swipe Hint */}
        <div className="sm:hidden flex items-center justify-between px-3.5 py-1.5 bg-slate-100/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-white/10 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <i className="fa-solid fa-arrows-left-right text-amber-500"></i>
            <span>Geser ke samping untuk melihat seluruh kolom data</span>
          </span>
          <span className="font-semibold text-slate-600 dark:text-slate-300">{displayedEmployees.length} Karyawan</span>
        </div>

        <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full text-sm min-w-[780px]">
            <thead>
              <tr
                className="text-left text-[11px] uppercase tracking-wider border-b bg-slate-50 dark:bg-[#081220] border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300"
              >
                <th className="px-4 py-3.5 font-bold">Emp. ID</th>
                <th className="px-4 py-3.5 font-bold">Nama Karyawan</th>
                <th className="px-4 py-3.5 font-bold">Divisi / Department</th>
                <th className="px-4 py-3.5 font-bold">Jabatan</th>
                <th className="px-4 py-3.5 font-bold text-center">Periode</th>
                <th className="px-4 py-3.5 font-bold text-center">Skor</th>
                <th className="px-4 py-3.5 font-bold text-center">Standard</th>
                <th className="px-4 py-3.5 font-bold text-center">Status</th>
                <th className="px-4 py-3.5 font-bold text-center">Aksi</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-white/10">
              {pageItems.length > 0 ? (
                pageItems.map((e, idx) => {
                  const isMS = e.result === 'MS';
                  return (
                    <motion.tr
                      key={e.rowIndex}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: Math.min(idx * 0.02, 0.25) }}
                      className="hover:bg-blue-50/40 dark:hover:bg-[#0E2340]/60 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-slate-500 font-semibold">{e.empId}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="avatar-chip shadow-xs">{initialsOf(e.empName)}</div>
                          <span className="font-semibold text-slate-800 dark:text-slate-100">{e.empName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        <span className="block font-medium">{e.divisi || '-'}</span>
                        <span className="block text-xs text-slate-400">{e.department || '-'}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300 text-xs sm:text-sm font-medium">{e.jabatan || '-'}</td>
                      <td className="px-4 py-3 text-center text-xs text-slate-500 font-medium whitespace-nowrap">
                        {getPeriodeText(e)}
                      </td>
                      <td className="px-4 py-3 text-center font-extrabold text-base text-slate-900 dark:text-amber-400">
                        {e.totalScore}
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-slate-500 font-semibold">
                        {e.standard !== null ? `≥ ${e.standard}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isMS ? (
                          <span className="badge-pill badge-ms">
                            <i className="fa-solid fa-circle-check"></i> MS
                          </span>
                        ) : e.result === 'US' ? (
                          <span className="badge-pill badge-us">
                            <i className="fa-solid fa-circle-xmark"></i> US
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.12 }}
                            whileTap={{ scale: 0.92 }}
                            onClick={() => setEditingRowIndex(e.rowIndex)}
                            title="Edit Skill Matrix"
                            className="w-8 h-8 rounded-xl flex items-center justify-center text-xs transition-colors cursor-pointer bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-600 hover:text-white dark:bg-blue-500/25 dark:text-blue-300 dark:border-blue-400/40 dark:hover:bg-blue-600 dark:hover:text-white shadow-xs"
                          >
                            <i className="fa-solid fa-pen-to-square"></i>
                          </motion.button>
                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.12 }}
                            whileTap={{ scale: 0.92 }}
                            onClick={() => onDeleteEmployee(e.rowIndex, e.empName)}
                            title="Hapus Baris Karyawan"
                            className="w-8 h-8 rounded-xl flex items-center justify-center text-xs transition-colors cursor-pointer bg-red-50 text-red-700 border border-red-200 hover:bg-red-600 hover:text-white dark:bg-red-500/25 dark:text-red-300 dark:border-red-400/40 dark:hover:bg-red-600 dark:hover:text-white shadow-xs"
                          >
                            <i className="fa-solid fa-trash"></i>
                          </motion.button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                    <i className="fa-regular fa-folder-open text-2xl mb-2 block text-amber-500"></i>
                    Belum ditemukan data karyawan yang sesuai dengan kata kunci pencarian atau filter aktif.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        <div className="flex items-center justify-between px-4 py-3.5 border-t border-slate-200 dark:border-white/10 text-xs text-slate-500 bg-white dark:bg-[#0A192F]">
          <p>
            {displayedEmployees.length === 0
              ? 'Menampilkan 0 dari 0 karyawan'
              : `Menampilkan ${startIdx + 1}-${Math.min(startIdx + pageSize, displayedEmployees.length)} dari ${displayedEmployees.length} karyawan`}
          </p>
          <div className="flex items-center gap-2">
            <motion.button
              type="button"
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              disabled={currentSafePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="page-nav-btn cursor-pointer disabled:opacity-40"
              title="Halaman Sebelumnya"
            >
              <i className="fa-solid fa-chevron-left text-[10px]"></i>
            </motion.button>
            <span className="px-2 font-bold text-slate-700 dark:text-slate-300">
              {currentSafePage} / {totalPages}
            </span>
            <motion.button
              type="button"
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              disabled={currentSafePage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="page-nav-btn cursor-pointer disabled:opacity-40"
              title="Halaman Berikutnya"
            >
              <i className="fa-solid fa-chevron-right text-[10px]"></i>
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* ================= MODAL: EDIT SKILL MATRIX ================= */}
      <AnimatePresence>
        {activeEmployee && (
          <div className="fixed inset-0 z-[100] overflow-y-auto pt-14 pb-8 sm:pt-20 sm:pb-12 px-3 sm:px-6 flex items-start sm:items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setEditingRowIndex(null)}
              className="fixed inset-0 bg-slate-950/75 dark:bg-black/85 backdrop-blur-xs"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 15 }}
              transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
              className="relative modal-panel bg-white dark:bg-slate-900 w-full max-w-3xl my-auto max-h-[86vh] sm:max-h-[82vh] flex flex-col overflow-hidden shadow-2xl z-10 border border-slate-200 dark:border-slate-800"
            >
              {/* Modal Header */}
              <div className="modal-header px-5 sm:px-6 py-4 sm:py-5 flex items-start justify-between shrink-0 bg-gradient-to-r from-[#0E2340] to-[#173866]">
                <div className="text-white min-w-0 pr-4">
                  <p className="eyebrow !text-amber-300 text-[10px] uppercase font-bold tracking-widest mb-1">
                    Kompetensi Skill Matrix
                  </p>
                  <h3 className="font-display font-extrabold text-lg sm:text-xl truncate text-white">{activeEmployee.empName}</h3>
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 text-white text-[11px] font-mono font-bold">
                      <i className="fa-solid fa-id-badge text-[10px]"></i> {activeEmployee.empId}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 text-white text-[11px] font-semibold">
                      <i className="fa-solid fa-briefcase text-[10px]"></i> {activeEmployee.jabatan || '-'}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 text-white text-[11px] font-semibold">
                      <i className="fa-solid fa-diagram-project text-[10px]"></i> {activeEmployee.divisi || '-'}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 text-white text-[11px] font-semibold">
                      <i className="fa-solid fa-calendar-days text-[10px]"></i> {getPeriodeText(activeEmployee)}
                    </span>
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setEditingRowIndex(null)}
                  className="text-white/80 hover:text-white h-8 w-8 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 shrink-0 transition cursor-pointer"
                  aria-label="Tutup"
                >
                  <i className="fa-solid fa-xmark text-base"></i>
                </motion.button>
              </div>

              {/* Score & Search Bar */}
              <div className="px-5 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 shrink-0 space-y-3 bg-slate-50/80 dark:bg-slate-850">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="relative flex-1">
                    <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                    <input
                      type="text"
                      value={skillModalSearch}
                      onChange={(e) => setSkillModalSearch(e.target.value)}
                      placeholder="Cari kode seksi kompetensi atau deskripsi..."
                      className="input-elegant w-full pl-8 pr-3 py-1.5 outline-none text-xs sm:text-sm text-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div className="flex items-center gap-3 text-xs shrink-0">
                    <span className="text-slate-600 dark:text-slate-300 font-medium whitespace-nowrap">
                      Dikuasai:{' '}
                      <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">{activeMasteredCount}</span> /{' '}
                      <span className="font-semibold text-slate-600 dark:text-slate-400">{INITIAL_SKILL_META.length}</span>
                    </span>

                    <span
                      className={`badge-pill text-xs ${
                        activeEmployee.result === 'MS' ? 'badge-ms' : 'badge-us'
                      }`}
                    >
                      {activeEmployee.result === 'MS' ? (
                        <>
                          <i className="fa-solid fa-circle-check"></i> MS (Standard &ge; {activeEmployee.standard})
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-circle-xmark"></i> US (GAP {activeEmployee.gap})
                        </>
                      )}
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="progress-track bg-slate-200 dark:bg-slate-700">
                  <div className="progress-fill" style={{ width: `${activeMasteredPercent}%` }} />
                </div>
              </div>

              {/* 90+ Skill Checklists Grouped by Section */}
              <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 sm:py-5 space-y-5">
                {Object.keys(filteredSkillGroups).length > 0 ? (
                  Object.keys(filteredSkillGroups).map((groupName) => (
                    <div key={groupName}>
                      <p className="form-section-label mb-2.5 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)]"></span>
                        {groupName}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {filteredSkillGroups[groupName].map((skill) => {
                          const isChecked = !!activeEmployee.skills[skill.code];
                          return (
                            <motion.label
                              key={skill.code}
                              whileHover={{ scale: 1.018, y: -1 }}
                              whileTap={{ scale: 0.985 }}
                              className={`skill-chip ${isChecked ? 'is-checked' : ''} select-none cursor-pointer`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => onUpdateSkill(activeEmployee.rowIndex, skill.code, e.target.checked)}
                                className="mt-0.5 cursor-pointer"
                              />
                              <span className="text-xs leading-tight min-w-0">
                                <span className="block font-bold text-slate-800 dark:text-slate-100">{skill.code}</span>
                                <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{skill.family}</span>
                              </span>
                            </motion.label>
                          );
                        })}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400 text-center py-10">
                    <i className="fa-regular fa-face-frown text-xl mb-2 block" style={{ color: 'var(--gold-light)' }}></i>
                    Tidak ada seksi kompetensi yang cocok dengan pencarian.
                  </p>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-5 sm:px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 shrink-0 bg-slate-50/80 dark:bg-slate-900">
                <span className="flex items-center gap-1.5">
                  <i className="fa-solid fa-circle-check text-emerald-500"></i>
                  <span>Perubahan tersimpan otomatis secara real-time.</span>
                </span>
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setEditingRowIndex(null)}
                  className="btn-navy px-5 py-2 rounded-xl text-sm font-bold shadow-sm cursor-pointer hover:opacity-95 transition"
                >
                  Selesai
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= MODAL: TAMBAH KARYAWAN ================= */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[100] overflow-y-auto pt-14 pb-8 sm:pt-20 sm:pb-12 px-3 sm:px-6 flex items-start sm:items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsAddModalOpen(false)}
              className="fixed inset-0 bg-slate-950/75 dark:bg-black/85 backdrop-blur-xs"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 15 }}
              transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
              className="relative modal-panel bg-white dark:bg-slate-900 w-full max-w-2xl my-auto max-h-[86vh] sm:max-h-[82vh] flex flex-col overflow-hidden shadow-2xl z-10 border border-slate-200 dark:border-slate-800"
            >
              {/* Header */}
              <div className="modal-header px-5 sm:px-6 py-4 sm:py-5 flex items-start justify-between shrink-0 bg-gradient-to-r from-[#0E2340] to-[#173866]">
                <div className="text-white">
                  <p className="eyebrow !text-amber-300 text-[10px] uppercase font-bold tracking-widest mb-1">
                    Pendaftaran Karyawan
                  </p>
                  <h3 className="font-display font-extrabold text-lg sm:text-xl text-white">Tambah Data Karyawan Baru</h3>
                  <p className="text-xs text-white/80 mt-0.5">
                    Lengkapi data profil dan jabatan untuk memetakan standar kompetensi multi-skill.
                  </p>
                </div>

                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setIsAddModalOpen(false)}
                  className="text-white/80 hover:text-white h-8 w-8 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 shrink-0 transition cursor-pointer"
                  aria-label="Tutup"
                >
                  <i className="fa-solid fa-xmark text-base"></i>
                </motion.button>
              </div>

              {/* Form */}
              <form onSubmit={handleAddSubmit} id="add-employee-form" className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 sm:py-5 space-y-5">
                {addAlert && (
                  <div
                    className={`rounded-xl px-3.5 py-2.5 text-xs font-semibold flex items-center gap-2 ${
                      addAlert.type === 'success'
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                        : 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                    }`}
                  >
                    <i className={`fa-solid ${addAlert.type === 'success' ? 'fa-check' : 'fa-circle-exclamation'}`}></i>
                    <span>{addAlert.message}</span>
                  </div>
                )}

                {/* 1. Identitas */}
                <div>
                  <p className="form-section-label mb-3 flex items-center gap-1.5">
                    <i className="fa-solid fa-id-card text-amber-600 dark:text-amber-400"></i> Identitas Karyawan
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Emp. ID *</label>
                      <input
                        type="text"
                        required
                        value={addForm.empId}
                        onChange={(e) => setAddForm({ ...addForm, empId: e.target.value })}
                        placeholder="mis. AJN-MJK-0150"
                        className="input-elegant w-full px-3 py-2 outline-none text-sm font-semibold font-mono text-slate-800 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Nama Karyawan *</label>
                      <input
                        type="text"
                        required
                        value={addForm.empName}
                        onChange={(e) => setAddForm({ ...addForm, empName: e.target.value })}
                        placeholder="mis. Hendra Wijaya"
                        className="input-elegant w-full px-3 py-2 outline-none text-sm font-semibold text-slate-800 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Gender (L/P)</label>
                      <select
                        value={addForm.gender}
                        onChange={(e) => setAddForm({ ...addForm, gender: e.target.value })}
                        className="input-elegant w-full px-3 py-2 outline-none text-sm font-semibold cursor-pointer text-slate-800 dark:text-slate-100"
                      >
                        <option value="L">Laki-laki (L)</option>
                        <option value="P">Perempuan (P)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">PIC</label>
                      <input
                        type="text"
                        list="dl-pic"
                        value={addForm.pic}
                        onChange={(e) => setAddForm({ ...addForm, pic: e.target.value })}
                        placeholder="mis. Mahmud Nurdiansyah"
                        className="input-elegant w-full px-3 py-2 outline-none text-sm text-slate-800 dark:text-slate-100"
                      />
                      <datalist id="dl-pic">
                        {getUniqueValues('pic').map((v) => (
                          <option key={v} value={v} />
                        ))}
                      </datalist>
                    </div>
                  </div>
                </div>

                {/* 2. Struktur Organisasi */}
                <div className="hairline-dashed pt-4">
                  <p className="form-section-label mb-3 flex items-center gap-1.5">
                    <i className="fa-solid fa-sitemap text-amber-600 dark:text-amber-400"></i> Struktur Organisasi
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Divisi</label>
                      <input
                        type="text"
                        list="dl-divisi"
                        value={addForm.divisi}
                        onChange={(e) => setAddForm({ ...addForm, divisi: e.target.value })}
                        placeholder="mis. Produksi MSG & Seasoning"
                        className="input-elegant w-full px-3 py-2 outline-none text-sm text-slate-800 dark:text-slate-100"
                      />
                      <datalist id="dl-divisi">
                        {getUniqueValues('divisi').map((v) => (
                          <option key={v} value={v} />
                        ))}
                      </datalist>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Department</label>
                      <input
                        type="text"
                        list="dl-department"
                        value={addForm.department}
                        onChange={(e) => setAddForm({ ...addForm, department: e.target.value })}
                        placeholder="mis. Fermentation Department"
                        className="input-elegant w-full px-3 py-2 outline-none text-sm text-slate-800 dark:text-slate-100"
                      />
                      <datalist id="dl-department">
                        {getUniqueValues('department').map((v) => (
                          <option key={v} value={v} />
                        ))}
                      </datalist>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Section</label>
                      <input
                        type="text"
                        list="dl-section"
                        value={addForm.section}
                        onChange={(e) => setAddForm({ ...addForm, section: e.target.value })}
                        placeholder="mis. Inoculum Section"
                        className="input-elegant w-full px-3 py-2 outline-none text-sm text-slate-800 dark:text-slate-100"
                      />
                      <datalist id="dl-section">
                        {getUniqueValues('section').map((v) => (
                          <option key={v} value={v} />
                        ))}
                      </datalist>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Grade</label>
                      <input
                        type="text"
                        list="dl-grade"
                        value={addForm.grade}
                        onChange={(e) => setAddForm({ ...addForm, grade: e.target.value })}
                        placeholder="mis. ST4, M2, M3"
                        className="input-elegant w-full px-3 py-2 outline-none text-sm font-semibold text-slate-800 dark:text-slate-100"
                      />
                      <datalist id="dl-grade">
                        {getUniqueValues('grade').map((v) => (
                          <option key={v} value={v} />
                        ))}
                      </datalist>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Jabatan *</label>
                      <input
                        type="text"
                        required
                        list="dl-jabatan"
                        value={addForm.jabatan}
                        onChange={(e) => setAddForm({ ...addForm, jabatan: e.target.value })}
                        placeholder="mis. Line Leader, Section Manager"
                        className="input-elegant w-full px-3 py-2 outline-none text-sm font-semibold text-slate-800 dark:text-slate-100"
                      />
                      <datalist id="dl-jabatan">
                        {getUniqueValues('jabatan').map((v) => (
                          <option key={v} value={v} />
                        ))}
                      </datalist>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                        Menentukan threshold standard (LL/Foreman &ge;2, ASM-SM &ge;3, Dept. Manager up &ge;4).
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Job Grade</label>
                      <input
                        type="text"
                        value={addForm.jobGrade}
                        onChange={(e) => setAddForm({ ...addForm, jobGrade: e.target.value })}
                        placeholder="mis. JG-06"
                        className="input-elegant w-full px-3 py-2 outline-none text-sm text-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Periode */}
                <div className="hairline-dashed pt-4">
                  <p className="form-section-label mb-3 flex items-center gap-1.5">
                    <i className="fa-solid fa-calendar-days text-amber-600 dark:text-amber-400"></i> Periode Baseline
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Tahun *</label>
                      <select
                        value={addForm.tahun}
                        onChange={(e) => setAddForm({ ...addForm, tahun: Number(e.target.value) })}
                        className="input-elegant w-full px-3 py-2 outline-none text-sm font-semibold cursor-pointer text-slate-800 dark:text-slate-100"
                      >
                        {[2024, 2025, 2026, 2027].map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Bulan *</label>
                      <select
                        value={addForm.bulan}
                        onChange={(e) => setAddForm({ ...addForm, bulan: Number(e.target.value) })}
                        className="input-elegant w-full px-3 py-2 outline-none text-sm font-semibold cursor-pointer text-slate-800 dark:text-slate-100"
                      >
                        {BULAN_LABELS.map((b, idx) => (
                          <option key={idx + 1} value={idx + 1}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </form>

              {/* Modal Footer */}
              <div className="px-5 sm:px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/80 dark:bg-slate-900">
                <span className="text-xs text-slate-500 dark:text-slate-400">* wajib diisi</span>
                <motion.button
                  type="submit"
                  form="add-employee-form"
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  disabled={isSubmittingAdd}
                  className="btn-navy px-5 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-60 hover:opacity-95 transition"
                >
                  {isSubmittingAdd ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <span>Simpan Karyawan</span>
                      <i className="fa-solid fa-check text-xs"></i>
                    </>
                  )}
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
