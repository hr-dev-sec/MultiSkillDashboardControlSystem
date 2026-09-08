import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { Employee, AppFiltersState, UserSession, DashboardStats } from '../types';
import { AJINOMOTO_LOGO_URL, computeDashboardStats } from '../utils/storage';
import { BULAN_LABELS } from '../data/initialData';
import {
  generatePowerPointPdfDeck,
  exportSlideElementAsImage,
  copySlideElementToClipboard
} from '../utils/presentationExport';

interface ExportPresentationModalProps {
  isOpen: boolean;
  onClose: () => void;
  filteredEmployees: Employee[];
  allEmployees: Employee[];
  filters: AppFiltersState;
  currentUser: UserSession;
  currentSlideNum?: number;
  activeSlideElementId?: string;
}

export type ExportFormatType =
  | 'pdf_deck'         // Full 6-Slide PowerPoint PDF (16:9)
  | 'pdf_summary_1p'   // Single-Slide Executive Summary PDF (16:9)
  | 'image_summary_16_9' // High-DPI PNG Image of Executive Summary (16:9)
  | 'image_active_slide'; // High-DPI PNG of currently active slide

export const ExportPresentationModal: React.FC<ExportPresentationModalProps> = ({
  isOpen,
  onClose,
  filteredEmployees,
  allEmployees,
  filters,
  currentUser,
  currentSlideNum = 1,
  activeSlideElementId = 'executive-presentation-slide-container'
}) => {
  const [exportScope, setExportScope] = useState<'filtered' | 'all'>('filtered');
  const [selectedFormat, setSelectedFormat] = useState<ExportFormatType>('pdf_deck');

  // Approver Signatures
  const [signerName, setSignerName] = useState(currentUser.name || 'Mahmud Nurdiansyah');
  const [signerRole, setSignerRole] = useState(currentUser.role || 'HR Development Specialist');
  const [reviewedByName, setReviewedByName] = useState('Agus Sudarsono, S.T.');
  const [approvedByName, setApprovedByName] = useState('Ir. Bambang Wijanarko, M.T.');

  // Preview Slide Selection
  const [previewSlideIdx, setPreviewSlideIdx] = useState<number>(1);

  // Status & Progress
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState<string>('');
  const [copiedImageSuccess, setCopiedImageSuccess] = useState(false);
  const [downloadSuccessToast, setDownloadSuccessToast] = useState<string | null>(null);

  // Ref to the rendered 16:9 preview canvas
  const previewRef = useRef<HTMLDivElement>(null);

  // Target Data & Stats
  const targetData = exportScope === 'filtered' ? filteredEmployees : allEmployees;
  const stats: DashboardStats = computeDashboardStats(targetData);
  const { totalManpower, totalMS, totalUS, percentMS, byDivisi, byDepartment } = stats;

  const pctFormatted = (percentMS * 100).toFixed(1) + '%';
  const targetCorporate = 80.0;
  const isTargetAchieved = percentMS * 100 >= targetCorporate;
  const gapToTarget = (percentMS * 100 - targetCorporate).toFixed(1);

  const avgScore = targetData.length > 0
    ? (targetData.reduce((acc, e) => acc + (Number(e.totalScore) || 0), 0) / targetData.length).toFixed(1)
    : '0';

  const thnStr = filters.tahun.join(', ') || '2026';
  const blnStr = filters.bulan.length
    ? filters.bulan.map((b) => BULAN_LABELS[Number(b) - 1] || b).join(', ')
    : 'Juli';
  const periodeStr = `${blnStr} ${thnStr}`;
  const divStr = filters.divisi.join(', ') || 'Semua Divisi';

  // Division ranking
  const rankedDivisions = [...byDivisi]
    .map((d) => {
      const total = d.ms + d.us;
      const pct = total > 0 ? (d.ms / total) * 100 : 0;
      return { ...d, total, pct };
    })
    .sort((a, b) => b.pct - a.pct);

  const topDivision = rankedDivisions.length > 0 ? rankedDivisions[0] : null;

  // Department green/amber/red tiers
  const deptList = [...byDepartment].map((d) => {
    const total = d.ms + d.us;
    const pct = total > 0 ? (d.ms / total) * 100 : 0;
    return { ...d, total, pct };
  });
  const greenDepts = deptList.filter((d) => d.pct >= 85);
  const amberDepts = deptList.filter((d) => d.pct >= 70 && d.pct < 85);
  const redDepts = deptList.filter((d) => d.pct < 70);

  // Trigger Export
  const handleExecuteExport = async () => {
    setIsProcessing(true);
    setProcessStatus('Menyiapkan visualisasi data presentasi 16:9...');

    try {
      if (selectedFormat === 'pdf_deck' || selectedFormat === 'pdf_summary_1p') {
        setProcessStatus('Merender slide PowerPoint berkualitas tinggi...');
        await new Promise((r) => setTimeout(r, 400));

        const result = generatePowerPointPdfDeck({
          scope: exportScope,
          filteredEmployees,
          allEmployees,
          filters,
          currentUser,
          approvers: {
            preparedBy: { name: signerName, title: signerRole },
            reviewedBy: { name: reviewedByName, title: 'Department Head HR & GA' },
            approvedBy: { name: approvedByName, title: 'Factory General Manager' }
          },
          singlePageSummaryOnly: selectedFormat === 'pdf_summary_1p'
        });

        setProcessStatus('Menyimpan dokumen presentasi...');
        result.doc.save(result.filename);

        setDownloadSuccessToast(`Berhasil mengunduh ${result.filename}!`);
        confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
      } else if (selectedFormat === 'image_summary_16_9') {
        setProcessStatus('Mengonversi rangkuman 16:9 menjadi file gambar PNG HD...');
        await new Promise((r) => setTimeout(r, 300));

        // Use previewRef or activeSlideElementId
        const el = previewRef.current;
        if (!el) throw new Error('Elemen pratinjau slide tidak ditemukan');

        const filename = `Rangkuman_Eksekutif_Direksi_16x9_${periodeStr.replace(/\s+/g, '_')}.png`;
        await exportSlideElementAsImage(el, filename, 2.5);

        setDownloadSuccessToast(`Gambar PNG 16:9 berhasil diunduh: ${filename}!`);
        confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
      } else if (selectedFormat === 'image_active_slide') {
        setProcessStatus(`Mengambil snapshot gambar slide aktif ke-${currentSlideNum}...`);
        await new Promise((r) => setTimeout(r, 300));

        const activeSlideEl = document.getElementById(activeSlideElementId) || previewRef.current;
        if (!activeSlideEl) throw new Error('Elemen slide aktif tidak ditemukan');

        const filename = `Slide_${currentSlideNum}_Presentasi_Direksi_16x9_${periodeStr.replace(/\s+/g, '_')}.png`;
        await exportSlideElementAsImage(activeSlideEl, filename, 2.5);

        setDownloadSuccessToast(`Gambar Slide ${currentSlideNum} berhasil diunduh: ${filename}!`);
        confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
      }
    } catch (err: any) {
      console.error(err);
      alert(`Gagal mengunduh presentasi: ${err?.message || 'Terjadi kesalahan sistem'}`);
    } finally {
      setIsProcessing(false);
      setProcessStatus('');
      setTimeout(() => setDownloadSuccessToast(null), 4500);
    }
  };

  // Copy Image to Clipboard
  const handleCopyImageToClipboard = async () => {
    try {
      setIsProcessing(true);
      setProcessStatus('Menyalin gambar slide 16:9 ke clipboard...');

      const el = previewRef.current;
      if (!el) throw new Error('Elemen pratinjau slide tidak ditemukan');

      await copySlideElementToClipboard(el, 2);
      setCopiedImageSuccess(true);
      setDownloadSuccessToast('Gambar slide berhasil disalin! Anda bisa langsung tekan Ctrl+V di PowerPoint / Slides.');
      setTimeout(() => setCopiedImageSuccess(false), 3500);
      setTimeout(() => setDownloadSuccessToast(null), 5000);
    } catch (err: any) {
      console.error(err);
      alert('Browser belum mengizinkan penulisan gambar ke clipboard secara langsung. Anda dapat menggunakan tombol "Unduh Gambar PNG" di samping.');
    } finally {
      setIsProcessing(false);
      setProcessStatus('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl bg-white dark:bg-[#0B1728] rounded-3xl shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col max-h-[92vh] overflow-hidden my-auto">
        
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-white/10 bg-gradient-to-r from-[#0E2340] via-[#122b4e] to-[#0E2340] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-white p-1.5 shadow-md flex items-center justify-center shrink-0">
              <img src={AJINOMOTO_LOGO_URL} alt="Ajinomoto" className="max-h-full max-w-full object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-400 text-slate-950">
                  PowerPoint 16:9 Optimized
                </span>
                <span className="text-xs text-amber-200/90 font-medium">Executive Boardroom Deck</span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                Unduh Presentasi & Rangkuman Eksekutif Direksi
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
            title="Tutup"
          >
            <i className="fa-solid fa-xmark text-sm"></i>
          </button>
        </div>

        {/* TOAST ALERT */}
        <AnimatePresence>
          {downloadSuccessToast && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mx-6 mt-3 px-4 py-2.5 rounded-2xl bg-emerald-500 text-white text-xs font-bold flex items-center justify-between shadow-lg"
            >
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-circle-check text-base"></i>
                <span>{downloadSuccessToast}</span>
              </div>
              <button
                type="button"
                onClick={() => setDownloadSuccessToast(null)}
                className="text-white/80 hover:text-white"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* BODY (SCROLLABLE) */}
        <div className="p-6 overflow-y-auto space-y-6">

          {/* 1. PILIH FORMAT EKSPOR POWERPOINT */}
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5">
              1. Pilih Format Unduhan yang Dioptimalkan untuk PowerPoint
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              
              {/* Option A: Full PDF Slide Deck */}
              <button
                type="button"
                onClick={() => setSelectedFormat('pdf_deck')}
                className={`p-4 rounded-2xl text-left border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                  selectedFormat === 'pdf_deck'
                    ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 shadow-md ring-2 ring-indigo-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900/50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-8 h-8 rounded-xl bg-indigo-500 text-white flex items-center justify-center text-sm shadow-xs">
                      <i className="fa-solid fa-file-powerpoint"></i>
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300">
                      6 Slide 16:9
                    </span>
                  </div>
                  <h4 className="text-xs font-black text-slate-900 dark:text-white mb-1">
                    Slide Deck PPT (PDF 16:9)
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                    Slide presentasi lengkap: Cover, Scorecard, Divisi, Departemen, Jabatan & Pengesahan.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-200/60 dark:border-slate-800 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                  <i className="fa-solid fa-tv text-[9px]"></i> Siap Proyektor Rapat
                </div>
              </button>

              {/* Option B: Single Page Summary PDF */}
              <button
                type="button"
                onClick={() => setSelectedFormat('pdf_summary_1p')}
                className={`p-4 rounded-2xl text-left border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                  selectedFormat === 'pdf_summary_1p'
                    ? 'border-amber-500 bg-amber-50/70 dark:bg-amber-950/40 shadow-md ring-2 ring-amber-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900/50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center text-sm shadow-xs">
                      <i className="fa-solid fa-file-lines"></i>
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200">
                      1 Slide Padat
                    </span>
                  </div>
                  <h4 className="text-xs font-black text-slate-900 dark:text-white mb-1">
                    Rangkuman 1 Slide (PDF 16:9)
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                    Seluruh ringkasan eksekutif dan visualisasi data dalam 1 lembar slide PowerPoint.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-200/60 dark:border-slate-800 text-[10px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                  <i className="fa-solid fa-layer-group text-[9px]"></i> Executive Briefing
                </div>
              </button>

              {/* Option C: 16:9 Image Summary */}
              <button
                type="button"
                onClick={() => setSelectedFormat('image_summary_16_9')}
                className={`p-4 rounded-2xl text-left border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                  selectedFormat === 'image_summary_16_9'
                    ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 shadow-md ring-2 ring-emerald-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900/50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center text-sm shadow-xs">
                      <i className="fa-solid fa-image"></i>
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
                      PNG HD 16:9
                    </span>
                  </div>
                  <h4 className="text-xs font-black text-slate-900 dark:text-white mb-1">
                    Gambar PNG Rangkuman
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                    File gambar resolusi tinggi (2.5x) siap di-Insert / Paste langsung ke PowerPoint.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-200/60 dark:border-slate-800 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <i className="fa-solid fa-paste text-[9px]"></i> Siap Tempel PPT
                </div>
              </button>

              {/* Option D: Current Active Slide as Image */}
              <button
                type="button"
                onClick={() => setSelectedFormat('image_active_slide')}
                className={`p-4 rounded-2xl text-left border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                  selectedFormat === 'image_active_slide'
                    ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 shadow-md ring-2 ring-blue-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900/50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-8 h-8 rounded-xl bg-blue-500 text-white flex items-center justify-center text-sm shadow-xs">
                      <i className="fa-solid fa-camera"></i>
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                      Slide #{currentSlideNum}
                    </span>
                  </div>
                  <h4 className="text-xs font-black text-slate-900 dark:text-white mb-1">
                    Gambar Slide Aktif
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                    Ambil gambar snapshot slide yang sedang dibuka pada layar saat ini.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-200/60 dark:border-slate-800 text-[10px] font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                  <i className="fa-solid fa-crosshairs text-[9px]"></i> Snapshot Slide {currentSlideNum}
                </div>
              </button>

            </div>
          </div>

          {/* 2. PRATINJAU SLIDE 16:9 & COPY TO CLIPBOARD */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                2. Pratinjau Visual Slide PowerPoint 16:9
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyImageToClipboard}
                  disabled={isProcessing}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                  title="Salin langsung gambar slide ini ke clipboard untuk di-Paste di PowerPoint"
                >
                  <i className={`fa-solid ${copiedImageSuccess ? 'fa-check text-emerald-500' : 'fa-paste'} text-xs`}></i>
                  <span>{copiedImageSuccess ? 'Tersalin ke Clipboard!' : 'Salin Gambar (Ctrl+V ke PPT)'}</span>
                </button>
              </div>
            </div>

            {/* 16:9 PREVIEW FRAME */}
            <div className="relative w-full rounded-2xl bg-[#081220] p-3 sm:p-4 shadow-xl border border-slate-800 overflow-hidden">
              <div
                ref={previewRef}
                className="w-full aspect-[16/9] bg-[#0E2340] rounded-xl p-4 sm:p-6 text-white flex flex-col justify-between relative overflow-hidden border border-white/10"
              >
                {/* Decorative Top Stripe */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-600 via-amber-400 to-indigo-600"></div>

                {/* Top Slide Header */}
                <div className="flex items-center justify-between pb-3 border-b border-white/15">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-white p-1 flex items-center justify-center shrink-0">
                      <img src={AJINOMOTO_LOGO_URL} alt="Ajinomoto" className="max-h-full max-w-full object-contain" />
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-sm font-black text-white tracking-tight">
                        PT AJINOMOTO INDONESIA - MOJOKERTO FACTORY
                      </h3>
                      <p className="text-[10px] text-amber-300 font-semibold">
                        Laporan Eksekutif Multi-Skill to Top Management &bull; Periode: {periodeStr}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-amber-400 text-slate-950">
                      Executive Scorecard
                    </span>
                    <p className="text-[9px] text-slate-400 mt-0.5">Slide 16:9 Widescreen</p>
                  </div>
                </div>

                {/* Main Content Grid inside Preview */}
                <div className="grid grid-cols-12 gap-3 sm:gap-4 my-auto py-2">
                  {/* Big KPI Box (4 Cols) */}
                  <div className="col-span-4 bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/15 flex flex-col justify-between">
                    <div>
                      <span className="text-[9px] font-bold text-amber-300 uppercase tracking-wider block">
                        Factory Readiness Level
                      </span>
                      <div className="text-2xl sm:text-4xl font-black text-white mt-1">
                        {pctFormatted}
                      </div>
                      <p className="text-[10px] text-slate-300">
                        Target Korporat: {targetCorporate.toFixed(1)}% MS
                      </p>
                    </div>

                    <div className={`mt-2 py-1 px-2 rounded-md text-[9px] font-bold text-center ${
                      isTargetAchieved ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
                    }`}>
                      {isTargetAchieved ? `STATUS: MEMENUHI STANDAR (+${gapToTarget}%)` : `STATUS: DEFISIT KOMPETENSI (${gapToTarget}%)`}
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 mt-2 pt-2 border-t border-white/10 text-[9px]">
                      <div>
                        <span className="text-slate-400 block text-[8px]">MANPOWER</span>
                        <strong className="text-white">{totalManpower} Orang</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[8px]">STANDAR (MS)</span>
                        <strong className="text-emerald-400">{totalMS} Orang</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[8px]">BELUM (US)</span>
                        <strong className="text-red-400">{totalUS} Orang</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[8px]">RATA SKOR</span>
                        <strong className="text-amber-300">{avgScore} / 100</strong>
                      </div>
                    </div>
                  </div>

                  {/* Leaderboard & Breakdown (4 Cols) */}
                  <div className="col-span-4 bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/15 flex flex-col justify-between">
                    <div>
                      <span className="text-[9px] font-bold text-amber-300 uppercase tracking-wider block mb-1">
                        Leaderboard Performa Divisi
                      </span>
                      <div className="space-y-1.5">
                        {rankedDivisions.slice(0, 4).map((d, i) => (
                          <div key={d.label} className="text-[9px] flex items-center justify-between">
                            <span className="truncate max-w-[110px] text-slate-200">
                              {i + 1}. {d.label}
                            </span>
                            <span className={`font-bold ${d.pct >= targetCorporate ? 'text-emerald-400' : 'text-red-400'}`}>
                              {d.pct.toFixed(1)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-2 pt-2 border-t border-white/10">
                      <span className="text-[8px] text-slate-400 block uppercase">Highlight Performa</span>
                      <p className="text-[9px] text-emerald-300 font-bold truncate">
                        🥇 Top: {topDivision?.label} ({topDivision?.pct.toFixed(1)}%)
                      </p>
                    </div>
                  </div>

                  {/* Department Tiers & Action Plan (4 Cols) */}
                  <div className="col-span-4 bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/15 flex flex-col justify-between">
                    <div>
                      <span className="text-[9px] font-bold text-amber-300 uppercase tracking-wider block mb-1">
                        Peta Zona Kepatuhan
                      </span>
                      <div className="space-y-1 text-[9px]">
                        <div className="flex justify-between items-center bg-emerald-500/20 px-2 py-0.5 rounded text-emerald-300">
                          <span>Green Zone (≥85%)</span>
                          <strong>{greenDepts.length} Dept</strong>
                        </div>
                        <div className="flex justify-between items-center bg-amber-500/20 px-2 py-0.5 rounded text-amber-300">
                          <span>Amber Zone (70-84%)</span>
                          <strong>{amberDepts.length} Dept</strong>
                        </div>
                        <div className="flex justify-between items-center bg-red-500/20 px-2 py-0.5 rounded text-red-300">
                          <span>Red Zone (&lt;70%)</span>
                          <strong>{redDepts.length} Dept</strong>
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 pt-2 border-t border-white/10 text-[8px] text-slate-300 space-y-0.5">
                      <p className="font-bold text-amber-300">4 STRATEGIC ACTION PLANS:</p>
                      <p className="truncate">&bull; 30-Day Training for {totalUS} US Personil</p>
                      <p className="truncate">&bull; Cross-Dept Best Practice Sharing</p>
                    </div>
                  </div>
                </div>

                {/* Bottom Footer inside Preview */}
                <div className="flex items-center justify-between pt-2 border-t border-white/15 text-[8px] text-slate-400">
                  <span>Dokumen Rahasia &bull; PT Ajinomoto Indonesia Factory Management</span>
                  <span>Disusun: {signerName} ({signerRole}) &bull; Factory GM: {approvedByName}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. KONFIGURASI PENGESAHAN & CAKUPAN */}
          <div className="bg-slate-50 dark:bg-slate-900/60 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                3. Parameter Cakupan & Pengesahan Digital
              </label>

              {/* Scope Selector */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 dark:text-slate-400">Cakupan:</span>
                <button
                  type="button"
                  onClick={() => setExportScope('filtered')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                    exportScope === 'filtered'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  Sesuai Filter ({filteredEmployees.length} Karyawan)
                </button>
                <button
                  type="button"
                  onClick={() => setExportScope('all')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                    exportScope === 'all'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  Seluruh Pabrik ({allEmployees.length} Karyawan)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Penyusun Laporan (HR Specialist)
                </label>
                <input
                  type="text"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Penelaah Laporan (HR & GA Dept Head)
                </label>
                <input
                  type="text"
                  value={reviewedByName}
                  onChange={(e) => setReviewedByName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Pemberi Persetujuan (Factory GM)
                </label>
                <input
                  type="text"
                  value={approvedByName}
                  onChange={(e) => setApprovedByName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                />
              </div>
            </div>
          </div>

        </div>

        {/* FOOTER ACTIONS */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0E1E34] flex items-center justify-between flex-wrap gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <i className="fa-solid fa-circle-info text-amber-500"></i>
            <span>
              Format slide 16:9 disesuaikan dengan dimensi resmi <strong>Microsoft PowerPoint Widescreen</strong> (13.333" x 7.5").
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              Batal
            </button>

            <button
              type="button"
              onClick={handleExecuteExport}
              disabled={isProcessing}
              className="px-5 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500 via-amber-600 to-[#0E2340] hover:from-amber-600 hover:to-slate-900 text-white shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin text-sm"></i>
                  <span>{processStatus || 'Memproses Unduhan...'}</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-download text-sm"></i>
                  <span>
                    {selectedFormat.startsWith('pdf')
                      ? 'Unduh File Presentasi PDF (16:9)'
                      : 'Unduh File Gambar PNG (16:9)'}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
