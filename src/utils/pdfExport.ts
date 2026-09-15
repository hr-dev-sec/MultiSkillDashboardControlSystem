import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Employee, AppFiltersState, UserSession } from '../types';
import { BULAN_LABELS } from '../data/initialData';
import { computeDashboardStats } from './storage';
import { AJINOMOTO_LOGO_BASE64 } from './ajinomotoLogoData';

export interface PdfExportOptions {
  scope: 'filtered' | 'all';
  filteredEmployees: Employee[];
  allEmployees: Employee[];
  filters: AppFiltersState;
  currentUser: UserSession;
  reportType?: 'comprehensive' | 'executive' | 'employee_detail';
  orientation?: 'portrait' | 'landscape';
  includeEmployeeDetails?: boolean;
  includeCoverPage?: boolean;
  approvers?: {
    preparedBy?: { name: string; title: string };
    reviewedBy?: { name: string; title: string };
    approvedBy?: { name: string; title: string };
  };
}

export interface PdfExportResult {
  doc: jsPDF;
  filename: string;
  rowCount: number;
  pageCount: number;
}

// Brand Colors matching official corporate Ajinomoto standard
const COLOR_NAVY: [number, number, number] = [14, 35, 64];        // #0E2340
const COLOR_RED: [number, number, number] = [218, 41, 28];        // #DA291C (Ajinomoto Red)
const COLOR_GOLD: [number, number, number] = [184, 135, 75];      // #B8874B (Gold Accent)
const COLOR_GREEN: [number, number, number] = [15, 169, 104];     // #0FA968 (Standar MS)
const COLOR_DANGER_RED: [number, number, number] = [225, 6, 0];   // #E10600 (Belum Standar US)
const COLOR_TEXT_DARK: [number, number, number] = [15, 23, 42];   // #0F172A
const COLOR_TEXT_MUTED: [number, number, number] = [100, 116, 139];// #64748B
const COLOR_BORDER: [number, number, number] = [226, 232, 240];   // #E2E8F0
const COLOR_BG_ALT: [number, number, number] = [248, 250, 252];   // #F8FAFC
const COLOR_BG_US: [number, number, number] = [254, 242, 242];    // #FEF2F2 (Soft Red Highlight for US)

/**
 * Generate official, highly detailed, and informative PDF Report for PT Ajinomoto Indonesia - Mojokerto Factory.
 * Features:
 * - Executive Kop Banner Navy + Gold Accent Stripe with Ajinomoto Emblem & Timestamp
 * - 4 Key KPI Cards (Total Manpower, Memenuhi Standar MS, Belum Standar US, Persentase Pencapaian)
 * - Strategic Executive Insights Box (Rata-rata Skor, Top Performer, Dept Ketercapaian Tertinggi, Jumlah Gap US)
 * - Parameter Filter Terapan
 * - Rekapitulasi Lengkap Seluruh Divisi (dengan Rata-rata Skor & Status Ketercapaian)
 * - Rekapitulasi Lengkap Seluruh Department (dengan % Pencapaian & Defisit US)
 * - Rekapitulasi Standar per Job Position
 * - Rekapitulasi per Grade
 * - [CRITICAL DETAIL] Matriks Lengkap Seluruh Karyawan (No, NIK, Nama, Dept, Seksi, Jabatan, Grade, Periode, Skor, Standar, Gap, Status MS/US, PIC)
 * - [ACTION PLAN] Prioritas Pembinaan & Pelatihan Karyawan Belum Standar (US Focus List)
 * - Lembar Pengesahan Resmi Bertanda Tangan Elektronik (E-Sign Box)
 * - Running Corporate Header & Footers with "Halaman X / Y"
 */
