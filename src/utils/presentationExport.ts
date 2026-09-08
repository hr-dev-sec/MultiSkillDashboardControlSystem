import jsPDF from 'jspdf';
import { toPng, toBlob } from 'html-to-image';
import { Employee, AppFiltersState, UserSession, DashboardStats } from '../types';
import { BULAN_LABELS } from '../data/initialData';
import { computeDashboardStats, AJINOMOTO_LOGO_URL } from './storage';

// Standard 16:9 Widescreen dimensions for Microsoft PowerPoint / Google Slides in millimeters
export const PPT_16_9_WIDTH = 338.67;
export const PPT_16_9_HEIGHT = 190.5;

// Corporate Colors
const COLOR_NAVY: [number, number, number] = [14, 35, 64];        // #0E2340
const COLOR_RED: [number, number, number] = [218, 41, 28];        // #DA291C (Ajinomoto Red)
const COLOR_GOLD: [number, number, number] = [184, 135, 75];      // #B8874B (Gold Accent)
const COLOR_GREEN: [number, number, number] = [15, 169, 104];     // #0FA968 (Standar MS)
const COLOR_DANGER_RED: [number, number, number] = [225, 6, 0];   // #E10600 (Belum Standar US)
const COLOR_TEXT_DARK: [number, number, number] = [15, 23, 42];   // #0F172A
const COLOR_TEXT_MUTED: [number, number, number] = [100, 116, 139];// #64748B
const COLOR_CARD_BG: [number, number, number] = [248, 250, 252];  // #F8FAFC
const COLOR_BORDER: [number, number, number] = [226, 232, 240];   // #E2E8F0

export interface PresentationExportOptions {
  scope: 'filtered' | 'all';
  filteredEmployees: Employee[];
  allEmployees: Employee[];
  filters: AppFiltersState;
  currentUser: UserSession;
  approvers?: {
    preparedBy?: { name: string; title: string };
    reviewedBy?: { name: string; title: string };
    approvedBy?: { name: string; title: string };
  };
  singlePageSummaryOnly?: boolean;
}

export interface PresentationExportResult {
  doc: jsPDF;
  filename: string;
  pageCount: number;
}

/**
 * Draw official PowerPoint-style top navigation/header bar on a 16:9 slide
 */
function drawSlideHeader(
  doc: jsPDF,
  slideNumber: number,
  totalSlides: number,
  slideTag: string,
  slideTitle: string,
  periodeStr: string
) {
  // Top brand stripe (Navy + Gold + Red)
  doc.setFillColor(...COLOR_NAVY);
  doc.rect(0, 0, PPT_16_9_WIDTH, 18, 'F');

  // Red & Gold accent bars
  doc.setFillColor(...COLOR_RED);
  doc.rect(0, 18, PPT_16_9_WIDTH * 0.7, 1.5, 'F');
  doc.setFillColor(...COLOR_GOLD);
  doc.rect(PPT_16_9_WIDTH * 0.7, 18, PPT_16_9_WIDTH * 0.3, 1.5, 'F');

  // Slide header text
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('PT AJINOMOTO INDONESIA - MOJOKERTO FACTORY', 14, 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(200, 215, 235);
  doc.text(`EXECUTIVE BOARDROOM BRIEFING | PERIODE: ${periodeStr.toUpperCase()}`, 14, 14);

  // Right badges: slide tag & number
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 215, 0); // Gold
  doc.text(slideTag.toUpperCase(), PPT_16_9_WIDTH - 65, 8, { align: 'right' });

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`SLIDE ${slideNumber} / ${totalSlides}`, PPT_16_9_WIDTH - 14, 8, { align: 'right' });

  // Subtitle / Slide main title banner
  doc.setTextColor(...COLOR_TEXT_DARK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(slideTitle, 14, 28);

  // Subtle separator line below title
  doc.setDrawColor(...COLOR_BORDER);
  doc.setLineWidth(0.4);
  doc.line(14, 31, PPT_16_9_WIDTH - 14, 31);
}

/**
 * Draw official PowerPoint-style bottom footer bar on a 16:9 slide
 */
function drawSlideFooter(doc: jsPDF, slideNumber: number, totalSlides: number) {
  const footerY = PPT_16_9_HEIGHT - 8;
  doc.setDrawColor(...COLOR_BORDER);
  doc.setLineWidth(0.3);
  doc.line(14, footerY - 2, PPT_16_9_WIDTH - 14, footerY - 2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...COLOR_TEXT_MUTED);
  doc.text('Dokumen Rahasia - Khusus Presentasi Internal Direksi & Manajemen Pabrik Mojokerto', 14, footerY + 2);

  doc.text(`Ajinomoto Multi-Skill Monitoring System | Slide ${slideNumber} of ${totalSlides}`, PPT_16_9_WIDTH - 14, footerY + 2, { align: 'right' });
}

/**
 * Generate official PowerPoint-optimized PDF Deck (16:9 Widescreen)
 */
