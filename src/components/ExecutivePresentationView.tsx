import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DashboardStats, Employee, AppFiltersState, UserSession } from '../types';
import { AJINOMOTO_LOGO_URL } from '../utils/storage';
import { BULAN_LABELS } from '../data/initialData';
import { ExportPresentationModal } from './ExportPresentationModal';

interface ExecutivePresentationViewProps {
  stats: DashboardStats;
  filteredEmployees: Employee[];
  allEmployees: Employee[];
  filters: AppFiltersState;
  currentUser: UserSession;
  isDarkMode?: boolean;
  onOpenPdfModal?: () => void;
  onOpenExcelModal?: () => void;
}

export const ExecutivePresentationView: React.FC<ExecutivePresentationViewProps> = ({
  stats,
  filteredEmployees,
  allEmployees,
  filters,
  currentUser,
  isDarkMode = false,
  onOpenPdfModal,
  onOpenExcelModal
}) => {
  const {
    totalManpower,
    totalMS,
    totalUS,
    percentMS,
    byDivisi,
    byDepartment,
    byPosition,
    byGrade,
    lastUpdated
  } = stats;

  const targetData = filteredEmployees.length > 0 ? filteredEmployees : allEmployees;

  // View presentation mode: 'slides' | 'briefing'
  const [presentationMode, setPresentationMode] = useState<'slides' | 'briefing'>('slides');
  const [currentSlide, setCurrentSlide] = useState<number>(1);
  const totalSlides = 5;

  // Fullscreen state
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Auto-play state (for video walls / conference room monitors)
  const [isAutoPlay, setIsAutoPlay] = useState(false);
  const [autoPlayIntervalSeconds, setAutoPlayIntervalSeconds] = useState(12);
  const [autoPlayProgress, setAutoPlayProgress] = useState(0);

  // Copied executive summary alert
  const [copiedSummary, setCopiedSummary] = useState(false);

  // PowerPoint & Image Export Modal state
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Calculated values
  const pctFormatted = (percentMS * 100).toFixed(1) + '%';
  const targetCorporate = 80.0;
  const gapToTarget = (percentMS * 100 - targetCorporate).toFixed(1);
  const isTargetAchieved = percentMS * 100 >= targetCorporate;

  const avgScore = targetData.length > 0
    ? (targetData.reduce((acc, e) => acc + (Number(e.totalScore) || 0), 0) / targetData.length).toFixed(1)
    : '0';

  const thnStr = filters.tahun.join(', ') || '2026';
  const blnStr = filters.bulan.length
    ? filters.bulan.map((b) => BULAN_LABELS[Number(b) - 1] || b).join(', ')
    : 'Juli';
  const divStr = filters.divisi.join(', ') || 'Semua Divisi';
  const deptStr = filters.department.join(', ') || 'Semua Departemen';

  // Division ranking calculation
  const rankedDivisions = useMemo(() => {
    return [...byDivisi]
      .map((d) => {
        const total = d.ms + d.us;
        const pct = total > 0 ? (d.ms / total) * 100 : 0;
        const gap = pct - targetCorporate;
        return {
          ...d,
          total,
          pct,
          gap
        };
      })
      .sort((a, b) => b.pct - a.pct);
  }, [byDivisi, targetCorporate]);

  const topDivision = rankedDivisions.length > 0 ? rankedDivisions[0] : null;
  const bottomDivision = rankedDivisions.length > 1 ? rankedDivisions[rankedDivisions.length - 1] : null;

  // Department categorization into Green, Amber, Red Tiers
  const departmentTiers = useMemo(() => {
    const list = [...byDepartment].map((dept) => {
      const total = dept.ms + dept.us;
      const pct = total > 0 ? (dept.ms / total) * 100 : 0;
      return {
        ...dept,
        total,
        pct
      };
    });

    const green = list.filter((d) => d.pct >= 85).sort((a, b) => b.pct - a.pct);
    const amber = list.filter((d) => d.pct >= 70 && d.pct < 85).sort((a, b) => b.pct - a.pct);
    const red = list.filter((d) => d.pct < 70).sort((a, b) => a.pct - b.pct);

    return { green, amber, red, all: list.sort((a, b) => b.total - a.total) };
  }, [byDepartment]);

  // Under standard employees list
  const underStandardList = useMemo(() => {
    return targetData.filter(
      (e) => e.result === 'US' || (e.standard !== null && e.standard !== undefined && Number(e.totalScore) < Number(e.standard))
    );
  }, [targetData]);

  // Auto-play timer
  useEffect(() => {
    if (!isAutoPlay || presentationMode !== 'slides') {
      setAutoPlayProgress(0);
      return;
    }

    const stepMs = 100;
    const totalSteps = (autoPlayIntervalSeconds * 1000) / stepMs;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      setAutoPlayProgress(Math.min(100, (currentStep / totalSteps) * 100));

      if (currentStep >= totalSteps) {
        currentStep = 0;
        setAutoPlayProgress(0);
        setCurrentSlide((prev) => (prev >= totalSlides ? 1 : prev + 1));
      }
    }, stepMs);

    return () => clearInterval(timer);
  }, [isAutoPlay, autoPlayIntervalSeconds, presentationMode, totalSlides]);

  // Keyboard navigation for presentation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'ArrowRight' || e.key === 'Space') {
        e.preventDefault();
        setCurrentSlide((prev) => Math.min(totalSlides, prev + 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentSlide((prev) => Math.max(1, prev - 1));
      } else if (e.key === 'F11') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, totalSlides]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleCopySummary = async () => {
    const text = `*EXECUTIVE BRIEFING TO TOP MANAGEMENT - AJINOMOTO MOJOKERTO FACTORY*
Periode: ${blnStr} ${thnStr}
Cakupan: ${divStr} | ${deptStr}

*Ringkasan Kinerja Multi-Skill:*
- Total Manpower: ${totalManpower} Karyawan
- Standar Tercapai (MS): ${totalMS} Karyawan (${pctFormatted})
- Belum Standar (US): ${totalUS} Karyawan
- Rata-Rata Skor Pabrik: ${avgScore} / 100
- Target Korporat: 80.0% (${isTargetAchieved ? `Tercapai (+${gapToTarget}%)` : `Defisit (${gapToTarget}%)`})

*Kinerja Divisi:*
- Divisi Tertinggi: ${topDivision ? `${topDivision.label} (${topDivision.pct.toFixed(1)}%)` : '-'}
- Divisi Fokus Pendampingan: ${bottomDivision ? `${bottomDivision.label} (${bottomDivision.pct.toFixed(1)}%)` : '-'}

*Action Plan Top Management:*
1. Program Refreshment Training 30 hari untuk ${totalUS} karyawan US.
2. Benchmarking transfer best practice ke departemen prioritas.
3. Optimalisasi simulator 92 kompetensi teknis pabrik.

Laporan resmi terverifikasi sistem: ${new Date().toLocaleString('id-ID')}`;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 3000);
    } catch {
      // ignore
    }
  };

  const slideTitles = [
    { num: 1, title: 'Scorecard Pabrik & Ringkasan Makro', icon: 'fa-chart-pie' },
    { num: 2, title: 'Benchmark & Leaderboard Divisi', icon: 'fa-trophy' },
    { num: 3, title: 'Analisis Seluruh Departemen & Kesenjangan', icon: 'fa-building' },
    { num: 4, title: 'Matriks Level Jabatan & Threshold', icon: 'fa-user-tie' },
    { num: 5, title: 'Rekomendasi Strategis & Action Plan', icon: 'fa-list-check' }
  ];

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col transition-colors duration-300 w-full space-y-4 sm:space-y-6 ${
        isDarkMode
          ? 'text-slate-100'
          : 'text-slate-900'
      } ${isFullscreen ? 'fixed inset-0 z-50 p-4 sm:p-8 lg:p-10 overflow-y-auto bg-[#081220]' : ''}`}
    >
      {/* TOP EXECUTIVE CARD: BRANDING, STATS & UNIFIED TOOLBAR */}
      <div className="bg-white/95 dark:bg-[#0A192F]/95 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-slate-200/90 dark:border-white/10 shadow-xs space-y-4 shrink-0">
        {/* Tier 1: Corporate Branding, Title & Quick Plant Snapshot */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Left: Logo & Broad Title */}
          <div className="flex items-start sm:items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white p-2 shrink-0 shadow-sm ring-2 ring-amber-400/40 flex items-center justify-center border border-slate-100">
              <img
                src={AJINOMOTO_LOGO_URL}
                alt="Logo Ajinomoto"
                className="max-h-full max-w-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase bg-[#0E2340] text-amber-300 border border-amber-400/40 shadow-2xs">
                  Executive Boardroom Briefing
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Live Real-Time Data
                </span>
              </div>
              <h1 className="text-lg sm:text-xl lg:text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-snug">
                Laporan Eksekutif Multi-Skill to Top Management
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                PT Ajinomoto Indonesia &bull; Mojokerto Factory &bull; Periode: <strong className="text-amber-600 dark:text-amber-400 font-bold">{blnStr} {thnStr}</strong> &bull; Cakupan: <strong className="text-slate-800 dark:text-slate-200">{divStr}</strong>
              </p>
            </div>
          </div>

          {/* Right: Quick Executive Scorecard Capsule */}
          <div className="flex items-center gap-3 self-start lg:self-center shrink-0">
            <div className="flex items-center gap-3 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#071324] border border-slate-200/80 dark:border-white/10 text-xs">
              <div className="text-center pr-3 border-r border-slate-200 dark:border-white/10">
                <p className="text-[10px] font-bold uppercase text-slate-400">Total Karyawan</p>
                <p className="text-sm font-black text-slate-800 dark:text-white">{totalManpower} <span className="text-[10px] font-normal text-slate-400">org</span></p>
              </div>
              <div className="text-center pr-3 border-r border-slate-200 dark:border-white/10">
                <p className="text-[10px] font-bold uppercase text-slate-400">Ketercapaian MS</p>
                <p className="text-sm font-black text-amber-600 dark:text-amber-400">{pctFormatted}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-bold uppercase text-slate-400">Status Target</p>
                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-black ${
                  isTargetAchieved
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300'
                }`}>
                  {isTargetAchieved ? `Tercapai (+${gapToTarget}%)` : `Defisit (${gapToTarget}%)`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tier 2: Dedicated Action Controls Toolbar */}
        <div className="bg-slate-50/90 dark:bg-[#071324]/90 border border-slate-200/80 dark:border-white/10 p-2 sm:p-2.5 rounded-xl flex flex-wrap items-center justify-between gap-2.5">
          {/* Left Group: Display Mode & Presentation Controls */}
          <div className="flex items-center flex-wrap gap-2">
            {/* View Mode Toggle: Slides vs Briefing */}
            <div className="flex bg-slate-200/80 dark:bg-slate-800 p-0.5 rounded-xl shadow-inner">
              <button
                type="button"
                onClick={() => setPresentationMode('slides')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  presentationMode === 'slides'
                    ? 'bg-white dark:bg-[#0E2340] text-[#0E2340] dark:text-amber-300 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Tampilkan dalam format slide presentasi rapat direksi"
              >
                <i className="fa-solid fa-chalkboard text-xs"></i>
                <span>Slide Deck</span>
              </button>
              <button
                type="button"
                onClick={() => setPresentationMode('briefing')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  presentationMode === 'briefing'
                    ? 'bg-white dark:bg-[#0E2340] text-[#0E2340] dark:text-amber-300 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Tampilkan seluruh laporan dalam satu lembar eksekutif mengalir"
              >
                <i className="fa-solid fa-file-lines text-xs"></i>
                <span>Full Briefing</span>
              </button>
            </div>

            {/* Auto-Play Toggle (For Slides Mode) */}
            {presentationMode === 'slides' && (
              <button
                type="button"
                onClick={() => setIsAutoPlay(!isAutoPlay)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border cursor-pointer ${
                  isAutoPlay
                    ? 'bg-amber-500 text-white border-amber-600 shadow-2xs animate-pulse'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
                title="Otomatis putar slide (ideal untuk video wall / layar rapat)"
              >
                <i className={`fa-solid ${isAutoPlay ? 'fa-pause' : 'fa-play'} text-xs`}></i>
                <span>{isAutoPlay ? 'Jeda Kios' : 'Auto-Play'}</span>
              </button>
            )}

            {/* Fullscreen Button */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
              title="Buka tampilan layar penuh untuk proyektor / TV rapat (F11)"
            >
              <i className={`fa-solid ${isFullscreen ? 'fa-compress' : 'fa-expand'} text-xs`}></i>
              <span>{isFullscreen ? 'Keluar Fullscreen' : 'Fullscreen'}</span>
            </button>
          </div>

          {/* Right Group: Executive Export & Communication Actions */}
          <div className="flex items-center flex-wrap gap-2">
            {/* Copy Briefing to Clipboard */}
            <button
              type="button"
              onClick={handleCopySummary}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
              title="Salin ringkasan eksekutif untuk WhatsApp / Email Direksi"
            >
              <i className={`fa-solid ${copiedSummary ? 'fa-check' : 'fa-copy'} text-xs`}></i>
              <span>{copiedSummary ? 'Tersalin!' : 'Salin Draf'}</span>
            </button>

            {/* Unduh Slide PowerPoint & Gambar HD Modal */}
            <button
              type="button"
              onClick={() => setIsExportModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500 via-amber-600 to-[#0E2340] hover:from-amber-600 hover:to-slate-900 text-white shadow-2xs transition flex items-center gap-1.5 cursor-pointer border border-amber-400/40"
              title="Unduh Rangkuman Presentasi Direksi sebagai Slide PowerPoint (PDF 16:9) atau Gambar HD"
            >
              <i className="fa-solid fa-file-powerpoint text-amber-200 text-xs"></i>
              <span>Unduh Slide PPT / Gambar</span>
            </button>

            {/* Official PDF Report Export */}
            {onOpenPdfModal && (
              <button
                type="button"
                onClick={onOpenPdfModal}
                className="px-3.5 py-1.5 rounded-xl text-xs font-extrabold bg-[#E10600] hover:bg-red-700 text-white shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                title="Buka Dokumen PDF Resmi Lengkap untuk Dicetak"
              >
                <i className="fa-solid fa-file-pdf text-xs"></i>
                <span>Cetak PDF</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* SLIDE NAVIGATION BAR (When in Slides Mode) */}
      {presentationMode === 'slides' && (
        <div className="space-y-2.5 my-1.5 sm:my-2">
          <div className="flex items-center justify-between flex-wrap gap-3 bg-white/80 dark:bg-[#0A192F]/80 backdrop-blur-md px-3 py-2 sm:px-4 sm:py-2.5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-xs">
            {/* Slide tabs with smooth horizontal scroll */}
            <div className="flex items-center gap-2 overflow-x-auto py-1 pr-3 max-w-full scrollbar-none flex-1 min-w-0">
              {slideTitles.map((slide) => {
                const isActive = currentSlide === slide.num;
                return (
                  <button
                    key={slide.num}
                    type="button"
                    onClick={() => {
                      setCurrentSlide(slide.num);
                      setAutoPlayProgress(0);
                    }}
                    className={`px-3 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer border shadow-2xs ${
                      isActive
                        ? 'bg-[#0E2340] text-amber-300 border-amber-400/50 shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <span className={`w-4 h-4 sm:w-5 sm:h-5 rounded-md flex items-center justify-center text-[10px] font-mono font-black ${
                      isActive ? 'bg-amber-400 text-slate-950' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}>
                      {slide.num}
                    </span>
                    <i className={`fa-solid ${slide.icon} text-[11px] ${isActive ? 'text-amber-400' : 'text-slate-400'}`}></i>
                    <span className="hidden sm:inline text-xs">{slide.title}</span>
                  </button>
                );
              })}
            </div>

            {/* Slide Arrows & Progress Counter */}
            <div className="flex items-center gap-2.5 shrink-0 pl-3.5 sm:pl-4 ml-1 border-l border-slate-200/90 dark:border-white/15">
              <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                <strong>{currentSlide}</strong> / {totalSlides}
              </span>
              <button
                type="button"
                disabled={currentSlide === 1}
                onClick={() => {
                  setCurrentSlide((prev) => Math.max(1, prev - 1));
                  setAutoPlayProgress(0);
                }}
                className="w-8 h-8 rounded-lg flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition shadow-2xs"
                title="Slide Sebelumnya (Panah Kiri)"
              >
                <i className="fa-solid fa-chevron-left text-xs"></i>
              </button>
              <button
                type="button"
                disabled={currentSlide === totalSlides}
                onClick={() => {
                  setCurrentSlide((prev) => Math.min(totalSlides, prev + 1));
                  setAutoPlayProgress(0);
                }}
                className="w-8 h-8 rounded-lg flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition shadow-2xs"
                title="Slide Selanjutnya (Panah Kanan / Spasi)"
              >
                <i className="fa-solid fa-chevron-right text-xs"></i>
              </button>
            </div>
          </div>

          {/* Auto-Play Progress Bar */}
          {isAutoPlay && (
            <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-amber-400 via-emerald-400 to-[#0E2340] h-full transition-all duration-100"
                style={{ width: `${autoPlayProgress}%` }}
              ></div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          SLIDE CONTENT CONTAINER (Animated transitions in Slide Mode, or Stacked in Briefing Mode)
         ========================================================================= */}
      <div id="executive-presentation-slide-container" className="flex-1 flex flex-col space-y-8 pt-1 sm:pt-2">
        {/* SLIDE 1: FACTORY SCORECARD & MACRO SUMMARY */}
        {(presentationMode === 'briefing' || currentSlide === 1) && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="rounded-3xl p-6 sm:p-8 bg-white dark:bg-[#0A192F] border border-slate-200/90 dark:border-white/10 shadow-lg relative overflow-hidden space-y-6"
          >
            {/* Ambient Brand Accent Stripe */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#E10600] via-[#B8874B] to-[#0FA968]"></div>

            {/* Slide Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#B8874B]">
                  SLIDE 01 &bull; EXECUTIVE FACTORY SCORECARD
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                  Kesiapan Multi-Skill Pabrik Mojokerto &amp; Pencapaian Korporat
                </h2>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setIsExportModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-bold transition cursor-pointer"
                  title="Unduh rangkuman ini sebagai PowerPoint (PDF 16:9) atau Gambar HD"
                >
                  <i className="fa-solid fa-file-powerpoint text-xs"></i>
                  <span>Unduh Rangkuman Eksekutif</span>
                </button>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <i className="fa-solid fa-bullseye text-[#B8874B]"></i>
                  <span>Target Korporat: <strong>{targetCorporate.toFixed(1)}% MS</strong></span>
                </div>
              </div>
            </div>

            {/* Primary Factory Scorecard Banner */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center p-6 rounded-3xl bg-gradient-to-br from-[#0E2340] via-[#0A192F] to-[#081220] text-white shadow-xl relative overflow-hidden">
              {/* Subtle background glow */}
              <div className="absolute -right-16 -top-16 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

              {/* Left Gauge / Giant Rate (4 Cols) */}
              <div className="lg:col-span-4 text-center sm:text-left flex flex-col items-center sm:items-start justify-center space-y-2 border-b lg:border-b-0 lg:border-r border-white/15 pb-6 lg:pb-0 lg:pr-6">
                <span className="text-xs font-extrabold tracking-widest text-amber-300 uppercase">
                  Tingkat Kesiapan Multi-Skill Pabrik
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl sm:text-6xl font-black text-white tracking-tight">
                    {pctFormatted}
                  </span>
                  <span className={`text-xs sm:text-sm font-extrabold px-2.5 py-1 rounded-full ${
                    isTargetAchieved
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                  }`}>
                    {isTargetAchieved ? `+${gapToTarget}% vs Target` : `${gapToTarget}% vs Target`}
                  </span>
                </div>

                {/* Status Callout */}
                <div className="pt-2 w-full">
                  <div className={`p-3 rounded-2xl border text-xs font-bold flex items-center gap-2.5 ${
                    isTargetAchieved
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                      : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                  }`}>
                    <i className={`fa-solid ${isTargetAchieved ? 'fa-circle-check text-emerald-400' : 'fa-triangle-exclamation text-rose-400'} text-base`}></i>
                    <div>
                      <p className="font-extrabold uppercase leading-tight">
                        {isTargetAchieved ? 'MEMENUHI STANDAR KORPORAT' : 'PERHATIAN DEFISIT KOMPETENSI'}
                      </p>
                      <p className="text-[11px] opacity-85 font-normal leading-tight mt-0.5">
                        {isTargetAchieved
                          ? 'Operasional pabrik memiliki fleksibilitas tinggi dan resiliensi pergantian shift.'
                          : `Terdapat ${totalUS} personil yang memerlukan tindak lanjut program peningkatan skill.`}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right 4 Metric Tiles (8 Cols) */}
              <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
                  <p className="text-[11px] font-bold text-slate-400 uppercase">Total Headcount</p>
                  <p className="text-2xl sm:text-3xl font-black text-white mt-1">{totalManpower}</p>
                  <span className="text-[10px] text-slate-400 mt-1 block">Karyawan Terdaftar</span>
                </div>

                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
                  <p className="text-[11px] font-bold text-emerald-400 uppercase">Standar (MS)</p>
                  <p className="text-2xl sm:text-3xl font-black text-emerald-400 mt-1">{totalMS}</p>
                  <span className="text-[10px] text-slate-400 mt-1 block">Kompeten Mandiri</span>
                </div>

                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
                  <p className="text-[11px] font-bold text-rose-400 uppercase">Belum Standar</p>
                  <p className="text-2xl sm:text-3xl font-black text-rose-400 mt-1">{totalUS}</p>
                  <span className="text-[10px] text-slate-400 mt-1 block">Butuh Pembinaan</span>
                </div>

                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
                  <p className="text-[11px] font-bold text-amber-300 uppercase">Rata-Rata Skor</p>
                  <p className="text-2xl sm:text-3xl font-black text-amber-300 mt-1">{avgScore}</p>
                  <span className="text-[10px] text-slate-400 mt-1 block">Skala Maksimum 100</span>
                </div>
              </div>
            </div>

            {/* 3 Executive Strategic Assessment Pillars */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-1.5">
                <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
                  <span className="w-7 h-7 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs">
                    <i className="fa-solid fa-arrows-split-up-and-left"></i>
                  </span>
                  <span>Fleksibilitas Lini Pabrik</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Tingkat multi-skill saat ini menjamin ketersediaan operator pengganti pada stasiun kerja krusial dengan kapasitas cadangan <strong>{pctFormatted}</strong>.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-1.5">
                <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
                  <span className="w-7 h-7 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs">
                    <i className="fa-solid fa-shield-halved"></i>
                  </span>
                  <span>Mitigasi Risiko Mutu &amp; K3</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Standar evaluasi 92 kompetensi teknis mencakup pematuhan SOP Higienis, GMP, Halal, serta zero-accident protocols di setiap lini mesin.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-1.5">
                <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
                  <span className="w-7 h-7 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xs">
                    <i className="fa-solid fa-graduation-cap"></i>
                  </span>
                  <span>Fokus Pembinaan Q+1</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Diperlukan alokasi mentoring teknis untuk <strong>{totalUS} personil US</strong> agar seluruh departemen mencapai standar korporat 80.0%.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* SLIDE 2: DIVISIONAL BENCHMARK & FACTORY LEADERBOARD */}
        {(presentationMode === 'briefing' || currentSlide === 2) && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="rounded-3xl p-6 sm:p-8 bg-white dark:bg-[#0A192F] border border-slate-200/90 dark:border-white/10 shadow-lg relative overflow-hidden space-y-6"
          >
            {/* Ambient Brand Stripe */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-[#0E2340] to-emerald-500"></div>

            {/* Slide Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#B8874B]">
                  SLIDE 02 &bull; DIVISIONAL BENCHMARK
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                  Leaderboard &amp; Perbandingan Kinerja Seluruh Divisi Pabrik
                </h2>
              </div>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Total Divisi: <strong>{rankedDivisions.length} Divisi</strong>
              </span>
            </div>

            {/* Spotlight Cards: Best Performer vs Priority Focus */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {topDivision && (
                <div className="p-5 rounded-3xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-2xl shadow-md shrink-0">
                    <i className="fa-solid fa-trophy"></i>
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-extrabold tracking-wider uppercase text-emerald-800 dark:text-emerald-300">
                      DIVISI TERBAIK (RANK 1)
                    </span>
                    <h3 className="text-base font-black text-slate-900 dark:text-white truncate">
                      {topDivision.label}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                      Pencapaian: <strong className="text-emerald-700 dark:text-emerald-400">{topDivision.pct.toFixed(1)}% MS</strong> ({topDivision.ms} dari {topDivision.total} personil)
                    </p>
                  </div>
                </div>
              )}

              {bottomDivision && (
                <div className="p-5 rounded-3xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-amber-600 text-white flex items-center justify-center text-2xl shadow-md shrink-0">
                    <i className="fa-solid fa-hand-holding-hand"></i>
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-extrabold tracking-wider uppercase text-amber-800 dark:text-amber-300">
                      DIVISI FOKUS PENDAMPINGAN HR
                    </span>
                    <h3 className="text-base font-black text-slate-900 dark:text-white truncate">
                      {bottomDivision.label}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                      Pencapaian: <strong className="text-amber-700 dark:text-amber-400">{bottomDivision.pct.toFixed(1)}% MS</strong> ({bottomDivision.us} personil butuh upskilling)
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Comprehensive Divisional Leaderboard Table */}
            <div className="border border-slate-200 dark:border-slate-700/80 rounded-2xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0E2340] text-white">
                  <tr>
                    <th className="p-3 font-extrabold text-center w-16">Peringkat</th>
                    <th className="p-3 font-extrabold">Nama Divisi</th>
                    <th className="p-3 font-extrabold text-center">Headcount</th>
                    <th className="p-3 font-extrabold text-center">Standar (MS)</th>
                    <th className="p-3 font-extrabold text-center">Belum (US)</th>
                    <th className="p-3 font-extrabold text-center">% Pencapaian</th>
                    <th className="p-3 font-extrabold text-right">Status Korporat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {rankedDivisions.map((div, index) => {
                    const isPassed = div.pct >= targetCorporate;
                    return (
                      <tr
                        key={index}
                        className={`transition-colors ${
                          index % 2 === 0 ? 'bg-white dark:bg-slate-900/50' : 'bg-slate-50/50 dark:bg-slate-800/30'
                        } hover:bg-amber-50/40 dark:hover:bg-slate-800`}
                      >
                        <td className="p-3 text-center">
                          {index === 0 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-amber-400 text-slate-950 font-black text-xs shadow-xs">
                              🥇 1
                            </span>
                          ) : index === 1 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-slate-300 text-slate-900 font-black text-xs shadow-xs">
                              🥈 2
                            </span>
                          ) : index === 2 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-amber-700 text-white font-black text-xs shadow-xs">
                              🥉 3
                            </span>
                          ) : (
                            <span className="font-mono font-bold text-slate-500">#{index + 1}</span>
                          )}
                        </td>
                        <td className="p-3 font-extrabold text-slate-900 dark:text-white">
                          {div.label}
                        </td>
                        <td className="p-3 text-center font-bold text-slate-800 dark:text-slate-200">
                          {div.total}
                        </td>
                        <td className="p-3 text-center font-black text-emerald-600 dark:text-emerald-400">
                          {div.ms}
                        </td>
                        <td className="p-3 text-center font-black text-rose-600 dark:text-rose-400">
                          {div.us}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span className="font-black text-sm text-slate-900 dark:text-white">
                              {div.pct.toFixed(1)}%
                            </span>
                            <div className="w-16 bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden hidden sm:block">
                              <div
                                className={`h-full rounded-full ${
                                  isPassed ? 'bg-emerald-500' : 'bg-rose-500'
                                }`}
                                style={{ width: `${Math.min(100, div.pct)}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-right">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10.5px] font-extrabold ${
                              isPassed
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            }`}
                          >
                            {isPassed ? 'Achieved' : 'Needs Support'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* SLIDE 3: DEPARTMENT DEEP DIVE & CRITICAL GAPS */}
        {(presentationMode === 'briefing' || currentSlide === 3) && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="rounded-3xl p-6 sm:p-8 bg-white dark:bg-[#0A192F] border border-slate-200/90 dark:border-white/10 shadow-lg relative overflow-hidden space-y-6"
          >
            {/* Ambient Brand Stripe */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500"></div>

            {/* Slide Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#B8874B]">
                  SLIDE 03 &bull; DEPARTMENT DEEP DIVE
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                  Analisis Kepatuhan Standar Seluruh Departemen Pabrik
                </h2>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold">
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  Green &ge; 85%
                </span>
                <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  Amber 70-84%
                </span>
                <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                  Red &lt; 70%
                </span>
              </div>
            </div>

            {/* 3 Department Tier Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Green Zone */}
              <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-emerald-800 dark:text-emerald-300 uppercase flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    GREEN ZONE ({departmentTiers.green.length} Dept)
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">High Compliance</span>
                </div>
                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                  {departmentTiers.green.map((dept, i) => (
                    <div key={i} className="flex justify-between items-center text-xs p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                      <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[140px]">{dept.label}</span>
                      <span className="font-black text-emerald-600 dark:text-emerald-400">{dept.pct.toFixed(1)}%</span>
                    </div>
                  ))}
                  {departmentTiers.green.length === 0 && (
                    <p className="text-xs text-slate-400 italic">Belum ada departemen di zona ini</p>
                  )}
                </div>
              </div>

              {/* Amber Zone */}
              <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-amber-800 dark:text-amber-300 uppercase flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                    AMBER ZONE ({departmentTiers.amber.length} Dept)
                  </span>
                  <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400">Stable Standard</span>
                </div>
                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                  {departmentTiers.amber.map((dept, i) => (
                    <div key={i} className="flex justify-between items-center text-xs p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                      <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[140px]">{dept.label}</span>
                      <span className="font-black text-amber-600 dark:text-amber-400">{dept.pct.toFixed(1)}%</span>
                    </div>
                  ))}
                  {departmentTiers.amber.length === 0 && (
                    <p className="text-xs text-slate-400 italic">Belum ada departemen di zona ini</p>
                  )}
                </div>
              </div>

              {/* Red Zone */}
              <div className="p-4 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-rose-800 dark:text-rose-300 uppercase flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                    RED ZONE ({departmentTiers.red.length} Dept)
                  </span>
                  <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400">Action Required</span>
                </div>
                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                  {departmentTiers.red.map((dept, i) => (
                    <div key={i} className="flex justify-between items-center text-xs p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                      <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[140px]">{dept.label}</span>
                      <span className="font-black text-rose-600 dark:text-rose-400">{dept.pct.toFixed(1)}% ({dept.us} US)</span>
                    </div>
                  ))}
                  {departmentTiers.red.length === 0 && (
                    <p className="text-xs text-emerald-600 italic">Luar biasa, 0 departemen di red zone!</p>
                  )}
                </div>
              </div>
            </div>

            {/* Department Full Matrix Overview */}
            <div className="border border-slate-200 dark:border-slate-700/80 rounded-2xl overflow-hidden">
              <div className="p-3 bg-slate-100 dark:bg-slate-800/80 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide">
                  Matriks Lengkap Seluruh Departemen ({departmentTiers.all.length} Total Departemen)
                </span>
                <span className="text-[11px] text-slate-500">Diurutkan berdasarkan headcount</span>
              </div>
              <div className="max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0E2340] text-white sticky top-0">
                    <tr>
                      <th className="p-2.5 font-bold">No</th>
                      <th className="p-2.5 font-bold">Departemen</th>
                      <th className="p-2.5 font-bold text-center">Headcount</th>
                      <th className="p-2.5 font-bold text-center">MS</th>
                      <th className="p-2.5 font-bold text-center">US</th>
                      <th className="p-2.5 font-bold text-right">% Pencapaian</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {departmentTiers.all.map((dp, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white dark:bg-slate-900/40' : 'bg-slate-50/40 dark:bg-slate-800/20'}>
                        <td className="p-2.5 text-slate-400">{i + 1}</td>
                        <td className="p-2.5 font-bold text-slate-900 dark:text-white">{dp.label}</td>
                        <td className="p-2.5 text-center font-semibold text-slate-800 dark:text-slate-200">{dp.total}</td>
                        <td className="p-2.5 text-center font-bold text-emerald-600 dark:text-emerald-400">{dp.ms}</td>
                        <td className="p-2.5 text-center font-bold text-rose-600 dark:text-rose-400">{dp.us}</td>
                        <td className="p-2.5 text-right font-black text-slate-900 dark:text-white">{dp.pct.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* SLIDE 4: LEADERSHIP LEVEL & JOB POSITION MATRIX */}
        {(presentationMode === 'briefing' || currentSlide === 4) && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="rounded-3xl p-6 sm:p-8 bg-white dark:bg-[#0A192F] border border-slate-200/90 dark:border-white/10 shadow-lg relative overflow-hidden space-y-6"
          >
            {/* Ambient Brand Stripe */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-[#B8874B] to-emerald-500"></div>

            {/* Slide Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#B8874B]">
                  SLIDE 04 &bull; LEADERSHIP &amp; POSITION COMPETENCY
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                  Kesiapan Multi-Skill Berdasarkan Jenjang Jabatan &amp; Threshold
                </h2>
              </div>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Pilar Kepemimpinan &amp; Pengawasan Operasional
              </span>
            </div>

            {/* Position Threshold Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {byPosition.map((pos, idx) => {
                const total = pos.manpower;
                const pct = (pos.resultPercent || 0) * 100;
                const isPassed = pct >= (pos.threshold || 70);
                return (
                  <div
                    key={idx}
                    className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/90 dark:border-slate-700/90 space-y-3 relative overflow-hidden"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-[#0E2340] dark:text-amber-300 uppercase truncate max-w-[160px]">
                        {pos.label}
                      </span>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        Std: {pos.threshold}%
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between">
                      <span className="text-3xl font-black text-slate-900 dark:text-white">
                        {pct.toFixed(1)}%
                      </span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        isPassed
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                      }`}>
                        {isPassed ? 'Memenuhi' : 'Defisit'}
                      </span>
                    </div>

                    {/* Progress Bar with Threshold Marker */}
                    <div className="relative w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isPassed ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      ></div>
                    </div>

                    <div className="flex justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                      <span>Total: <strong>{total} org</strong></span>
                      <span>Lulus: <strong className="text-emerald-600">{pos.ok}</strong></span>
                      <span>Belum: <strong className="text-rose-600">{pos.notOk}</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Supervisory Readiness Analysis */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-[#0E2340] to-[#0A192F] text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md">
              <div className="space-y-1 text-center sm:text-left">
                <p className="text-xs font-extrabold uppercase text-amber-400">
                  Evaluasi Kesiapan Pengawas (Foremen &amp; Section Managers)
                </p>
                <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                  Para supervisor dan foreman memiliki peran kunci sebagai mentor operasional di lantai pabrik. Pencapaian kompetensi manajerial memastikan transfer skill ke operator berjalan berkelanjutan.
                </p>
              </div>
              <div className="shrink-0">
                <span className="px-4 py-2 rounded-xl bg-amber-400 text-slate-950 font-black text-xs uppercase shadow-sm">
                  Supervisory Ready
                </span>
              </div>
            </div>
          </motion.div>
        )}

        {/* SLIDE 5: STRATEGIC RECOMMENDATIONS & ACTION PLAN */}
        {(presentationMode === 'briefing' || currentSlide === 5) && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="rounded-3xl p-6 sm:p-8 bg-white dark:bg-[#0A192F] border border-slate-200/90 dark:border-white/10 shadow-lg relative overflow-hidden space-y-6"
          >
            {/* Ambient Brand Stripe */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#B8874B] via-[#0E2340] to-emerald-500"></div>

            {/* Slide Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#B8874B]">
                  SLIDE 05 &bull; STRATEGIC ACTION PLAN FOR TOP MANAGEMENT
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                  Rencana Tindak Lanjut &amp; Rekomendasi Keputusan Direksi
                </h2>
              </div>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Resolusi Kesenjangan &bull; Q+1 Target
              </span>
            </div>

            {/* 4 Pillars of Strategic Action Plan */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Pillar 1 */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 font-black text-sm flex items-center justify-center">
                    1
                  </span>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">
                    Program Akselerasi Karyawan US ({totalUS} Personil)
                  </h4>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pl-11">
                  Melaksanakan refreshment training terfokus selama 30 hari ke depan dengan pendampingan langsung oleh Senior Foreman / Section Head untuk setiap skill yang belum tercentang.
                </p>
              </div>

              {/* Pillar 2 */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-black text-sm flex items-center justify-center">
                    2
                  </span>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">
                    Benchmarking &amp; Transfer Best Practice Antar-Lini
                  </h4>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pl-11">
                  Mengorganisir program pertukaran metode kerja dari departemen Green Zone ({departmentTiers.green[0]?.label || 'Produksi'}) ke departemen dengan gap tertinggi untuk standardisasi efisiensi.
                </p>
              </div>

              {/* Pillar 3 */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 font-black text-sm flex items-center justify-center">
                    3
                  </span>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">
                    Optimalisasi Jadwal Simulator &amp; Matriks 92 Skill
                  </h4>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pl-11">
                  Memanfaatkan waktu pergantian batch produksi untuk simulasi multi-machine running tanpa mengganggu target output OEE pabrik harian.
                </p>
              </div>

              {/* Pillar 4 */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 font-black text-sm flex items-center justify-center">
                    4
                  </span>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">
                    Re-Audit &amp; Verifikasi Periodik Q+1
                  </h4>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pl-11">
                  Jadwal verifikasi ulang hasil evaluasi multi-skill pada akhir kuartal berikutnya dengan target pencapaian minimal <strong>85.0% MS</strong> di seluruh departemen pabrik.
                </p>
              </div>
            </div>

            {/* Formal Executive Endorsement & Signatures Block */}
            <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
                <span className="text-xs font-black uppercase text-[#0E2340] dark:text-amber-300 flex items-center gap-2">
                  <i className="fa-solid fa-file-signature text-amber-500"></i>
                  LEMBAR PENGESAHAN &amp; VERIFIKASI TOP MANAGEMENT
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  Mojokerto Factory &bull; {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center pt-2">
                {/* Signer 1: Prepared By */}
                <div className="space-y-1.5 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Disusun Oleh:</span>
                  <div className="w-20 h-12 mx-auto rounded border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-400 text-[10px]">
                    [E-Sign HR]
                  </div>
                  <p className="text-xs font-extrabold text-slate-900 dark:text-white">{currentUser.name || 'Mahmud Nurdiansyah'}</p>
                  <p className="text-[10px] text-slate-500">{currentUser.role || 'HR Development Specialist'}</p>
                </div>

                {/* Signer 2: Checked By */}
                <div className="space-y-1.5 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Ditinjau Oleh:</span>
                  <div className="w-20 h-12 mx-auto rounded border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-400 text-[10px]">
                    [E-Sign Dept Head]
                  </div>
                  <p className="text-xs font-extrabold text-slate-900 dark:text-white">Department Head</p>
                  <p className="text-[10px] text-slate-500">HR &amp; General Affairs</p>
                </div>

                {/* Signer 3: Approved By */}
                <div className="space-y-1.5 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Disetujui Oleh:</span>
                  <div className="w-20 h-12 mx-auto rounded border border-dashed border-amber-400/60 bg-amber-50/50 dark:bg-amber-950/20 flex items-center justify-center text-amber-700 dark:text-amber-400 text-[10px] font-bold">
                    [E-Sign GM]
                  </div>
                  <p className="text-xs font-extrabold text-slate-900 dark:text-white">Factory General Manager</p>
                  <p className="text-[10px] text-[#B8874B] font-bold">PT Ajinomoto Indonesia - Mojokerto</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* MODAL UNDUH PRESENTASI POWERPOINT & GAMBAR HD */}
      <ExportPresentationModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        filteredEmployees={filteredEmployees}
        allEmployees={allEmployees}
        filters={filters}
        currentUser={currentUser}
        currentSlideNum={currentSlide}
        activeSlideElementId="executive-presentation-slide-container"
      />
    </div>
  );
};
