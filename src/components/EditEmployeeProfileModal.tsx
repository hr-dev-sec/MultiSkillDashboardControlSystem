import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Employee, PeriodsData } from '../types';
import { BULAN_LABELS, getStandardForJabatan, CONFIG_META } from '../data/initialData';
import confetti from 'canvas-confetti';

interface EditEmployeeProfileModalProps {
  isOpen: boolean;
  employee: Employee | null;
  periods: PeriodsData;
  onClose: () => void;
  onSave: (rowIndex: number, updatedProfile: any) => { success: boolean; message: string };
  uniqueValues: (key: keyof Employee) => string[];
}

const COMMON_JABATAN_OPTIONS = [
  'Department Manager',
  'Section Manager',
  'Associate Manager',
  'Assistant Manager',
  'Line Leader',
  'Foreman',
  'Assistant Foreman',
  'Operator Produksi',
  'Maintenance Technician',
  'Quality Control Analyst',
  'Warehouse Officer'
];

export const EditEmployeeProfileModal: React.FC<EditEmployeeProfileModalProps> = ({
  isOpen,
  employee,
  periods,
  onClose,
  onSave,
  uniqueValues
}) => {
  const [formData, setFormData] = useState({
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
    tanggalPensiun: '',
    tahun: periods.currentTahun,
    bulan: periods.currentBulan,
    autoAdjustStandard: true,
    customStandard: null as number | null
  });

  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync state when active employee changes
  useEffect(() => {
    if (employee) {
      setFormData({
        empId: employee.empId || '',
        empName: employee.empName || '',
        divisi: employee.divisi || '',
        department: employee.department || '',
        section: employee.section || '',
        grade: employee.grade || '',
        jobGrade: employee.jobGrade || '',
        jabatan: employee.jabatan || '',
        gender: employee.gender || 'L',
        pic: employee.pic || '',
        tanggalPensiun: employee.tanggalPensiun || '',
        tahun: employee.tahun || periods.currentTahun,
        bulan: employee.bulan || periods.currentBulan,
        autoAdjustStandard: true,
        customStandard: employee.standard
      });
      setAlert(null);
    }
  }, [employee, periods]);

  // Compute live recommendation for standard according to the currently typed/selected jabatan
  const standardInfo = useMemo(() => {
    return getStandardForJabatan(formData.jabatan);
  }, [formData.jabatan]);

  // Effective standard to display
  const effectiveStandard = useMemo(() => {
    if (formData.autoAdjustStandard) {
      return standardInfo.standard;
    }
    return formData.customStandard !== null && !isNaN(Number(formData.customStandard)) && Number(formData.customStandard) > 0
      ? Number(formData.customStandard)
      : standardInfo.standard;
  }, [formData.autoAdjustStandard, formData.customStandard, standardInfo.standard]);

  // Simulated status with employee's current totalScore
  const simulation = useMemo(() => {
    const currentScore = employee ? employee.totalScore : 0;
    const isMS = currentScore >= effectiveStandard;
    const gap = currentScore - effectiveStandard;
    return {
      currentScore,
      isMS,
      gap,
      needed: Math.max(0, effectiveStandard - currentScore)
    };
  }, [employee, effectiveStandard]);

  if (!isOpen || !employee) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.empName.trim() || !formData.empId.trim() || !formData.jabatan.trim()) {
      setAlert({ type: 'error', message: 'Emp. ID, Nama Karyawan, dan Jabatan wajib diisi.' });
      return;
    }

    setIsSubmitting(true);
    setAlert(null);

    try {
      const payload = {
        empId: formData.empId.trim(),
        empName: formData.empName.trim(),
        divisi: formData.divisi.trim(),
        department: formData.department.trim(),
        section: formData.section.trim(),
        grade: formData.grade.trim(),
        jobGrade: formData.jobGrade.trim(),
        jabatan: formData.jabatan.trim(),
        gender: formData.gender,
        pic: formData.pic.trim(),
        tanggalPensiun: formData.tanggalPensiun.trim(),
        tahun: Number(formData.tahun),
        bulan: Number(formData.bulan),
        autoAdjustStandard: formData.autoAdjustStandard,
        customStandard: formData.autoAdjustStandard ? null : formData.customStandard
      };

      const res = onSave(employee.rowIndex, payload);

      if (res.success) {
        setAlert({ type: 'success', message: res.message });
        try {
          confetti({
            particleCount: 50,
            spread: 60,
            origin: { y: 0.6 }
          });
        } catch (_) {}

        setTimeout(() => {
          setIsSubmitting(false);
          onClose();
        }, 1200);
      } else {
        setAlert({ type: 'error', message: res.message });
        setIsSubmitting(false);
      }
    } catch (err: any) {
      setAlert({ type: 'error', message: err?.message || 'Gagal memperbarui profil karyawan.' });
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] overflow-y-auto pt-10 pb-10 px-3 sm:px-6 flex items-start sm:items-center justify-center">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs"
      />

      {/* Modal Dialog */}
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 16 }}
        transition={{ type: 'spring', duration: 0.35, bounce: 0.15 }}
        className="relative modal-panel bg-white dark:bg-slate-900 w-full max-w-3xl my-auto max-h-[90vh] flex flex-col overflow-hidden shadow-2xl z-10 border border-slate-200 dark:border-slate-800"
      >
        {/* Modal Header */}
        <div className="modal-header px-5 sm:px-6 py-4 sm:py-5 flex items-start justify-between shrink-0 bg-gradient-to-r from-[#0E2340] via-[#14325c] to-[#1a3f73] text-white">
          <div className="min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded-md text-[10px] uppercase font-bold tracking-widest bg-amber-400/20 text-amber-300 border border-amber-400/30 flex items-center gap-1">
                <i className="fa-solid fa-user-pen text-[9px]"></i>
                Edit Profil Karyawan
              </span>
              <span className="text-white/60 text-xs">•</span>
              <span className="text-xs text-white/80 font-mono font-bold">
                {employee.empId}
              </span>
            </div>
            <h3 className="font-display font-extrabold text-lg sm:text-xl truncate text-white">
              {employee.empName}
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Sesuaikan profil (jabatan, divisi, department, seksi) dengan kalkulasi standar otomatis standar Ajinomoto.
            </p>
          </div>

          <motion.button
            type="button"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="text-white/80 hover:text-white h-8 w-8 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 shrink-0 transition cursor-pointer"
            aria-label="Tutup"
          >
            <i className="fa-solid fa-xmark text-base"></i>
          </motion.button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} id="edit-employee-profile-form" className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 sm:py-5 space-y-6">
          {alert && (
            <div
              className={`rounded-xl px-4 py-3 text-xs font-semibold flex items-center gap-2.5 animate-fadeIn ${
                alert.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shadow-xs'
                  : 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800 shadow-xs'
              }`}
            >
              <i className={`fa-solid ${alert.type === 'success' ? 'fa-circle-check text-base text-emerald-500' : 'fa-circle-exclamation text-base text-rose-500'}`}></i>
              <div className="flex-1 leading-relaxed">{alert.message}</div>
            </div>
          )}

          {/* 1. JABATAN & STANDAR OTOMATIS (FEATURED FIRST & HIGHLIGHTED) */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-amber-50/70 via-slate-50 to-blue-50/50 dark:from-amber-950/20 dark:via-slate-850 dark:to-blue-950/20 border-2 border-amber-300/80 dark:border-amber-500/30 shadow-xs">
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <p className="font-display font-extrabold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <i className="fa-solid fa-briefcase text-amber-600 dark:text-amber-400 text-base"></i>
                <span>Jabatan &amp; Standar Kompetensi Otomatis</span>
              </p>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                <i className="fa-solid fa-wand-magic-sparkles mr-1 text-[10px]"></i>
                Auto-Adaptive Standard
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Jabatan Pekerjaan <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    list="dl-edit-jabatan"
                    value={formData.jabatan}
                    onChange={(e) => setFormData({ ...formData, jabatan: e.target.value })}
                    placeholder="Contoh: Department Manager, Section Manager, Line Leader..."
                    className="input-elegant w-full px-3.5 py-2.5 outline-none text-sm font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-900 border-amber-300/80 dark:border-amber-500/40 focus:ring-2 focus:ring-amber-400"
                  />
                  <datalist id="dl-edit-jabatan">
                    {uniqueValues('jabatan').map((v) => (
                      <option key={v} value={v} />
                    ))}
                    {COMMON_JABATAN_OPTIONS.map((v) => (
                      <option key={`preset-${v}`} value={v} />
                    ))}
                  </datalist>
                </div>

                {/* Quick select buttons */}
                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                    Pilih Cepat:
                  </span>
                  {COMMON_JABATAN_OPTIONS.slice(0, 6).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setFormData({ ...formData, jabatan: opt })}
                      className={`text-[11px] px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                        formData.jabatan.toLowerCase() === opt.toLowerCase()
                          ? 'bg-amber-500 text-slate-950 font-bold border-amber-500 shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-amber-400'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* LIVE ADAPTIVE STANDARD PREVIEW CARD */}
              <div className="mt-3 p-3.5 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        Kategori Terdeteksi:
                      </span>
                      <span className="font-extrabold text-xs text-slate-900 dark:text-slate-100 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        {standardInfo.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        Standar yang Diterapkan:
                      </span>
                      <span className="font-mono font-black text-sm text-amber-600 dark:text-amber-400">
                        ≥ {effectiveStandard} Skill
                      </span>
                      {formData.autoAdjustStandard ? (
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.5 rounded">
                          (Otomatis sesuai jabatan)
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 px-1.5 py-0.5 rounded">
                          (Kustom manual)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Simulation with current score */}
                  <div className="sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 dark:border-slate-800">
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      Skor Sekarang: <span className="font-black text-slate-900 dark:text-white text-xs">{simulation.currentScore}</span> Skill
                    </div>
                    <div className="mt-1">
                      {simulation.isMS ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700">
                          <i className="fa-solid fa-circle-check text-emerald-500"></i>
                          <span>MS (GAP +{simulation.gap})</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-700">
                          <i className="fa-solid fa-circle-xmark text-rose-500"></i>
                          <span>US (Kurang {simulation.needed})</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Auto adjust standard toggle */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs flex-wrap gap-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600 dark:text-slate-300 font-medium">
                    <input
                      type="checkbox"
                      checked={formData.autoAdjustStandard}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setFormData({
                          ...formData,
                          autoAdjustStandard: checked,
                          customStandard: checked ? null : standardInfo.standard
                        });
                      }}
                      className="rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                    <span>Otomatis sesuaikan standar jika jabatan diubah (Rekomendasi PT Ajinomoto)</span>
                  </label>

                  {!formData.autoAdjustStandard && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500 font-semibold">Standar Kustom:</span>
                      <input
                        type="number"
                        min="1"
                        max="92"
                        value={formData.customStandard ?? standardInfo.standard}
                        onChange={(e) => setFormData({ ...formData, customStandard: Number(e.target.value) })}
                        className="w-16 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-bold text-center"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, autoAdjustStandard: true, customStandard: null })}
                        className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline font-bold"
                      >
                        Reset ke Standar Jabatan
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 2. STRUKTUR ORGANISASI (DIVISI, DEPARTMENT, SEKSI) */}
          <div>
            <p className="form-section-label mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              <i className="fa-solid fa-sitemap text-amber-600 dark:text-amber-400"></i>
              <span>Struktur Organisasi (Divisi, Department &amp; Seksi)</span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Divisi
                </label>
                <input
                  type="text"
                  list="dl-edit-divisi"
                  value={formData.divisi}
                  onChange={(e) => setFormData({ ...formData, divisi: e.target.value })}
                  placeholder="mis. Produksi MSG & Seasoning"
                  className="input-elegant w-full px-3 py-2 outline-none text-sm text-slate-800 dark:text-slate-100"
                />
                <datalist id="dl-edit-divisi">
                  {uniqueValues('divisi').map((v) => (
                    <option key={v} value={v} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Departemen
                </label>
                <input
                  type="text"
                  list="dl-edit-department"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  placeholder="mis. Fermentation Department"
                  className="input-elegant w-full px-3 py-2 outline-none text-sm text-slate-800 dark:text-slate-100"
                />
                <datalist id="dl-edit-department">
                  {uniqueValues('department').map((v) => (
                    <option key={v} value={v} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Seksi / Section
                </label>
                <input
                  type="text"
                  list="dl-edit-section"
                  value={formData.section}
                  onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                  placeholder="mis. Inoculum & Media Section"
                  className="input-elegant w-full px-3 py-2 outline-none text-sm text-slate-800 dark:text-slate-100"
                />
                <datalist id="dl-edit-section">
                  {uniqueValues('section').map((v) => (
                    <option key={v} value={v} />
                  ))}
                </datalist>
              </div>
            </div>
          </div>

          {/* 3. IDENTITAS & PERSONAL */}
          <div className="hairline-dashed pt-4">
            <p className="form-section-label mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              <i className="fa-solid fa-id-card text-amber-600 dark:text-amber-400"></i>
              <span>Identitas Karyawan &amp; PIC</span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Nama Lengkap Karyawan <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.empName}
                  onChange={(e) => setFormData({ ...formData, empName: e.target.value })}
                  placeholder="Nama Lengkap"
                  className="input-elegant w-full px-3 py-2 outline-none text-sm font-semibold text-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Emp. ID / NIK <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.empId}
                  onChange={(e) => setFormData({ ...formData, empId: e.target.value })}
                  placeholder="AJN-MJK-0101"
                  className="input-elegant w-full px-3 py-2 outline-none text-sm font-mono font-bold text-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Gender (L/P)
                </label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  className="input-elegant w-full px-3 py-2 outline-none text-sm font-semibold cursor-pointer text-slate-800 dark:text-slate-100"
                >
                  <option value="L">Laki-laki (L)</option>
                  <option value="P">Perempuan (P)</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  PIC Evaluator
                </label>
                <input
                  type="text"
                  list="dl-edit-pic"
                  value={formData.pic}
                  onChange={(e) => setFormData({ ...formData, pic: e.target.value })}
                  placeholder="Nama PIC Evaluator"
                  className="input-elegant w-full px-3 py-2 outline-none text-sm text-slate-800 dark:text-slate-100"
                />
                <datalist id="dl-edit-pic">
                  {uniqueValues('pic').map((v) => (
                    <option key={v} value={v} />
                  ))}
                </datalist>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Estimasi Tanggal Pensiun
                </label>
                <input
                  type="text"
                  value={formData.tanggalPensiun}
                  onChange={(e) => setFormData({ ...formData, tanggalPensiun: e.target.value })}
                  placeholder="Contoh: 14 Nov 2038"
                  className="input-elegant w-full px-3 py-2 outline-none text-sm text-slate-800 dark:text-slate-100"
                />
              </div>
            </div>
          </div>

          {/* 4. GRADE & PERIODE */}
          <div className="hairline-dashed pt-4">
            <p className="form-section-label mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              <i className="fa-solid fa-layer-group text-amber-600 dark:text-amber-400"></i>
              <span>Grade &amp; Periode Evaluasi</span>
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Grade
                </label>
                <input
                  type="text"
                  list="dl-edit-grade"
                  value={formData.grade}
                  onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                  placeholder="M4, ST3..."
                  className="input-elegant w-full px-3 py-2 outline-none text-sm font-semibold text-slate-800 dark:text-slate-100"
                />
                <datalist id="dl-edit-grade">
                  {uniqueValues('grade').map((v) => (
                    <option key={v} value={v} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Job Grade
                </label>
                <input
                  type="text"
                  value={formData.jobGrade}
                  onChange={(e) => setFormData({ ...formData, jobGrade: e.target.value })}
                  placeholder="JG-11"
                  className="input-elegant w-full px-3 py-2 outline-none text-sm font-semibold text-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Tahun
                </label>
                <select
                  value={formData.tahun}
                  onChange={(e) => setFormData({ ...formData, tahun: Number(e.target.value) })}
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
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Bulan
                </label>
                <select
                  value={formData.bulan}
                  onChange={(e) => setFormData({ ...formData, bulan: Number(e.target.value) })}
                  className="input-elegant w-full px-3 py-2 outline-none text-sm font-semibold cursor-pointer text-slate-800 dark:text-slate-100"
                >
                  {BULAN_LABELS.map((lbl, idx) => (
                    <option key={idx} value={idx + 1}>
                      {lbl}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="hairline-dashed pt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Batalkan
            </button>

            <motion.button
              type="submit"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              disabled={isSubmitting}
              className="btn-navy px-5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-floppy-disk"></i>
                  <span>Simpan Perubahan Profil</span>
                </>
              )}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