export function generatePowerPointPdfDeck({
  scope,
  filteredEmployees,
  allEmployees,
  filters,
  currentUser,
  approvers,
  singlePageSummaryOnly = false
}: PresentationExportOptions): PresentationExportResult {
  const targetData = scope === 'filtered' ? filteredEmployees : allEmployees;
  const stats: DashboardStats = computeDashboardStats(targetData);
  const { totalManpower, totalMS, totalUS, percentMS, byDivisi, byDepartment, byPosition } = stats;

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
  const periodeStr = `${blnStr} ${thnStr}`;
  const divStr = filters.divisi.join(', ') || 'Semua Divisi';
  const deptStr = filters.department.join(', ') || 'Semua Departemen';

  // Division ranking calculation
  const rankedDivisions = [...byDivisi]
    .map((d) => {
      const total = d.ms + d.us;
      const pct = total > 0 ? (d.ms / total) * 100 : 0;
      return { ...d, total, pct };
    })
    .sort((a, b) => b.pct - a.pct);

  const topDivision = rankedDivisions.length > 0 ? rankedDivisions[0] : null;
  const bottomDivision = rankedDivisions.length > 1 ? rankedDivisions[rankedDivisions.length - 1] : null;

  // Department categorization into Green, Amber, Red Tiers
  const deptList = [...byDepartment].map((dept) => {
    const total = dept.ms + dept.us;
    const pct = total > 0 ? (dept.ms / total) * 100 : 0;
    return { ...dept, total, pct };
  });
  const greenDepts = deptList.filter((d) => d.pct >= 85).sort((a, b) => b.pct - a.pct);
  const amberDepts = deptList.filter((d) => d.pct >= 70 && d.pct < 85).sort((a, b) => b.pct - a.pct);
  const redDepts = deptList.filter((d) => d.pct < 70).sort((a, b) => a.pct - b.pct);

  // Initialize jsPDF in 16:9 Widescreen (338.67 x 190.5 mm)
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [PPT_16_9_WIDTH, PPT_16_9_HEIGHT]
  });

  const totalSlides = singlePageSummaryOnly ? 1 : 6;

  // =========================================================================
  // SINGLE-PAGE EXECUTIVE SUMMARY (If requested)
  // =========================================================================
  if (singlePageSummaryOnly) {
    drawSlideHeader(doc, 1, 1, 'RANGKUMAN 1 SLIDE POWERPOINT', 'Executive Briefing & Visualisasi Kinerja Multi-Skill Pabrik', periodeStr);

    // Left Column: Big Scorecard (W: 100mm)
    const cardY = 36;
    doc.setFillColor(...COLOR_NAVY);
    doc.roundedRect(14, cardY, 95, 140, 4, 4, 'F');

    // Scorecard Badge
    doc.setFillColor(...COLOR_GOLD);
    doc.roundedRect(20, cardY + 8, 83, 7, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text('FACTORY READINESS SCORECARD', 61.5, cardY + 13, { align: 'center' });

    // Big Rate
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(36);
    doc.text(pctFormatted, 61.5, cardY + 30, { align: 'center' });

    doc.setFontSize(9);
    doc.setTextColor(200, 215, 235);
    doc.text(`Target Korporat: ${targetCorporate.toFixed(1)}% MS`, 61.5, cardY + 36, { align: 'center' });

    // Status Banner
    if (isTargetAchieved) {
      doc.setFillColor(15, 169, 104);
      doc.roundedRect(20, cardY + 40, 83, 11, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(255, 255, 255);
      doc.text(`MEMENUHI STANDAR (+${gapToTarget}%)`, 61.5, cardY + 47, { align: 'center' });
    } else {
      doc.setFillColor(225, 6, 0);
      doc.roundedRect(20, cardY + 40, 83, 11, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(255, 255, 255);
      doc.text(`DEFISIT STANDAR (${gapToTarget}%)`, 61.5, cardY + 47, { align: 'center' });
    }

    // 4 Macro Metrics Subcards inside Left Column
    const metricsY = cardY + 56;
    const subcards = [
      { label: 'TOTAL HEADCOUNT', val: `${totalManpower} Orang`, color: [255, 255, 255] },
      { label: 'STANDAR (MS)', val: `${totalMS} Karyawan`, color: [52, 211, 153] },
      { label: 'BELUM STANDAR (US)', val: `${totalUS} Karyawan`, color: [248, 113, 113] },
      { label: 'RATA-RATA SKOR', val: `${avgScore} / 100`, color: [251, 191, 36] }
    ];

    subcards.forEach((sc, i) => {
      const sy = metricsY + i * 19;
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(20, sy, 83, 16, 2, 2, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(sc.label, 24, sy + 6);

      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(sc.val, 24, sy + 13);
    });

    // Middle Column: Divisional Leaderboard & Visual Bars (W: 105mm)
    const midX = 114;
    doc.setFillColor(...COLOR_CARD_BG);
    doc.roundedRect(midX, cardY, 105, 140, 4, 4, 'F');
    doc.setDrawColor(...COLOR_BORDER);
    doc.roundedRect(midX, cardY, 105, 140, 4, 4, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...COLOR_NAVY);
    doc.text('LEADERBOARD PERFORMA DIVISI', midX + 6, cardY + 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLOR_TEXT_MUTED);
    doc.text('Tingkat Ketercapaian Multi-Skill per Divisi Pabrik', midX + 6, cardY + 15);

    // List divisions
    const divStartY = cardY + 22;
    rankedDivisions.slice(0, 6).forEach((div, i) => {
      const dy = divStartY + i * 19;
      const isAchieved = div.pct >= targetCorporate;

      // Division Name + Rank
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...COLOR_TEXT_DARK);
      doc.text(`${i + 1}. ${div.label}`, midX + 6, dy + 4);

      // Pct Text
      doc.setFontSize(8.5);
      doc.setTextColor(isAchieved ? COLOR_GREEN[0] : COLOR_DANGER_RED[0], isAchieved ? COLOR_GREEN[1] : COLOR_DANGER_RED[1], isAchieved ? COLOR_GREEN[2] : COLOR_DANGER_RED[2]);
      doc.text(`${div.pct.toFixed(1)}% (${div.ms}/${div.total})`, midX + 99, dy + 4, { align: 'right' });

      // Progress bar background
      doc.setFillColor(226, 232, 240);
      doc.roundedRect(midX + 6, dy + 7, 93, 4, 1.5, 1.5, 'F');

      // Progress bar fill
      const barW = Math.max(2, Math.min(93, (div.pct / 100) * 93));
      doc.setFillColor(isAchieved ? COLOR_GREEN[0] : COLOR_DANGER_RED[0], isAchieved ? COLOR_GREEN[1] : COLOR_DANGER_RED[1], isAchieved ? COLOR_GREEN[2] : COLOR_DANGER_RED[2]);
      doc.roundedRect(midX + 6, dy + 7, barW, 4, 1.5, 1.5, 'F');
    });

    // Right Column: Department Tiers & Action Plan (W: 101mm)
    const rightX = 224;
    doc.setFillColor(...COLOR_CARD_BG);
    doc.roundedRect(rightX, cardY, 100, 140, 4, 4, 'F');
    doc.setDrawColor(...COLOR_BORDER);
    doc.roundedRect(rightX, cardY, 100, 140, 4, 4, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...COLOR_NAVY);
    doc.text('MATRIKS DEPARTEMEN & ACTION PLAN', rightX + 6, cardY + 10);

    // Green / Amber / Red summary boxes
    const tierBoxes = [
      { label: `GREEN ZONE (>=85%): ${greenDepts.length} Dept`, color: [15, 169, 104], bg: [236, 253, 245], text: greenDepts.slice(0, 2).map((d) => d.label).join(', ') || 'Belum ada' },
      { label: `AMBER ZONE (70-84%): ${amberDepts.length} Dept`, color: [184, 135, 75], bg: [254, 252, 232], text: amberDepts.slice(0, 2).map((d) => d.label).join(', ') || 'Belum ada' },
      { label: `RED ZONE (<70%): ${redDepts.length} Dept`, color: [225, 6, 0], bg: [254, 242, 242], text: redDepts.slice(0, 2).map((d) => `${d.label} (${d.us} US)`).join(', ') || '0 Dept (Optimal)' }
    ];

    tierBoxes.forEach((tb, i) => {
      const ty = cardY + 18 + i * 21;
      doc.setFillColor(tb.bg[0], tb.bg[1], tb.bg[2]);
      doc.roundedRect(rightX + 6, ty, 88, 17, 2, 2, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(tb.color[0], tb.color[1], tb.color[2]);
      doc.text(tb.label, rightX + 9, ty + 6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...COLOR_TEXT_DARK);
      doc.text(tb.text, rightX + 9, ty + 12, { maxWidth: 82 });
    });

    // Action plan items
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...COLOR_NAVY);
    doc.text('4 STRATEGIC ACTION PLANS:', rightX + 6, cardY + 86);

    const plans = [
      `1. Refreshment Training 30 Hari bagi ${totalUS} personil US.`,
      '2. Rotasi & Benchmarking Best Practice antar Departemen.',
      '3. Peningkatan Jam Terbang Simulator Kompetensi Teknis.',
      '4. Verifikasi Ulang Hasil Evaluasi Periode Berikutnya.'
    ];

    plans.forEach((pl, i) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...COLOR_TEXT_DARK);
      doc.text(pl, rightX + 6, cardY + 94 + i * 7, { maxWidth: 88 });
    });

    // Verification signoff info
    doc.setFillColor(...COLOR_NAVY);
    doc.roundedRect(rightX + 6, cardY + 122, 88, 13, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(255, 215, 0);
    doc.text(`VERIFIKASI SISTEM: ${new Date().toLocaleDateString('id-ID')}`, rightX + 10, cardY + 127);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(255, 255, 255);
    doc.text(`Disusun oleh: ${approvers?.preparedBy?.name || currentUser.name || 'HR Development'}`, rightX + 10, cardY + 132);

    drawSlideFooter(doc, 1, 1);

    const filename = `Rangkuman_Presentasi_Direksi_1Slide_${periodeStr.replace(/\s+/g, '_')}.pdf`;
    return { doc, filename, pageCount: 1 };
  }

  // =========================================================================
  // MULTI-SLIDE POWERPOINT DECK (6 SLIDES 16:9)
  // =========================================================================

  // --- SLIDE 1: COVER / TITLE SLIDE ---
  // Dark Navy Executive Background
  doc.setFillColor(...COLOR_NAVY);
  doc.rect(0, 0, PPT_16_9_WIDTH, PPT_16_9_HEIGHT, 'F');

  // Decorative Accent Waves / Bars
  doc.setFillColor(...COLOR_RED);
  doc.rect(0, PPT_16_9_HEIGHT - 12, PPT_16_9_WIDTH * 0.65, 4, 'F');
  doc.setFillColor(...COLOR_GOLD);
  doc.rect(PPT_16_9_WIDTH * 0.65, PPT_16_9_HEIGHT - 12, PPT_16_9_WIDTH * 0.35, 4, 'F');

  // Pill badge
  doc.setFillColor(255, 255, 255, 0.1);
  doc.roundedRect(24, 30, 95, 10, 5, 5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 215, 0); // Gold
  doc.text('EXECUTIVE BOARDROOM BRIEFING', 71.5, 36.5, { align: 'center' });

  // Main Cover Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(255, 255, 255);
  doc.text('LAPORAN EKSEKUTIF MULTI-SKILL', 24, 55);
  doc.text('TO TOP MANAGEMENT', 24, 68);

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.setTextColor(200, 215, 235);
  doc.text('Evaluasi Kesiapan Kompetensi Karyawan, Leaderboard Divisi, & Action Plan Pabrik', 24, 82);

  // Metadata Card inside Cover
  doc.setFillColor(255, 255, 255, 0.08);
  doc.roundedRect(24, 100, 160, 48, 4, 4, 'F');
  doc.setDrawColor(255, 255, 255, 0.2);
  doc.roundedRect(24, 100, 160, 48, 4, 4, 'S');

  const metaFields = [
    { label: 'Entitas Pabrik', val: 'PT Ajinomoto Indonesia - Pabrik Mojokerto' },
    { label: 'Periode Evaluasi', val: `${blnStr} ${thnStr}` },
    { label: 'Cakupan Laporan', val: `${divStr} | ${deptStr}` },
    { label: 'Presenter / PIC', val: `${approvers?.preparedBy?.name || currentUser.name || 'HR Development'} (${approvers?.preparedBy?.title || currentUser.role || 'HR Specialist'})` }
  ];

  metaFields.forEach((mf, i) => {
    const my = 110 + i * 9.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 215, 0);
    doc.text(`${mf.label}:`, 32, my);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(255, 255, 255);
    doc.text(mf.val, 70, my);
  });

  // Right Side Preview KPI Pill
  doc.setFillColor(255, 255, 255, 0.08);
  doc.roundedRect(210, 50, 104, 98, 4, 4, 'F');
  doc.setDrawColor(...COLOR_GOLD);
  doc.setLineWidth(0.8);
  doc.roundedRect(210, 50, 104, 98, 4, 4, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 215, 0);
  doc.text('FACTORY READINESS LEVEL', 262, 65, { align: 'center' });

  doc.setFontSize(44);
  doc.setTextColor(255, 255, 255);
  doc.text(pctFormatted, 262, 85, { align: 'center' });

  doc.setFontSize(9.5);
  doc.setTextColor(200, 215, 235);
  doc.text(`Standar Target: ${targetCorporate.toFixed(1)}% MS`, 262, 95, { align: 'center' });

  doc.setFillColor(isTargetAchieved ? COLOR_GREEN[0] : COLOR_DANGER_RED[0], isTargetAchieved ? COLOR_GREEN[1] : COLOR_DANGER_RED[1], isTargetAchieved ? COLOR_GREEN[2] : COLOR_DANGER_RED[2]);
  doc.roundedRect(222, 105, 80, 12, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(isTargetAchieved ? 'STATUS: TARGET TERCAPAI' : 'STATUS: DEFISIT KOMPETENSI', 262, 112.5, { align: 'center' });

  doc.setFontSize(8);
  doc.setTextColor(200, 215, 235);
  doc.text(`${totalMS} Standar | ${totalUS} Belum Standar dari ${totalManpower} Manpower`, 262, 128, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(150, 175, 205);
  doc.text('Slide 1 of 6 | Ajinomoto Internal Presentation Deck', PPT_16_9_WIDTH - 24, PPT_16_9_HEIGHT - 6, { align: 'right' });

  // --- SLIDE 2: SCORECARD PABRIK & RINGKASAN MAKRO ---
  doc.addPage([PPT_16_9_WIDTH, PPT_16_9_HEIGHT], 'landscape');
  drawSlideHeader(doc, 2, 6, 'SCORECARD MAKRO', 'Kesiapan Multi-Skill Pabrik Mojokerto vs Target Korporat', periodeStr);

  // Top Full Width KPI Banner (Y: 36, H: 45)
  doc.setFillColor(...COLOR_NAVY);
  doc.roundedRect(14, 36, PPT_16_9_WIDTH - 28, 45, 4, 4, 'F');

  // Left Big Stat Box
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 215, 0);
  doc.text('TINGKAT MULTI-SKILL PABRIK', 24, 46);

  doc.setFontSize(36);
  doc.setTextColor(255, 255, 255);
  doc.text(pctFormatted, 24, 62);

  doc.setFontSize(9.5);
  doc.setTextColor(200, 215, 235);
  doc.text(`Target Korporat: ${targetCorporate.toFixed(1)}% (${isTargetAchieved ? `+${gapToTarget}%` : `${gapToTarget}%`})`, 24, 70);

  // Separator
  doc.setDrawColor(255, 255, 255, 0.2);
  doc.line(105, 42, 105, 75);

  // 4 Metric Subcards
  const macroSubcards = [
    { title: 'TOTAL MANPOWER', val: `${totalManpower}`, sub: 'Karyawan Aktif Evaluasi', color: [255, 255, 255] },
    { title: 'STANDAR (MS)', val: `${totalMS}`, sub: 'Kompeten Mandiri di Lini', color: [52, 211, 153] },
    { title: 'BELUM STANDAR (US)', val: `${totalUS}`, sub: 'Memerlukan Pembinaan', color: [248, 113, 113] },
    { title: 'RATA-RATA SKOR', val: `${avgScore}`, sub: 'Skala Maksimum 100', color: [251, 191, 36] }
  ];

  macroSubcards.forEach((mc, i) => {
    const mx = 115 + i * 49;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(200, 215, 235);
    doc.text(mc.title, mx, 48);

    doc.setFontSize(20);
    doc.setTextColor(mc.color[0], mc.color[1], mc.color[2]);
    doc.text(mc.val, mx, 60);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(180, 200, 225);
    doc.text(mc.sub, mx, 68);
  });

  // Bottom 3 Strategic Pillar Cards
  const pillarY = 88;
  const pillarCards = [
    {
      title: 'FLEKSIBILITAS LINI OPERASIONAL',
      badge: `${pctFormatted} Fleksibel`,
      desc: `Ketersediaan personil multi-skill saat ini (${totalMS} orang) memberikan jaminan stabilitas rotasi kerja, backup shift darurat, serta kelancaran continuous production tanpa hambatan downtime.`
    },
    {
      title: 'MITIGASI RISIKO MUTU & K3 PABRIK',
      badge: 'Zero Defect Focus',
      desc: 'Evaluasi 92 kompetensi teknis mencakup kepatuhan Good Manufacturing Practice (GMP), Higienitas pangan, Sistem Jaminan Halal, serta Standar K3 Zero-Accident di setiap area mesin.'
    },
    {
      title: 'TARGET & AKSELERASI PEMBINAAN',
      badge: `${totalUS} Personil Target`,
      desc: `Fokus utama bulan berikutnya adalah pembinaan intensif bagi ${totalUS} personil berstatus US agar mampu meningkatkan kompetensi dan mencapai standar kelulusan minimum 80.0%.`
    }
  ];

  pillarCards.forEach((pc, i) => {
    const px = 14 + i * 105;
    doc.setFillColor(...COLOR_CARD_BG);
    doc.roundedRect(px, pillarY, 100, 88, 4, 4, 'F');
    doc.setDrawColor(...COLOR_BORDER);
    doc.roundedRect(px, pillarY, 100, 88, 4, 4, 'S');

    // Pillar Header Box
    doc.setFillColor(...COLOR_NAVY);
    doc.roundedRect(px, pillarY, 100, 16, 4, 4, 'F');
    doc.rect(px, pillarY + 10, 100, 6, 'F'); // square bottom corners

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text(pc.title, px + 6, pillarY + 10.5);

    // Badge
    doc.setFillColor(...COLOR_GOLD);
    doc.roundedRect(px + 6, pillarY + 22, 50, 7, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);
    doc.text(pc.badge, px + 8, pillarY + 26.5);

    // Description text
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...COLOR_TEXT_DARK);
    doc.text(pc.desc, px + 6, pillarY + 38, { maxWidth: 88, lineHeightFactor: 1.4 });
  });

  drawSlideFooter(doc, 2, 6);

  // --- SLIDE 3: DIVISIONAL BENCHMARK & LEADERBOARD ---
  doc.addPage([PPT_16_9_WIDTH, PPT_16_9_HEIGHT], 'landscape');
  drawSlideHeader(doc, 3, 6, 'BENCHMARK DIVISI', 'Leaderboard & Peringkat Ketercapaian Multi-Skill Antar Divisi', periodeStr);

  // Top Highlights: Best Performer vs Needs Support (Y: 36, H: 26)
  if (topDivision) {
    doc.setFillColor(236, 253, 245); // emerald-50
    doc.roundedRect(14, 36, 150, 26, 3, 3, 'F');
    doc.setDrawColor(15, 169, 104);
    doc.roundedRect(14, 36, 150, 26, 3, 3, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 169, 104);
    doc.text('DIVISI PERFORMA TERBAIK (PERINGKAT 1)', 22, 43);

    doc.setFontSize(12);
    doc.setTextColor(...COLOR_NAVY);
    doc.text(topDivision.label, 22, 51);

    doc.setFontSize(8.5);
    doc.setTextColor(15, 169, 104);
    doc.text(`Pencapaian: ${topDivision.pct.toFixed(1)}% MS (${topDivision.ms} dari ${topDivision.total} personil memenuhi standar)`, 22, 58);
  }

  if (bottomDivision) {
    doc.setFillColor(254, 252, 232); // amber-50
    doc.roundedRect(174, 36, 150, 26, 3, 3, 'F');
    doc.setDrawColor(184, 135, 75);
    doc.roundedRect(174, 36, 150, 26, 3, 3, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(184, 135, 75);
    doc.text('DIVISI FOKUS PENDAMPINGAN HR', 182, 43);

    doc.setFontSize(12);
    doc.setTextColor(...COLOR_NAVY);
    doc.text(bottomDivision.label, 182, 51);

    doc.setFontSize(8.5);
    doc.setTextColor(184, 135, 75);
    doc.text(`Pencapaian: ${bottomDivision.pct.toFixed(1)}% MS (${bottomDivision.us} personil prioritas upskilling)`, 182, 58);
  }

  // Full Leaderboard Table (Y: 68)
  const tblY = 68;
  doc.setFillColor(...COLOR_NAVY);
  doc.roundedRect(14, tblY, PPT_16_9_WIDTH - 28, 10, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('RANK', 20, tblY + 6.5);
  doc.text('NAMA DIVISI', 45, tblY + 6.5);
  doc.text('HEADCOUNT', 135, tblY + 6.5, { align: 'center' });
  doc.text('STANDAR (MS)', 168, tblY + 6.5, { align: 'center' });
  doc.text('BELUM (US)', 200, tblY + 6.5, { align: 'center' });
  doc.text('% PENCAPAIAN', 242, tblY + 6.5, { align: 'center' });
  doc.text('STATUS KORPORAT', PPT_16_9_WIDTH - 24, tblY + 6.5, { align: 'right' });

  rankedDivisions.slice(0, 7).forEach((div, idx) => {
    const rowY = tblY + 11 + idx * 13.5;
    const isEven = idx % 2 === 0;
    const isPassed = div.pct >= targetCorporate;

    doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
    doc.rect(14, rowY, PPT_16_9_WIDTH - 28, 13, 'F');
    doc.setDrawColor(...COLOR_BORDER);
    doc.line(14, rowY + 13, PPT_16_9_WIDTH - 14, rowY + 13);

    // Rank Medal / Number
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    if (idx === 0) {
      doc.setTextColor(184, 135, 75);
      doc.text('#1 [TOP]', 20, rowY + 8.5);
    } else {
      doc.setTextColor(...COLOR_TEXT_MUTED);
      doc.text(`#${idx + 1}`, 20, rowY + 8.5);
    }

    // Divisi Name
    doc.setTextColor(...COLOR_TEXT_DARK);
    doc.setFontSize(9);
    doc.text(div.label, 45, rowY + 8.5);

    // Counts
    doc.setFont('helvetica', 'normal');
    doc.text(`${div.total}`, 135, rowY + 8.5, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 169, 104);
    doc.text(`${div.ms}`, 168, rowY + 8.5, { align: 'center' });

    doc.setTextColor(225, 6, 0);
    doc.text(`${div.us}`, 200, rowY + 8.5, { align: 'center' });

    // Progress Bar + Text
    doc.setTextColor(...COLOR_NAVY);
    doc.text(`${div.pct.toFixed(1)}%`, 228, rowY + 8.5);

    // Small bar
    doc.setFillColor(226, 232, 240);
    doc.roundedRect(242, rowY + 5, 40, 3.5, 1, 1, 'F');
    doc.setFillColor(isPassed ? COLOR_GREEN[0] : COLOR_DANGER_RED[0], isPassed ? COLOR_GREEN[1] : COLOR_DANGER_RED[1], isPassed ? COLOR_GREEN[2] : COLOR_DANGER_RED[2]);
    const bw = Math.max(1, Math.min(40, (div.pct / 100) * 40));
    doc.roundedRect(242, rowY + 5, bw, 3.5, 1, 1, 'F');

    // Status Badge
    doc.setFontSize(7.5);
    if (isPassed) {
      doc.setFillColor(236, 253, 245);
      doc.roundedRect(PPT_16_9_WIDTH - 52, rowY + 3.5, 38, 6.5, 1.5, 1.5, 'F');
      doc.setTextColor(15, 169, 104);
      doc.text('ACHIEVED', PPT_16_9_WIDTH - 33, rowY + 8, { align: 'center' });
    } else {
      doc.setFillColor(254, 242, 242);
      doc.roundedRect(PPT_16_9_WIDTH - 52, rowY + 3.5, 38, 6.5, 1.5, 1.5, 'F');
      doc.setTextColor(225, 6, 0);
      doc.text('NEEDS SUPPORT', PPT_16_9_WIDTH - 33, rowY + 8, { align: 'center' });
    }
  });

  drawSlideFooter(doc, 3, 6);

  // --- SLIDE 4: DEPARTMENT COMPLIANCE TIERS ---
  doc.addPage([PPT_16_9_WIDTH, PPT_16_9_HEIGHT], 'landscape');
  drawSlideHeader(doc, 4, 6, 'ANALISIS DEPARTEMEN', 'Peta Kepatuhan Standar & Kategori Zona Departemen', periodeStr);

  // 3 Large Tier Cards (Green, Amber, Red)
  const dCardY = 36;
  const dCardW = 100;
  const dCardH = 140;

  // 1. GREEN ZONE
  const gX = 14;
  doc.setFillColor(236, 253, 245);
  doc.roundedRect(gX, dCardY, dCardW, dCardH, 4, 4, 'F');
  doc.setDrawColor(15, 169, 104);
  doc.roundedRect(gX, dCardY, dCardW, dCardH, 4, 4, 'S');

  doc.setFillColor(15, 169, 104);
  doc.roundedRect(gX, dCardY, dCardW, 14, 4, 4, 'F');
  doc.rect(gX, dCardY + 8, dCardW, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  doc.text(`GREEN ZONE (>= 85%) - ${greenDepts.length} DEPT`, gX + 6, dCardY + 9);

  doc.setFontSize(8);
  doc.setTextColor(15, 169, 104);
  doc.text('Departemen Kepatuhan Tinggi / Sangat Mandiri', gX + 6, dCardY + 20);

  // Dept list
  greenDepts.slice(0, 6).forEach((d, i) => {
    const dy = dCardY + 26 + i * 18;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(gX + 6, dy, dCardW - 12, 14, 2, 2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...COLOR_TEXT_DARK);
    doc.text(d.label, gX + 10, dy + 6);

    doc.setFontSize(8);
    doc.setTextColor(15, 169, 104);
    doc.text(`${d.pct.toFixed(1)}% MS (${d.ms}/${d.total})`, gX + 10, dy + 11);
  });

  // 2. AMBER ZONE
  const aX = 119;
  doc.setFillColor(254, 252, 232);
  doc.roundedRect(aX, dCardY, dCardW, dCardH, 4, 4, 'F');
  doc.setDrawColor(184, 135, 75);
  doc.roundedRect(aX, dCardY, dCardW, dCardH, 4, 4, 'S');

  doc.setFillColor(184, 135, 75);
  doc.roundedRect(aX, dCardY, dCardW, 14, 4, 4, 'F');
  doc.rect(aX, dCardY + 8, dCardW, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  doc.text(`AMBER ZONE (70 - 84%) - ${amberDepts.length} DEPT`, aX + 6, dCardY + 9);

  doc.setFontSize(8);
  doc.setTextColor(184, 135, 75);
  doc.text('Departemen Kategori Stabil / Menuju Target', aX + 6, dCardY + 20);

  amberDepts.slice(0, 6).forEach((d, i) => {
    const dy = dCardY + 26 + i * 18;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(aX + 6, dy, dCardW - 12, 14, 2, 2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...COLOR_TEXT_DARK);
    doc.text(d.label, aX + 10, dy + 6);

    doc.setFontSize(8);
    doc.setTextColor(184, 135, 75);
    doc.text(`${d.pct.toFixed(1)}% MS (${d.ms}/${d.total})`, aX + 10, dy + 11);
  });

  // 3. RED ZONE
  const rX = 224;
  doc.setFillColor(254, 242, 242);
  doc.roundedRect(rX, dCardY, dCardW, dCardH, 4, 4, 'F');
  doc.setDrawColor(225, 6, 0);
  doc.roundedRect(rX, dCardY, dCardW, dCardH, 4, 4, 'S');

  doc.setFillColor(225, 6, 0);
  doc.roundedRect(rX, dCardY, dCardW, 14, 4, 4, 'F');
  doc.rect(rX, dCardY + 8, dCardW, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  doc.text(`RED ZONE (< 70%) - ${redDepts.length} DEPT`, rX + 6, dCardY + 9);

  doc.setFontSize(8);
  doc.setTextColor(225, 6, 0);
  doc.text('Departemen Prioritas Pendampingan & Intervensi', rX + 6, dCardY + 20);

  if (redDepts.length === 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 169, 104);
    doc.text('Luar biasa! Tidak ada departemen di Red Zone.', rX + 10, dCardY + 40);
  } else {
    redDepts.slice(0, 6).forEach((d, i) => {
      const dy = dCardY + 26 + i * 18;
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(rX + 6, dy, dCardW - 12, 14, 2, 2, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...COLOR_TEXT_DARK);
      doc.text(d.label, rX + 10, dy + 6);

      doc.setFontSize(8);
      doc.setTextColor(225, 6, 0);
      doc.text(`${d.pct.toFixed(1)}% MS (${d.us} personil US)`, rX + 10, dy + 11);
    });
  }

  drawSlideFooter(doc, 4, 6);

  // --- SLIDE 5: JOB POSITION & LEADERSHIP THRESHOLD MATRIX ---
  doc.addPage([PPT_16_9_WIDTH, PPT_16_9_HEIGHT], 'landscape');
  drawSlideHeader(doc, 5, 6, 'MATRIKS JABATAN', 'Kesiapan Multi-Skill Berdasarkan Jenjang Jabatan & Threshold', periodeStr);

  const posCardY = 36;
  byPosition.slice(0, 6).forEach((pos, idx) => {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const px = 14 + col * 105;
    const py = posCardY + row * 68;
    const pct = (pos.resultPercent || 0) * 100;
    const isPassed = pct >= (pos.threshold || 70);

    doc.setFillColor(...COLOR_CARD_BG);
    doc.roundedRect(px, py, 100, 62, 3, 3, 'F');
    doc.setDrawColor(...COLOR_BORDER);
    doc.roundedRect(px, py, 100, 62, 3, 3, 'S');

    // Title + Threshold badge
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...COLOR_NAVY);
    doc.text(pos.label.toUpperCase(), px + 6, py + 10);

    doc.setFillColor(226, 232, 240);
    doc.roundedRect(px + 65, py + 4, 30, 7, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text(`STD: ${pos.threshold}%`, px + 80, py + 8.5, { align: 'center' });

    // Rate
    doc.setFontSize(26);
    doc.setTextColor(...COLOR_TEXT_DARK);
    doc.text(`${pct.toFixed(1)}%`, px + 6, py + 26);

    // Status Pill
    doc.setFontSize(7.5);
    if (isPassed) {
      doc.setFillColor(236, 253, 245);
      doc.roundedRect(px + 52, py + 16, 42, 8, 2, 2, 'F');
      doc.setTextColor(15, 169, 104);
      doc.text('MEMENUHI SYARAT', px + 73, py + 21.5, { align: 'center' });
    } else {
      doc.setFillColor(254, 242, 242);
      doc.roundedRect(px + 52, py + 16, 42, 8, 2, 2, 'F');
      doc.setTextColor(225, 6, 0);
      doc.text('DI BAWAH STANDAR', px + 73, py + 21.5, { align: 'center' });
    }

    // Bar
    doc.setFillColor(226, 232, 240);
    doc.roundedRect(px + 6, py + 32, 88, 4, 1.5, 1.5, 'F');
    doc.setFillColor(isPassed ? COLOR_GREEN[0] : COLOR_DANGER_RED[0], isPassed ? COLOR_GREEN[1] : COLOR_DANGER_RED[1], isPassed ? COLOR_GREEN[2] : COLOR_DANGER_RED[2]);
    const pw = Math.max(2, Math.min(88, (pct / 100) * 88));
    doc.roundedRect(px + 6, py + 32, pw, 4, 1.5, 1.5, 'F');

    // Counts info
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLOR_TEXT_MUTED);
    doc.text(`Total Personil: ${pos.manpower} | Standar: ${pos.ok} | Belum: ${pos.notOk}`, px + 6, py + 42);

    // Guidance note
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    const note = isPassed
      ? 'Kapasitas pengawasan memadai untuk memimpin rotasi dan troubleshooting lini mesin.'
      : 'Perlu program akselerasi mentoring teknis agar tidak menghambat operasional regu.';
    doc.text(note, px + 6, py + 49, { maxWidth: 88 });
  });

  drawSlideFooter(doc, 5, 6);

  // --- SLIDE 6: STRATEGIC ACTION PLANS & OFFICIAL SIGN-OFF ---
  doc.addPage([PPT_16_9_WIDTH, PPT_16_9_HEIGHT], 'landscape');
  drawSlideHeader(doc, 6, 6, 'ACTION PLAN & PENGESAHAN', 'Rencana Aksi Strategis Direksi & Lembar Pengesahan Resmi', periodeStr);

  // Left: 4 Strategic Action Plan Cards (W: 170mm)
  const actX = 14;
  const actY = 36;
  doc.setFillColor(...COLOR_CARD_BG);
  doc.roundedRect(actX, actY, 175, 140, 4, 4, 'F');
  doc.setDrawColor(...COLOR_BORDER);
  doc.roundedRect(actX, actY, 175, 140, 4, 4, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...COLOR_NAVY);
  doc.text('4 REKOMENDASI STRATEGIS & TINDAK LANJUT TOP MANAGEMENT', actX + 8, actY + 12);

  const actionPlansDetailed = [
    {
      no: '1',
      title: 'Program Refreshment Training 30 Hari Karyawan US',
      desc: `Mengikutsertakan ${totalUS} personil berstatus US ke dalam modul simulasi stasiun kerja krusial dengan didampingi mentor ahli dari seksi produksi terkait.`
    },
    {
      no: '2',
      title: 'Benchmarking & Cross-Department Best Practice Sharing',
      desc: `Mendorong departemen dengan performa tinggi (Green Zone) untuk membagikan modul pengajaran ke departemen yang masih berada di bawah target korporat 80.0%.`
    },
    {
      no: '3',
      title: 'Optimalisasi Simulator 92 Kompetensi Teknis Pabrik',
      desc: 'Meningkatkan alokasi jam terbang operator pada alat peraga teknis guna mengasah refleks penanganan kendala mesin tanpa mengganggu kapasitas produksi riil.'
    },
    {
      no: '4',
      title: 'Re-evaluasi Kesiapan & Verifikasi Mandiri Periode Q+1',
      desc: 'Melakukan audit kompetensi ulang pada akhir triwulan mendatang dengan target pencapaian minimal 85.0% MS untuk seluruh lini pabrik Mojokerto.'
    }
  ];

  actionPlansDetailed.forEach((ap, i) => {
    const apy = actY + 20 + i * 28;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(actX + 8, apy, 159, 24, 2, 2, 'F');
    doc.setDrawColor(...COLOR_BORDER);
    doc.roundedRect(actX + 8, apy, 159, 24, 2, 2, 'S');

    // Number Badge
    doc.setFillColor(...COLOR_NAVY);
    doc.roundedRect(actX + 12, apy + 4, 8, 8, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 215, 0);
    doc.text(ap.no, actX + 16, apy + 9.5, { align: 'center' });

    // Plan Title
    doc.setFontSize(9);
    doc.setTextColor(...COLOR_TEXT_DARK);
    doc.text(ap.title, actX + 24, apy + 9.5);

    // Plan Description
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLOR_TEXT_MUTED);
    doc.text(ap.desc, actX + 12, apy + 16, { maxWidth: 151, lineHeightFactor: 1.3 });
  });

  // Right: Official Sign-Off & Approvals Box (W: 125mm)
  const signX = 196;
  const signY = 36;
  doc.setFillColor(...COLOR_NAVY);
  doc.roundedRect(signX, signY, 128, 140, 4, 4, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 215, 0);
  doc.text('LEMBAR PENGESAHAN EKSEKUTIF', signX + 10, signY + 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(200, 215, 235);
  doc.text('Telah diperiksa dan disahkan untuk implementasi pabrik', signX + 10, signY + 20);

  // 3 Signature Blocks
  const approverList = [
    { role: 'Disusun Oleh (HR Specialist)', name: approvers?.preparedBy?.name || currentUser.name || 'Mahmud Nurdiansyah', title: approvers?.preparedBy?.title || currentUser.role || 'HR Development Specialist' },
    { role: 'Ditinjau Oleh (Dept Head HR & GA)', name: approvers?.reviewedBy?.name || 'Agus Sudarsono, S.T.', title: approvers?.reviewedBy?.title || 'Department Head HR & GA Factory' },
    { role: 'Disetujui Oleh (Factory GM)', name: approvers?.approvedBy?.name || 'Ir. Bambang Wijanarko, M.T.', title: approvers?.approvedBy?.title || 'Factory General Manager' }
  ];

  approverList.forEach((app, i) => {
    const sby = signY + 26 + i * 35;
    doc.setFillColor(255, 255, 255, 0.08);
    doc.roundedRect(signX + 8, sby, 112, 30, 2, 2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 215, 0);
    doc.text(app.role, signX + 12, sby + 7);

    // E-Sign badge
    doc.setFillColor(15, 169, 104);
    doc.roundedRect(signX + 80, sby + 3, 26, 6, 1.5, 1.5, 'F');
    doc.setFontSize(6);
    doc.setTextColor(255, 255, 255);
    doc.text('DIGITALLY SIGNED', signX + 93, sby + 7, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(app.name, signX + 12, sby + 19);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(200, 215, 235);
    doc.text(app.title, signX + 12, sby + 25);
  });

  drawSlideFooter(doc, 6, 6);

  const filename = `Presentasi_Direksi_PowerPoint_16x9_${periodeStr.replace(/\s+/g, '_')}.pdf`;
  return { doc, filename, pageCount: 6 };
}

/**
 * Capture an HTML element (or the slide deck) into a crisp 16:9 PNG Image
 */
export async function exportSlideElementAsImage(
  element: HTMLElement,
  filename: string,
  pixelRatio: number = 2
): Promise<string> {
  try {
    const dataUrl = await toPng(element, {
      pixelRatio: pixelRatio,
      cacheBust: true,
      backgroundColor: '#081220'
    });

    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    return dataUrl;
  } catch (err) {
    console.error('Failed to export slide as image:', err);
    throw err;
  }
}

/**
 * Copy an HTML element as PNG image directly to clipboard for pasting into PowerPoint / Slides
 */
export async function copySlideElementToClipboard(
  element: HTMLElement,
  pixelRatio: number = 2
): Promise<boolean> {
  try {
    const blob = await toBlob(element, {
      pixelRatio: pixelRatio,
      cacheBust: true,
      backgroundColor: '#081220'
    });

    if (!blob) throw new Error('Failed to generate image blob');

    if (navigator.clipboard && window.ClipboardItem) {
      const item = new ClipboardItem({ 'image/png': blob });
      await navigator.clipboard.write([item]);
      return true;
    } else {
      throw new Error('Clipboard API not supported');
    }
  } catch (err) {
    console.error('Failed to copy slide image to clipboard:', err);
    throw err;
  }
}