export function generateMultiSkillReportPdf({
  scope,
  filteredEmployees,
  allEmployees,
  filters,
  currentUser,
  reportType = 'comprehensive',
  orientation = 'portrait',
  includeEmployeeDetails = true,
  includeCoverPage = true,
  approvers
}: PdfExportOptions): PdfExportResult {
  const targetData = scope === 'filtered' ? filteredEmployees : allEmployees;
  const isLandscape = orientation === 'landscape';

  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4',
    orientation: orientation
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = isLandscape ? 12 : 12;
  const contentWidth = pageWidth - marginX * 2;

  const now = new Date();
  const tanggalStr = now.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const jamStr = now.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit'
  }) + ' WIB';

  const signerName = approvers?.preparedBy?.name || currentUser.name || 'Mahmud Nurdiansyah';
  const signerRole = approvers?.preparedBy?.title || currentUser.role || 'HR Development Specialist';

  // Compute primary statistics
  const stats = computeDashboardStats(targetData);
  const { totalMS, totalUS, totalManpower, percentMS, byPosition, byGrade } = stats;
  const pctFormatted = (percentMS * 100).toFixed(1) + '%';

  // Compute deeper analytical insights
  let sumScores = 0;
  let maxScore = -1;
  let minScore = 999999;
  let topEmp: Employee | null = null;
  const deptMap: Record<string, { label: string; divisi: string; ms: number; us: number; totalScore: number; count: number }> = {};
  const divisiMap: Record<string, { label: string; ms: number; us: number; totalScore: number; count: number }> = {};

  targetData.forEach((emp) => {
    const sc = Number(emp.totalScore) || 0;
    sumScores += sc;
    if (sc > maxScore) {
      maxScore = sc;
      topEmp = emp;
    }
    if (sc < minScore) {
      minScore = sc;
    }

    // Divisi aggregate
    const divKey = emp.divisi || '(Tanpa Divisi)';
    if (!divisiMap[divKey]) {
      divisiMap[divKey] = { label: divKey, ms: 0, us: 0, totalScore: 0, count: 0 };
    }
    divisiMap[divKey].count++;
    divisiMap[divKey].totalScore += sc;
    if (emp.result === 'MS') divisiMap[divKey].ms++;
    else if (emp.result === 'US') divisiMap[divKey].us++;

    // Dept aggregate
    const deptKey = emp.department || '(Tanpa Department)';
    if (!deptMap[deptKey]) {
      deptMap[deptKey] = { label: deptKey, divisi: emp.divisi || '-', ms: 0, us: 0, totalScore: 0, count: 0 };
    }
    deptMap[deptKey].count++;
    deptMap[deptKey].totalScore += sc;
    if (emp.result === 'MS') deptMap[deptKey].ms++;
    else if (emp.result === 'US') deptMap[deptKey].us++;
  });

  const avgScore = targetData.length > 0 ? (sumScores / targetData.length).toFixed(1) : '0';
  const underStandardList = targetData
    .filter((e) => e.result === 'US' || (e.standard !== null && e.standard !== undefined && Number(e.totalScore) < Number(e.standard)))
    .sort((a, b) => {
      const gapA = (Number(a.totalScore) || 0) - (Number(a.standard) || 0);
      const gapB = (Number(b.totalScore) || 0) - (Number(b.standard) || 0);
      return gapA - gapB; // Largest deficit first
    });

  // Sort Divisi & Department by total manpower descending
  const sortedDivisi = Object.values(divisiMap).sort((a, b) => b.count - a.count);
  const sortedDept = Object.values(deptMap).sort((a, b) => b.count - a.count);

  // Identify top performing department
  let topDept = sortedDept.length > 0 ? sortedDept[0] : null;
  let highestDeptRate = -1;
  sortedDept.forEach((d) => {
    if (d.count >= 2) {
      const rate = d.ms / d.count;
      if (rate > highestDeptRate) {
        highestDeptRate = rate;
        topDept = d;
      }
    }
  });

  let y = 0;

  // =========================================================================
  // 0. LUXURY EXECUTIVE COVER PAGE (HALAMAN DEPAN LAPORAN)
  // =========================================================================
  const drawCoverPage = () => {
    // 1. Clean background canvas
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    // 2. Top Executive Corporate Banner (Deep Navy + Gold + Red accents)
    const topBannerHeight = isLandscape ? 38 : 46;
    doc.setFillColor(...COLOR_NAVY);
    doc.rect(0, 0, pageWidth, topBannerHeight, 'F');

    doc.setFillColor(...COLOR_GOLD);
    doc.rect(0, topBannerHeight, pageWidth, 1.8, 'F');

    doc.setFillColor(...COLOR_RED);
    doc.rect(0, topBannerHeight + 1.8, pageWidth, 1.2, 'F');

    // 3. Official Ajinomoto Logo badge inside top banner
    const coverLogoW = isLandscape ? 34 : 38;
    const coverLogoH = isLandscape ? 22 : 24;
    const coverLogoX = marginX;
    const coverLogoY = isLandscape ? 8 : 11;

    doc.setFillColor(255, 255, 255);
    doc.roundedRect(coverLogoX, coverLogoY, coverLogoW, coverLogoH, 1.5, 1.5, 'F');
    try {
      doc.addImage(
        AJINOMOTO_LOGO_BASE64,
        'PNG',
        coverLogoX + 1.5,
        coverLogoY + 1.2,
        coverLogoW - 3,
        coverLogoH - 2.4
      );
    } catch (_) {}

    // Corporate Title beside Logo
    const corpTextX = coverLogoX + coverLogoW + 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(isLandscape ? 8 : 9);
    doc.setTextColor(203, 213, 225);
    doc.text('Eat Well, Live Well.', corpTextX, isLandscape ? 15 : 18);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isLandscape ? 14 : 16);
    doc.setTextColor(255, 255, 255);
    doc.text('PT AJINOMOTO INDONESIA', corpTextX, isLandscape ? 22 : 26);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(isLandscape ? 8 : 9);
    doc.setTextColor(226, 232, 240);
    doc.text('PABRIK MOJOKERTO — HUMAN RESOURCES DEVELOPMENT', corpTextX, isLandscape ? 28 : 33);

    // Right Badge in Top Banner
    const badgeW = isLandscape ? 45 : 48;
    const badgeH = 7.5;
    const badgeX = pageWidth - marginX - badgeW;
    const badgeY = isLandscape ? 15 : 19;
    doc.setFillColor(...COLOR_GOLD);
    doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text('OFFICIAL HR AUDIT REPORT', badgeX + badgeW / 2, badgeY + 5, { align: 'center' });

    // 4. Document Classification & Category Tag
    let cy = topBannerHeight + (isLandscape ? 10 : 15);

    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.3);
    const tagW = isLandscape ? 110 : 125;
    doc.roundedRect(marginX, cy, tagW, 7, 1.2, 1.2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...COLOR_NAVY);
    doc.text('SISTEM MONITORING & KONTROL MULTI-SKILL OPERASIONAL PABRIK', marginX + 3.5, cy + 4.8);

    cy += isLandscape ? 12 : 16;

    // 5. Main Title & Subtitle
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isLandscape ? 18 : 22);
    doc.setTextColor(...COLOR_NAVY);
    doc.text('LAPORAN KOMPREHENSIF', marginX, cy);
    cy += isLandscape ? 7.5 : 9.5;

    doc.setTextColor(...COLOR_RED);
    doc.text('MONITORING & EVALUASI MULTI-SKILL', marginX, cy);
    cy += isLandscape ? 7 : 8.5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isLandscape ? 10 : 11);
    doc.setTextColor(...COLOR_TEXT_DARK);
    doc.text(
      reportType === 'employee_detail'
        ? 'Pemetaan Lengkap Matriks Evaluasi & Kesenjangan Kompetensi Per Individu Karyawan'
        : reportType === 'executive'
        ? 'Ringkasan Eksekutif Ketercapaian Standar Keahlian Organisasi & Analisis Jabatan'
        : 'Pemetaan Kompetensi Teknis, Analisis Kesenjangan (Gap Analysis) & Kebutuhan Pelatihan Kerja',
      marginX,
      cy
    );
    cy += isLandscape ? 5.5 : 6.5;

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(isLandscape ? 7.5 : 8.5);
    doc.setTextColor(...COLOR_TEXT_MUTED);
    doc.text(
      'Dokumen resmi pengendalian mutu sumber daya manusia dan kesiapan operasional seluruh lini kerja pabrik.',
      marginX,
      cy
    );
    cy += isLandscape ? 8 : 12;

    // Red & Gold Decorative Divider Bar
    doc.setFillColor(...COLOR_RED);
    doc.rect(marginX, cy, 35, 1.8, 'F');
    doc.setFillColor(...COLOR_GOLD);
    doc.rect(marginX + 37, cy, 15, 1.8, 'F');
    cy += isLandscape ? 7 : 10;

    // 6. Executive KPI Summary Box on Cover
    const kpiBoxH = isLandscape ? 26 : 30;
    doc.setFillColor(...COLOR_BG_ALT);
    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.3);
    doc.roundedRect(marginX, cy, contentWidth, kpiBoxH, 2, 2, 'FD');

    // Inside KPI Box: 4 items
    const kpiItemW = contentWidth / 4;
    const kpiItems = [
      { label: 'TOTAL MANPOWER', val: `${totalManpower}`, sub: 'Karyawan Aktif Terdata', color: COLOR_NAVY },
      { label: 'MEMENUHI STANDAR (MS)', val: `${totalMS}`, sub: `${pctFormatted} dari Total`, color: COLOR_GREEN },
      { label: 'BELUM STANDAR (US)', val: `${totalUS}`, sub: `${totalManpower > 0 ? ((totalUS / totalManpower) * 100).toFixed(1) : 0}% Perlu Pembinaan`, color: COLOR_DANGER_RED },
      { label: 'TARGET KELULUSAN', val: '80.0%', sub: percentMS >= 0.8 ? 'Target Tercapai' : 'Di Bawah Standar Target', color: COLOR_GOLD }
    ];

    kpiItems.forEach((item, idx) => {
      const ix = marginX + idx * kpiItemW;
      if (idx > 0) {
        doc.setDrawColor(...COLOR_BORDER);
        doc.setLineWidth(0.2);
        doc.line(ix, cy + 3, ix, cy + kpiBoxH - 3);
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(...COLOR_TEXT_MUTED);
      doc.text(item.label, ix + kpiItemW / 2, cy + 7, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(isLandscape ? 14 : 16);
      doc.setTextColor(...item.color);
      doc.text(item.val, ix + kpiItemW / 2, cy + (isLandscape ? 17 : 18.5), { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...COLOR_TEXT_MUTED);
      doc.text(item.sub, ix + kpiItemW / 2, cy + (isLandscape ? 22 : 24.5), { align: 'center' });
    });

    cy += kpiBoxH + (isLandscape ? 7 : 11);

    // 7. Scope & Metadata Card (2 Column Layout)
    const scopeCardH = isLandscape ? 38 : 46;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.3);
    doc.roundedRect(marginX, cy, contentWidth, scopeCardH, 2, 2, 'FD');

    // Left Column: Parameter & Scope
    const colW = (contentWidth - 10) / 2;
    const col1X = marginX + 4;
    const col2X = marginX + colW + 6;

    // Header Left Column
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLOR_NAVY);
    doc.text('PARAMETER & RUANG LINGKUP EVALUASI', col1X, cy + 6.5);
    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.2);
    doc.line(col1X, cy + 8.5, col1X + colW - 4, cy + 8.5);

    const blnFilterStr = filters.bulan && filters.bulan.length > 0
      ? filters.bulan.map((b) => BULAN_LABELS[Number(b) - 1] || b).join(', ')
      : 'Seluruh Periode (Jan - Des)';
    const thnFilterStr = filters.tahun && filters.tahun.length > 0
      ? filters.tahun.join(', ')
      : 'Semua Tahun Terdata';

    const paramRows = [
      ['Periode Evaluasi', `: ${blnFilterStr} ${thnFilterStr}`],
      ['Cakupan Divisi', `: ${sortedDivisi.length} Divisi (${filters.divisi.length ? filters.divisi.join(', ') : 'Seluruh Divisi Pabrik'})`],
      ['Cakupan Departemen', `: ${sortedDept.length} Departemen Terverifikasi`],
      ['Standar Kompetensi', ': 92 Standar Kompetensi Teknis Operasional'],
      ['Lampiran Detail Karyawan', `: ${includeEmployeeDetails ? 'Disertakan Lengkap (' + targetData.length + ' Karyawan)' : 'Dilewati (Format Ringkasan & Rekapitulasi)'}`]
    ];

    let rowY = cy + 13.5;
    paramRows.forEach(([lbl, val]) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(...COLOR_TEXT_MUTED);
      doc.text(lbl, col1X, rowY);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...COLOR_TEXT_DARK);
      const truncatedVal = doc.splitTextToSize(val, colW - 38);
      doc.text(truncatedVal[0] || val, col1X + 35, rowY);
      rowY += isLandscape ? 5 : 5.8;
    });

    // Vertical Divider between columns
    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.2);
    doc.line(col2X - 3, cy + 4, col2X - 3, cy + scopeCardH - 4);

    // Right Column: Official Authorization & Verification
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLOR_NAVY);
    doc.text('PENGESAHAN & KLASIFIKASI DOKUMEN', col2X, cy + 6.5);
    doc.line(col2X, cy + 8.5, col2X + colW - 4, cy + 8.5);

    const authRows = [
      ['Disusun / Diajukan Oleh', `: ${signerName}`],
      ['Jabatan / Role', `: ${signerRole}`],
      ['Tanggal Terbit Dokumen', `: ${tanggalStr}, ${jamStr}`],
      ['Status Validasi', ': TERVERIFIKASI & TERCATAT RESMI (DIGITALLY SIGNED)'],
      ['Klasifikasi Dokumen', ': STRICTLY CONFIDENTIAL — INTERNAL PT AJINOMOTO INDONESIA']
    ];

    let authY = cy + 13.5;
    authRows.forEach(([lbl, val]) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(...COLOR_TEXT_MUTED);
      doc.text(lbl, col2X, authY);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      if (lbl === 'Status Validasi') {
        doc.setTextColor(...COLOR_GREEN);
      } else if (lbl === 'Klasifikasi Dokumen') {
        doc.setTextColor(...COLOR_RED);
      } else {
        doc.setTextColor(...COLOR_TEXT_DARK);
      }
      const truncatedVal = doc.splitTextToSize(val, colW - 40);
      doc.text(truncatedVal[0] || val, col2X + 36, authY);
      authY += isLandscape ? 5 : 5.8;
    });

    // 8. Bottom Corporate Band on Cover
    const bottomBarH = isLandscape ? 12 : 14;
    const bottomBarY = pageHeight - bottomBarH;

    doc.setFillColor(...COLOR_GOLD);
    doc.rect(0, bottomBarY - 1.2, pageWidth, 1.2, 'F');

    doc.setFillColor(...COLOR_NAVY);
    doc.rect(0, bottomBarY, pageWidth, bottomBarH, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(203, 213, 225);
    doc.text(
      'PT AJINOMOTO INDONESIA — MOJOKERTO FACTORY | JL. RAYA MLIRIP KM 44, JETIS, MOJOKERTO 61352',
      pageWidth / 2,
      bottomBarY + (isLandscape ? 5.5 : 6.5),
      { align: 'center' }
    );
    doc.setFontSize(5.8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      'Hak Cipta © PT Ajinomoto Indonesia. Dokumen resmi operasional untuk evaluasi dan pengembangan kompetensi karyawan.',
      pageWidth / 2,
      bottomBarY + (isLandscape ? 9 : 10.5),
      { align: 'center' }
    );
  };

  // =========================================================================
  // 1. CORPORATE HEADER (PAGE 1)
  // =========================================================================
  const drawHeader = () => {
    const headerHeight = isLandscape ? 20 : 22;
    // Dark Navy Background
    doc.setFillColor(...COLOR_NAVY);
    doc.rect(0, 0, pageWidth, headerHeight, 'F');

    // Bottom Gold Accent Stripe
    doc.setFillColor(...COLOR_GOLD);
    doc.rect(0, headerHeight, pageWidth, 1.2, 'F');

    // Logo on Left side: Ajinomoto Official Logo inside crisp white rounded badge
    const logoBadgeW = isLandscape ? 22 : 24;
    const logoBadgeH = isLandscape ? 15 : 16;
    const logoX = marginX;
    const logoY = isLandscape ? 2.5 : 3;

    // Clean white rounded badge for high-contrast crisp display
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(logoX, logoY, logoBadgeW, logoBadgeH, 1.2, 1.2, 'F');

    try {
      doc.addImage(
        AJINOMOTO_LOGO_BASE64,
        'PNG',
        logoX + 1.2,
        logoY + 1,
        logoBadgeW - 2.4,
        logoBadgeH - 2
      );
    } catch (_) {}

    // Title Text next to logo
    const titleX = logoX + logoBadgeW + 3.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isLandscape ? 12 : 13);
    doc.setTextColor(255, 255, 255);
    doc.text('AJINOMOTO MOJOKERTO FACTORY', titleX, isLandscape ? 8.5 : 9.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(isLandscape ? 8 : 8.5);
    doc.setTextColor(226, 232, 240);
    const subtitleReport = reportType === 'employee_detail'
      ? 'Laporan Detail Evaluasi & Analisis Gap Multi-Skill Karyawan'
      : reportType === 'executive'
      ? 'Laporan Ringkasan Eksekutif Kinerja Multi-Skill Organisasi'
      : 'Laporan Komprehensif Monitoring & Evaluasi Multi-Skill Karyawan';
    doc.text(subtitleReport, titleX, isLandscape ? 14 : 15.5);

    // Right Metadata: Generation Date & Signer
    const metaX = pageWidth - marginX;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(203, 213, 225);
    doc.text(`Dicetak: ${tanggalStr}, ${jamStr}`, metaX, isLandscape ? 8.5 : 9.5, { align: 'right' });
    doc.text(`Oleh: ${signerName} (${signerRole})`, metaX, isLandscape ? 14 : 15.5, { align: 'right' });

    y = headerHeight + 5.5;
  };

  // =========================================================================
  // 2. KPI STAT CARDS (4 CARDS)
  // =========================================================================
  const drawKpiCards = () => {
    const cardCount = 4;
    const gap = 3.5;
    const cardW = (contentWidth - gap * (cardCount - 1)) / cardCount;
    const cardH = 13.5;

    const cards = [
      { val: String(totalManpower), label: 'Total Manpower', sub: `${targetData.length} Data Dievaluasi`, color: COLOR_NAVY },
      { val: String(totalMS), label: 'Standar (MS)', sub: `${pctFormatted} Memenuhi Standar`, color: COLOR_GREEN },
      { val: String(totalUS), label: 'Belum Standar (US)', sub: `${totalManpower > 0 ? ((totalUS / totalManpower) * 100).toFixed(1) : 0}% Perlu Pembinaan`, color: COLOR_DANGER_RED },
      { val: pctFormatted, label: 'Pencapaian Mutu', sub: `Target Pabrik: ≥80%`, color: COLOR_GOLD }
    ];

    cards.forEach((c, i) => {
      const cx = marginX + i * (cardW + gap);
      
      // Card White Box with Border
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(...COLOR_BORDER);
      doc.setLineWidth(0.25);
      doc.roundedRect(cx, y, cardW, cardH, 1.2, 1.2, 'FD');

      // Left Accent Color Bar
      doc.setFillColor(...c.color);
      doc.roundedRect(cx, y, 1.8, cardH, 0.8, 0.8, 'F');

      // Value (Big Bold)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(...COLOR_TEXT_DARK);
      doc.text(c.val, cx + 4.5, y + 5.8);

      // Label (Small Bold)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor(...COLOR_TEXT_DARK);
      doc.text(c.label, cx + 4.5, y + 9.5);

      // Subtitle (Micro Muted)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.5);
      doc.setTextColor(...COLOR_TEXT_MUTED);
      doc.text(c.sub, cx + 4.5, y + 12.3);
    });

    y += cardH + 4;
  };

  // =========================================================================
  // 3. EXECUTIVE ANALYTICAL HIGHLIGHTS BOX & FILTER BAR
  // =========================================================================
  const drawAnalyticalHighlightsAndFilter = () => {
    // Strategic Highlights Banner Box
    const boxH = 9.5;
    doc.setFillColor(...COLOR_BG_ALT);
    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.2);
    doc.roundedRect(marginX, y, contentWidth, boxH, 1, 1, 'FD');

    // Left Accent bar
    doc.setFillColor(...COLOR_GOLD);
    doc.rect(marginX, y, 1.2, boxH, 'F');

    // 4 Key Analytics Columns inside Box
    const colW = contentWidth / 4;
    const topEmpName = topEmp ? (topEmp.empName?.length > 15 ? topEmp.empName.slice(0, 15) + '..' : topEmp.empName) : '-';
    const topDeptName = topDept ? (topDept.label?.length > 16 ? topDept.label.slice(0, 16) + '..' : topDept.label) : '-';

    const highlights = [
      { label: 'RATA-RATA SKOR', val: `${avgScore} Poin` },
      { label: 'SKOR TERTINGGI', val: `${maxScore >= 0 ? maxScore : 0} (${topEmpName})` },
      { label: 'DEPT TERBAIK', val: `${topDeptName} (${highestDeptRate >= 0 ? (highestDeptRate * 100).toFixed(0) + '%' : '-'})` },
      { label: 'KEBUTUHAN TRAINING', val: `${underStandardList.length} Karyawan (US)` }
    ];

    highlights.forEach((h, i) => {
      const hx = marginX + i * colW + 4;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.setTextColor(...COLOR_GOLD);
      doc.text(h.label, hx, y + 3.8);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor(...COLOR_TEXT_DARK);
      doc.text(h.val, hx, y + 7.5);
    });

    y += boxH + 3.5;

    // Filter Parameters String
    const uniqueTahun = Array.from(new Set(targetData.map((e) => e.tahun).filter(Boolean)));
    const uniqueBulan = Array.from(new Set(targetData.map((e) => e.bulan).filter(Boolean)));

    const thnStr = filters.tahun.length
      ? filters.tahun.join(', ')
      : (uniqueTahun.length ? uniqueTahun.join(', ') : 'Semua Tahun');

    const blnStr = filters.bulan.length
      ? filters.bulan.map((b) => BULAN_LABELS[Number(b) - 1] || b).join(', ')
      : (uniqueBulan.length ? uniqueBulan.map((b) => BULAN_LABELS[Number(b) - 1] || b).join(', ') : 'Semua Periode');

    const divStr = filters.divisi.length ? filters.divisi.join(', ') : 'Semua Divisi';
    const deptStr = filters.department.length ? filters.department.join(', ') : 'Semua Department';
    const jabStr = filters.jabatan.length ? filters.jabatan.join(', ') : 'Semua Jabatan';

    const filterText = `Parameter: Periode ${blnStr} ${thnStr} | Divisi: ${divStr} | Department: ${deptStr} | Jabatan: ${jabStr} | Total Cakupan: ${targetData.length} Karyawan`;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(...COLOR_TEXT_MUTED);
    doc.text(filterText, marginX, y);

    y += 4.5;
  };

  // =========================================================================
  // SECTION HEADING HELPER
  // =========================================================================
  const drawSectionHeading = (title: string, badgeText?: string) => {
    if (y > pageHeight - 35) {
      doc.addPage();
      y = 16;
    }

    // Gold Square
    doc.setFillColor(...COLOR_GOLD);
    doc.rect(marginX, y - 2.8, 2.5, 2.5, 'F');

    // Title Text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...COLOR_TEXT_DARK);
    doc.text(title, marginX + 4.2, y - 0.7);

    if (badgeText) {
      const titleWidth = doc.getTextWidth(title);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.2);
      doc.setTextColor(...COLOR_TEXT_MUTED);
      doc.text(`(${badgeText})`, marginX + 5 + titleWidth, y - 0.7);
    }

    y += 2.5;
  };

  // =========================================================================
  // 4. REKAPITULASI LENGKAP PER DIVISI (ALL DIVISIONS WITH METRICS)
  // =========================================================================
  const drawDivisiTable = () => {
    drawSectionHeading('Rekapitulasi Kinerja per Divisi', `${sortedDivisi.length} Divisi Aktif`);

    const divisiRows = sortedDivisi.map((d) => {
      const tot = d.ms + d.us;
      const pct = tot > 0 ? ((d.ms / tot) * 100).toFixed(1) + '%' : '0.0%';
      const avgSc = d.count > 0 ? (d.totalScore / d.count).toFixed(1) : '0';
      const status = (d.ms / (tot || 1)) >= 0.8 ? 'Tercapai (≥80%)' : 'Perlu Peningkatan';
      return [d.label, String(tot), String(d.ms), String(d.us), pct, avgSc, status];
    });

    // Baris Total Akumulasi
    divisiRows.push([
      'TOTAL PABRIK',
      String(totalManpower),
      String(totalMS),
      String(totalUS),
      pctFormatted,
      avgScore,
      percentMS >= 0.8 ? 'Tercapai' : 'Di Bawah Target'
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Nama Divisi', 'Total MP', 'MS', 'US', '% Pencapaian', 'Rata-rata Skor', 'Status Evaluasi']],
      body: divisiRows,
      theme: 'plain',
      headStyles: {
        fillColor: COLOR_NAVY,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 6.8,
        cellPadding: { top: 1.6, bottom: 1.6, left: 2.5, right: 2.5 }
      },
      columnStyles: {
        0: { halign: 'left', cellWidth: contentWidth * 0.34, fontStyle: 'bold' },
        1: { halign: 'center', cellWidth: contentWidth * 0.10 },
        2: { halign: 'center', cellWidth: contentWidth * 0.09, textColor: COLOR_GREEN },
        3: { halign: 'center', cellWidth: contentWidth * 0.09, textColor: COLOR_DANGER_RED },
        4: { halign: 'center', cellWidth: contentWidth * 0.13, fontStyle: 'bold' },
        5: { halign: 'center', cellWidth: contentWidth * 0.11 },
        6: { halign: 'center', cellWidth: contentWidth * 0.14 }
      },
      bodyStyles: {
        fontSize: 6.5,
        textColor: COLOR_TEXT_DARK,
        cellPadding: { top: 1.3, bottom: 1.3, left: 2.5, right: 2.5 }
      },
      alternateRowStyles: {
        fillColor: COLOR_BG_ALT
      },
      didParseCell: (data) => {
        // Bold the summary row
        if (data.row.index === divisiRows.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [241, 245, 249];
          data.cell.styles.textColor = COLOR_NAVY;
        }
      },
      margin: { left: marginX, right: marginX, top: 14, bottom: 15 }
    });

    y = ((doc as any).lastAutoTable?.finalY ?? y) + 5.5;
  };

  // =========================================================================
  // 5. REKAPITULASI LENGKAP PER DEPARTMENT (ALL DEPARTMENTS WITHOUT TRUNCATION)
  // =========================================================================
  const drawDepartmentTable = () => {
    drawSectionHeading('Rekapitulasi Kinerja per Department', `${sortedDept.length} Department`);

    const deptRows = sortedDept.map((d) => {
      const tot = d.ms + d.us;
      const pct = tot > 0 ? ((d.ms / tot) * 100).toFixed(1) + '%' : '0.0%';
      const avgSc = d.count > 0 ? (d.totalScore / d.count).toFixed(1) : '0';
      const gapUs = d.us > 0 ? `${d.us} Orang (US)` : 'Sesuai Target';
      return [d.label, d.divisi, String(tot), String(d.ms), String(d.us), pct, avgSc, gapUs];
    });

    // Baris Total
    deptRows.push([
      'TOTAL KESELURUHAN',
      '-',
      String(totalManpower),
      String(totalMS),
      String(totalUS),
      pctFormatted,
      avgScore,
      `${totalUS} Karyawan US`
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Department', 'Divisi', 'Total MP', 'MS', 'US', '% Pencapaian', 'Rata-rata Skor', 'Defisit Pelatihan']],
      body: deptRows,
      theme: 'plain',
      headStyles: {
        fillColor: COLOR_NAVY,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 6.8,
        cellPadding: { top: 1.6, bottom: 1.6, left: 2.2, right: 2.2 }
      },
      columnStyles: {
        0: { halign: 'left', cellWidth: contentWidth * 0.28, fontStyle: 'bold' },
        1: { halign: 'left', cellWidth: contentWidth * 0.18 },
        2: { halign: 'center', cellWidth: contentWidth * 0.08 },
        3: { halign: 'center', cellWidth: contentWidth * 0.07, textColor: COLOR_GREEN },
        4: { halign: 'center', cellWidth: contentWidth * 0.07, textColor: COLOR_DANGER_RED },
        5: { halign: 'center', cellWidth: contentWidth * 0.11, fontStyle: 'bold' },
        6: { halign: 'center', cellWidth: contentWidth * 0.09 },
        7: { halign: 'center', cellWidth: contentWidth * 0.12 }
      },
      bodyStyles: {
        fontSize: 6.3,
        textColor: COLOR_TEXT_DARK,
        cellPadding: { top: 1.2, bottom: 1.2, left: 2.2, right: 2.2 }
      },
      alternateRowStyles: {
        fillColor: COLOR_BG_ALT
      },
      pageBreak: 'auto',
      didParseCell: (data) => {
        if (data.row.index === deptRows.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [241, 245, 249];
          data.cell.styles.textColor = COLOR_NAVY;
        }
      },
      margin: { left: marginX, right: marginX, top: 14, bottom: 15 }
    });

    y = ((doc as any).lastAutoTable?.finalY ?? y) + 5.5;
  };

  // =========================================================================
  // 6. REKAPITULASI PER JOB POSITION & STANDAR THRESHOLD
  // =========================================================================
  const drawJobPositionTable = () => {
    drawSectionHeading('Rekapitulasi Standar per Kategori Jabatan', 'Threshold Kompetensi');

    const posRows = (byPosition || []).map((p) => {
      const targetPercentStr = ((p?.target ?? 0) * 100).toFixed(0) + '%';
      const realisasiPercentStr = ((p?.resultPercent ?? 0) * 100).toFixed(1) + '%';
      const isTargetMet = (p?.resultPercent ?? 0) >= (p?.target ?? 0);
      return [
        p?.label || '',
        `≥ ${p?.threshold ?? 0} Seksi`,
        targetPercentStr,
        String(p?.manpower ?? 0),
        String(p?.ok ?? 0),
        String(p?.notOk ?? 0),
        realisasiPercentStr,
        isTargetMet ? 'Tercapai' : 'Di Bawah Target'
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [['Kategori Jabatan', 'Standar Threshold', 'Target (%)', 'Manpower', 'OK (MS)', 'Not OK (US)', 'Realisasi (%)', 'Status Target']],
      body: posRows,
      theme: 'plain',
      headStyles: {
        fillColor: COLOR_NAVY,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 6.8,
        cellPadding: { top: 1.6, bottom: 1.6, left: 2.2, right: 2.2 }
      },
      columnStyles: {
        0: { halign: 'left', cellWidth: contentWidth * 0.26, fontStyle: 'bold' },
        1: { halign: 'center', cellWidth: contentWidth * 0.12 },
        2: { halign: 'center', cellWidth: contentWidth * 0.10 },
        3: { halign: 'center', cellWidth: contentWidth * 0.10 },
        4: { halign: 'center', cellWidth: contentWidth * 0.10, textColor: COLOR_GREEN },
        5: { halign: 'center', cellWidth: contentWidth * 0.10, textColor: COLOR_DANGER_RED },
        6: { halign: 'center', cellWidth: contentWidth * 0.11, fontStyle: 'bold' },
        7: { halign: 'center', cellWidth: contentWidth * 0.11 }
      },
      bodyStyles: {
        fontSize: 6.4,
        textColor: COLOR_TEXT_DARK,
        cellPadding: { top: 1.3, bottom: 1.3, left: 2.2, right: 2.2 }
      },
      alternateRowStyles: {
        fillColor: COLOR_BG_ALT
      },
      margin: { left: marginX, right: marginX, top: 14, bottom: 15 }
    });

    y = ((doc as any).lastAutoTable?.finalY ?? y) + 5.5;
  };

  // =========================================================================
  // 7. REKAPITULASI PER GRADE
  // =========================================================================
  const drawGradeTable = () => {
    drawSectionHeading('Rekapitulasi Sebaran Grade Karyawan', `${byGrade.length} Grade`);

    const gradeRows = byGrade.map((gr) => {
      const tot = gr.ms + gr.us;
      const pct = tot > 0 ? ((gr.ms / tot) * 100).toFixed(1) + '%' : '0.0%';
      return [gr.label, String(tot), String(gr.ms), String(gr.us), pct];
    });

    autoTable(doc, {
      startY: y,
      head: [['Grade Karyawan', 'Total Manpower', 'MS (Standar)', 'US (Belum Standar)', '% Ketercapaian']],
      body: gradeRows,
      theme: 'plain',
      headStyles: {
        fillColor: COLOR_NAVY,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 6.8,
        cellPadding: { top: 1.6, bottom: 1.6, left: 2.5, right: 2.5 }
      },
      columnStyles: {
        0: { halign: 'left', cellWidth: contentWidth * 0.36, fontStyle: 'bold' },
        1: { halign: 'center', cellWidth: contentWidth * 0.16 },
        2: { halign: 'center', cellWidth: contentWidth * 0.16, textColor: COLOR_GREEN },
        3: { halign: 'center', cellWidth: contentWidth * 0.16, textColor: COLOR_DANGER_RED },
        4: { halign: 'center', cellWidth: contentWidth * 0.16, fontStyle: 'bold' }
      },
      bodyStyles: {
        fontSize: 6.4,
        textColor: COLOR_TEXT_DARK,
        cellPadding: { top: 1.2, bottom: 1.2, left: 2.5, right: 2.5 }
      },
      alternateRowStyles: {
        fillColor: COLOR_BG_ALT
      },
      margin: { left: marginX, right: marginX, top: 14, bottom: 15 }
    });

    y = ((doc as any).lastAutoTable?.finalY ?? y) + 6;
  };

  // =========================================================================
  // 8. CRITICAL: DAFTAR DETAIL EVALUASI SELURUH KARYAWAN (FULL ROSTER)
  // =========================================================================
  const drawEmployeeRosterTable = () => {
    // Check if new page is needed for starting employee detail section cleanly
    if (y > pageHeight - 45) {
      doc.addPage();
      y = 16;
    }

    drawSectionHeading('Daftar Detail Evaluasi Multi-Skill Seluruh Karyawan', `${targetData.length} Karyawan Terdaftar`);

    const rosterRows = targetData.map((emp, idx) => {
      const bLabel = emp.bulan ? BULAN_LABELS[emp.bulan - 1] || String(emp.bulan) : '-';
      const score = Number(emp.totalScore) || 0;
      const std = emp.standard !== null && emp.standard !== undefined ? Number(emp.standard) : null;
      const gapVal = std !== null ? score - std : (emp.gap !== null && emp.gap !== undefined ? Number(emp.gap) : 0);
      const gapStr = gapVal > 0 ? `+${gapVal}` : String(gapVal);
      const periode = `${bLabel.slice(0, 3)} ${emp.tahun || ''}`.trim();

      return [
        String(idx + 1),
        emp.empId || `EMP-${idx + 1}`,
        emp.empName || '-',
        emp.department || emp.divisi || '-',
        emp.section || '-',
        emp.jabatan || '-',
        emp.grade || '-',
        periode,
        String(score),
        std !== null ? String(std) : '-',
        gapStr,
        emp.result || (score >= (std || 0) ? 'MS' : 'US'),
        emp.pic || '-'
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [['No', 'NIK', 'Nama Karyawan', 'Department', 'Seksi', 'Jabatan', 'Grade', 'Periode', 'Skor', 'Std', 'Gap', 'Status', 'PIC']],
      body: rosterRows,
      theme: 'plain',
      showHead: 'everyPage',
      headStyles: {
        fillColor: COLOR_NAVY,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 6.2,
        cellPadding: { top: 1.5, bottom: 1.5, left: 1.8, right: 1.8 }
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: contentWidth * 0.035 },
        1: { halign: 'left', fontStyle: 'bold', cellWidth: contentWidth * 0.085 },
        2: { halign: 'left', fontStyle: 'bold', cellWidth: contentWidth * 0.16 },
        3: { halign: 'left', cellWidth: contentWidth * 0.12 },
        4: { halign: 'left', cellWidth: contentWidth * 0.10 },
        5: { halign: 'left', cellWidth: contentWidth * 0.12 },
        6: { halign: 'center', cellWidth: contentWidth * 0.055 },
        7: { halign: 'center', cellWidth: contentWidth * 0.065 },
        8: { halign: 'center', fontStyle: 'bold', cellWidth: contentWidth * 0.05 },
        9: { halign: 'center', cellWidth: contentWidth * 0.05 },
        10: { halign: 'center', fontStyle: 'bold', cellWidth: contentWidth * 0.05 },
        11: { halign: 'center', fontStyle: 'bold', cellWidth: contentWidth * 0.055 },
        12: { halign: 'left', cellWidth: contentWidth * 0.06 }
      },
      bodyStyles: {
        fontSize: 5.8,
        textColor: COLOR_TEXT_DARK,
        cellPadding: { top: 1.2, bottom: 1.2, left: 1.8, right: 1.8 }
      },
      alternateRowStyles: {
        fillColor: COLOR_BG_ALT
      },
      didParseCell: (data) => {
        // Highlight US rows with soft red background and red text
        if (data.section === 'body') {
          const rawRow = rosterRows[data.row.index];
          const statusVal = rawRow ? rawRow[11] : '';
          if (statusVal === 'US') {
            if (data.column.index === 11) {
              data.cell.styles.textColor = COLOR_DANGER_RED;
            } else if (data.column.index === 10) {
              data.cell.styles.textColor = COLOR_DANGER_RED;
            }
          } else if (statusVal === 'MS' && data.column.index === 11) {
            data.cell.styles.textColor = COLOR_GREEN;
          }
        }
      },
      pageBreak: 'auto',
      margin: { left: marginX, right: marginX, top: 14, bottom: 15 }
    });

    y = ((doc as any).lastAutoTable?.finalY ?? y) + 6;
  };

  // =========================================================================
  // 9. ACTION PLAN: DAFTAR PRIORITAS PEMBINAAN KARYAWAN BELUM STANDAR (US)
  // =========================================================================
  const drawActionPlanUnderStandardTable = () => {
    if (underStandardList.length === 0) {
      // If 100% MS, print a recognition achievement box
      if (y > pageHeight - 30) {
        doc.addPage();
        y = 16;
      }
      drawSectionHeading('Analisis Kebutuhan Pelatihan & Pembinaan Karyawan (US)');
      doc.setFillColor(240, 253, 244);
      doc.setDrawColor(187, 247, 208);
      doc.roundedRect(marginX, y, contentWidth, 12, 1.2, 1.2, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(22, 101, 52);
      doc.text('✓ Seluruh Karyawan Telah Memenuhi Standar Kompetensi Multi-Skill (100% MS)', marginX + 5, y + 5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(21, 128, 61);
      doc.text('Tidak ditemukan karyawan berstatus Belum Standar (US) pada filter periode ini. Pertahankan program pemeliharaan kompetensi berkelanjutan.', marginX + 5, y + 9);
      y += 18;
      return;
    }

    if (y > pageHeight - 40) {
      doc.addPage();
      y = 16;
    }

    drawSectionHeading('Prioritas Pembinaan & Pelatihan Karyawan Belum Standar (US)', `${underStandardList.length} Karyawan Memerlukan Coaching`);

    const usRows = underStandardList.map((emp, idx) => {
      const score = Number(emp.totalScore) || 0;
      const std = emp.standard !== null && emp.standard !== undefined ? Number(emp.standard) : 0;
      const gapVal = score - std;
      const rec = Math.abs(gapVal) >= 10
        ? 'Pelatihan Intensif Multi-Skill & Re-evaluasi 30 Hari'
        : 'Pendampingan On-the-Job Training (OJT) & Coaching PIC';

      return [
        String(idx + 1),
        emp.empId || '-',
        emp.empName || '-',
        emp.department || '-',
        emp.section || '-',
        emp.jabatan || '-',
        emp.grade || '-',
        String(score),
        String(std),
        String(gapVal),
        rec,
        emp.pic || '-'
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [['No', 'NIK', 'Nama Karyawan', 'Department', 'Seksi', 'Jabatan', 'Grade', 'Skor', 'Target', 'Defisit', 'Rekomendasi Tindak Lanjut HR / Dept', 'PIC']],
      body: usRows,
      theme: 'plain',
      showHead: 'everyPage',
      headStyles: {
        fillColor: [185, 28, 28], // Dark Red for action plan header
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 6.2,
        cellPadding: { top: 1.5, bottom: 1.5, left: 1.8, right: 1.8 }
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: contentWidth * 0.035 },
        1: { halign: 'left', fontStyle: 'bold', cellWidth: contentWidth * 0.085 },
        2: { halign: 'left', fontStyle: 'bold', cellWidth: contentWidth * 0.16 },
        3: { halign: 'left', cellWidth: contentWidth * 0.12 },
        4: { halign: 'left', cellWidth: contentWidth * 0.10 },
        5: { halign: 'left', cellWidth: contentWidth * 0.11 },
        6: { halign: 'center', cellWidth: contentWidth * 0.05 },
        7: { halign: 'center', fontStyle: 'bold', cellWidth: contentWidth * 0.05 },
        8: { halign: 'center', cellWidth: contentWidth * 0.05 },
        9: { halign: 'center', fontStyle: 'bold', cellWidth: contentWidth * 0.055, textColor: COLOR_DANGER_RED },
        10: { halign: 'left', cellWidth: contentWidth * 0.125, fontStyle: 'italic' },
        11: { halign: 'left', cellWidth: contentWidth * 0.06 }
      },
      bodyStyles: {
        fontSize: 5.8,
        textColor: COLOR_TEXT_DARK,
        cellPadding: { top: 1.2, bottom: 1.2, left: 1.8, right: 1.8 }
      },
      alternateRowStyles: {
        fillColor: COLOR_BG_US
      },
      pageBreak: 'auto',
      margin: { left: marginX, right: marginX, top: 14, bottom: 15 }
    });

    y = ((doc as any).lastAutoTable?.finalY ?? y) + 6;
  };

  // =========================================================================
  // 10. ELECTRONIC SIGN-OFF & APPROVAL BLOCK (OFFICIAL HR CERTIFICATION)
  // =========================================================================
  const drawSignaturesBlock = () => {
    const boxW = isLandscape ? 62 : 58;
    const boxH = 26;
    const signAreaHeight = boxH + 24;

    // Check if enough room exists on current page; if not, add clean sign-off page
    if (y > pageHeight - signAreaHeight) {
      doc.addPage();
      y = 18;
    }

    // Divider line above signatures
    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.3);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 4.5;

    const signX = pageWidth - marginX - boxW;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    doc.text(`Mojokerto, ${tanggalStr}`, signX, y);
    y += 4;

    doc.text('Mengetahui & Menyetujui,', signX, y);
    y += 3.8;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...COLOR_NAVY);
    doc.text('HR & Factory Management', signX, y);
    y += 2.5;

    // Dashed Gold Border Box
    doc.setDrawColor(...COLOR_GOLD);
    doc.setLineWidth(0.35);
    if (typeof (doc as any).setLineDashPattern === 'function') {
      (doc as any).setLineDashPattern([1.5, 1.2], 0);
    }
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(signX, y, boxW, boxH, 2, 2, 'FD');
    if (typeof (doc as any).setLineDashPattern === 'function') {
      (doc as any).setLineDashPattern([], 0); // reset line dash
    }

    // Inside E-Sign Box
    const iconX = signX + 7;
    const iconY = y + 7.5;

    // Gold Circle Badge
    doc.setFillColor(...COLOR_GOLD);
    doc.circle(iconX, iconY, 3.2, 'F');
    // White checkmark inside circle
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('✓', iconX, iconY + 1, { align: 'center' });

    // "E-SIGNED" Text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...COLOR_GOLD);
    doc.text('E-SIGNED & VERIFIED', iconX + 6, iconY + 0.8);

    // Subtext inside box
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(...COLOR_TEXT_MUTED);
    doc.text('Sistem Monitoring Multi-Skill', iconX - 3, iconY + 6.2);
    doc.text(tanggalStr, iconX - 3, iconY + 10.2);
    doc.text(jamStr, iconX - 3, iconY + 14.2);

    y += boxH + 4;

    // Signer Name & Role below box
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...COLOR_TEXT_DARK);
    doc.text(`( ${signerName} )`, signX, y);
    y += 3.8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLOR_TEXT_MUTED);
    doc.text(signerRole, signX, y);
  };

  // =========================================================================
  // EXECUTE GENERATION SEQUENCE ACCORDING TO REPORT TYPE
  // =========================================================================
  const hasCover = includeCoverPage !== false;

  // 1. Executive Cover Page (if selected)
  if (hasCover) {
    drawCoverPage();
    doc.addPage();
  }

  // 2. First Report Body Page Header & Primary KPIs
  drawHeader();
  drawKpiCards();
  drawAnalyticalHighlightsAndFilter();

  if (reportType === 'comprehensive') {
    // COMPREHENSIVE REPORT:
    // Page 1: Divisi & Department Breakdown
    drawDivisiTable();
    drawDepartmentTable();
    drawJobPositionTable();
    drawGradeTable();

    // Critical: Complete Employee Roster (controlled by includeEmployeeDetails)
    if (includeEmployeeDetails !== false) {
      drawEmployeeRosterTable();
    }

    // Action Plan: Prioritas Pembinaan Karyawan Belum Standar
    drawActionPlanUnderStandardTable();

    // Signature Block at conclusion
    drawSignaturesBlock();

  } else if (reportType === 'employee_detail') {
    // DETAILED EMPLOYEE MATRIX REPORT:
    // Focus on employee evaluations + Action Plan
    if (includeEmployeeDetails !== false) {
      drawEmployeeRosterTable();
    }
    drawActionPlanUnderStandardTable();
    drawDivisiTable();
    drawSignaturesBlock();

  } else {
    // EXECUTIVE MANAGEMENT REPORT:
    // High-level organizational recap + Job Position & Grade + Action Plan summary
    drawDivisiTable();
    drawDepartmentTable();
    drawJobPositionTable();
    drawGradeTable();
    if (includeEmployeeDetails === true) {
      drawEmployeeRosterTable();
    }
    drawActionPlanUnderStandardTable();
    drawSignaturesBlock();
  }

  // =========================================================================
  // 11. SECOND PASS: RUNNING CORPORATE HEADER & FOOTER ON ALL PAGES
  // =========================================================================
  const totalPages = doc.getNumberOfPages();
  const firstBodyPage = hasCover ? 2 : 1;

  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    // Skip running header & footer on Cover Page (it has its own custom banner & footer)
    if (hasCover && p === 1) {
      continue;
    }

    // Running Header on subsequent pages (after first report body page)
    if (p > firstBodyPage) {
      doc.setFillColor(...COLOR_NAVY);
      doc.rect(0, 0, pageWidth, 8.5, 'F');
      doc.setFillColor(...COLOR_GOLD);
      doc.rect(0, 8.5, pageWidth, 0.8, 'F');

      // Mini white badge with official Ajinomoto logo
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(marginX, 1.2, 8.5, 6, 0.5, 0.5, 'F');
      try {
        doc.addImage(
          AJINOMOTO_LOGO_BASE64,
          'PNG',
          marginX + 0.5,
          1.5,
          7.5,
          5.2
        );
      } catch (_) {}

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor(255, 255, 255);
      doc.text('PT AJINOMOTO INDONESIA — MOJOKERTO FACTORY | MULTI-SKILL SYSTEM', marginX + 10.5, 5.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(203, 213, 225);
      doc.text(`Dokumen Resmi Evaluasi Karyawan • ${tanggalStr}`, pageWidth - marginX, 5.5, { align: 'right' });
    }

    // Running Footer on report body pages
    const footerY = pageHeight - 8.5;
    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.2);
    doc.line(marginX, footerY - 2.5, pageWidth - marginX, footerY - 2.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184); // #94A3B8

    // Left Footer
    doc.text('Sistem Multi-Skill Monitoring – PT Ajinomoto Indonesia (Mojokerto Factory) • Dokumen Rahasia Perusahaan', marginX, footerY + 1);

    // Right Footer with accurate page numbering
    const displayPageNum = hasCover ? p - 1 : p;
    const displayTotal = hasCover ? totalPages - 1 : totalPages;
    const pageStr = `Halaman ${displayPageNum} dari ${displayTotal}`;
    doc.text(pageStr, pageWidth - marginX, footerY + 1, { align: 'right' });
  }

  const cleanBulan = filters.bulan.length === 1 ? `_Bulan${filters.bulan[0]}` : '';
  const cleanTahun = filters.tahun.length === 1 ? `_${filters.tahun[0]}` : '';
  const modeSuffix = reportType === 'employee_detail' ? '_DetailKaryawan' : reportType === 'executive' ? '_Eksekutif' : '_Komprehensif';
  const filename = `Laporan_MultiSkill_Ajinomoto${cleanTahun}${cleanBulan}${modeSuffix}_${now.toISOString().slice(0, 10)}.pdf`;

  return {
    doc,
    filename,
    rowCount: targetData.length,
    pageCount: totalPages
  };
}
