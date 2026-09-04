import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Employee, AppFiltersState, UserSession } from '../types';
import { BULAN_LABELS } from '../data/initialData';
import { computeDashboardStats } from './storage';

export interface PdfExportOptions {
  scope: 'filtered' | 'all';
  filteredEmployees: Employee[];
  allEmployees: Employee[];
  filters: AppFiltersState;
  currentUser: UserSession;
  reportType?: 'comprehensive' | 'executive' | 'employee_detail';
  orientation?: 'portrait' | 'landscape';
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

/**
 * Generate official PDF Report matching the exact corporate template of PT Ajinomoto Indonesia - Mojokerto Factory:
 * - Page 1: Kop Banner Navy + Gold Stripe, 4 KPI Stat Cards, Filter Aktif, Rekap per Divisi, Rekap per Department (Part 1)
 * - Page 2: Rekap per Department (Part 2), Rekap per Grade, Rekap per Job Position
 * - Page 3: Official Electronic Sign-off (E-Signed Box, Date, HR Management, Signer)
 * - All Pages: Consistent Footer "Sistem Multi-Skill Monitoring – Ajinomoto Mojokerto Factory" & "Halaman X / Y"
 */
export function generateMultiSkillReportPdf({
  scope,
  filteredEmployees,
  allEmployees,
  filters,
  currentUser,
  reportType = 'comprehensive',
  orientation = 'portrait',
  approvers
}: PdfExportOptions): PdfExportResult {
  const targetData = scope === 'filtered' ? filteredEmployees : allEmployees;
  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4',
    orientation: orientation
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;
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

  const signerName = approvers?.preparedBy?.name || currentUser.name || 'Team HR';
  const signerRole = approvers?.preparedBy?.title || currentUser.role || 'Admin';

  // Compute statistics
  const stats = computeDashboardStats(targetData);
  const { totalMS, totalUS, totalManpower, percentMS, byDivisi, byDepartment, byGrade, byPosition } = stats;
  const pctFormatted = (percentMS * 100).toFixed(1) + '%';

  let y = 0;

  // =========================================================================
  // 1. CORPORATE HEADER (PAGE 1)
  // =========================================================================
  const drawHeader = () => {
    const headerHeight = 22;
    // Dark Navy Background
    doc.setFillColor(...COLOR_NAVY);
    doc.rect(0, 0, pageWidth, headerHeight, 'F');

    // Bottom Gold Accent Stripe
    doc.setFillColor(...COLOR_GOLD);
    doc.rect(0, headerHeight, pageWidth, 1.2, 'F');

    // Logo on Left side: Ajinomoto Red Monogram & Badge
    const logoX = marginX;
    const logoY = 3.5;

    // Small "Eat Well, Live Well." text above
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(255, 255, 255);
    doc.text('Eat Well, Live Well.', logoX + 0.5, logoY + 2.5);

    // Red "Aj" Emblem
    doc.setFillColor(...COLOR_RED);
    doc.roundedRect(logoX + 2, logoY + 3.2, 10.5, 6.8, 1.2, 1.2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Aj', logoX + 7.2, logoY + 8, { align: 'center' });

    // AJINOMOTO Text below
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(4.8);
    doc.setTextColor(255, 255, 255);
    doc.text('AJINOMOTO', logoX + 7.2, logoY + 12.8, { align: 'center' });

    // Title Text next to logo
    const titleX = logoX + 20;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text('AJINOMOTO MOJOKERTO FACTORY', titleX, 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(226, 232, 240);
    doc.text('Laporan Monitoring Multi-Skill Karyawan & Manajer', titleX, 16);

    y = headerHeight + 6.5;
  };

  // =========================================================================
  // 2. KPI STAT CARDS (4 CARDS IN 1 ROW)
  // =========================================================================
  const drawKpiCards = () => {
    const cardCount = 4;
    const gap = 3.5;
    const cardW = (contentWidth - gap * (cardCount - 1)) / cardCount;
    const cardH = 14.5;

    const cards = [
      { val: String(totalManpower), label: 'Total Karyawan', color: COLOR_NAVY },
      { val: String(totalMS), label: 'Standar (MS)', color: COLOR_GREEN },
      { val: String(totalUS), label: 'Belum Standar (US)', color: COLOR_DANGER_RED },
      { val: pctFormatted, label: 'Pencapaian', color: COLOR_GOLD }
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
      doc.setFontSize(14);
      doc.setTextColor(...COLOR_TEXT_DARK);
      doc.text(c.val, cx + 5, y + 6.8);

      // Label (Small Gray)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(...COLOR_TEXT_MUTED);
      doc.text(c.label, cx + 5, y + 11.5);
    });

    y += cardH + 6;
  };

  // =========================================================================
  // 3. FILTER AKTIF
  // =========================================================================
  const drawFilterAktif = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(...COLOR_GOLD);
    doc.text('FILTER AKTIF', marginX, y);
    y += 3.8;

    const uniqueTahun = Array.from(new Set(targetData.map((e) => e.tahun).filter(Boolean)));
    const uniqueBulan = Array.from(new Set(targetData.map((e) => e.bulan).filter(Boolean)));

    const thnStr = filters.tahun.length
      ? filters.tahun.join(', ')
      : (uniqueTahun.length ? uniqueTahun.join(', ') : '2026');

    const blnStr = filters.bulan.length
      ? filters.bulan.map((b) => BULAN_LABELS[Number(b) - 1] || b).join(', ')
      : (uniqueBulan.length ? uniqueBulan.map((b) => BULAN_LABELS[Number(b) - 1] || b).join(', ') : 'Semua Periode');

    const divStr = filters.divisi.length ? filters.divisi.join(', ') : 'Semua';
    const deptStr = filters.department.length ? filters.department.join(', ') : 'Semua';
    const jabStr = filters.jabatan.length ? filters.jabatan.join(', ') : 'Semua';

    const filterText = `Tahun: ${thnStr} | Bulan: ${blnStr} | Divisi: ${divStr} | Department: ${deptStr} | Jabatan: ${jabStr}`;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(51, 65, 85);
    doc.text(filterText, marginX, y);

    y += 6.5;
  };

  // =========================================================================
  // SECTION TITLE HELPER (GOLD SQUARE + HEADING)
  // =========================================================================
  const drawSectionHeading = (title: string) => {
    // Check if near bottom of page
    if (y > pageHeight - 35) {
      doc.addPage();
      y = 16;
    }

    // Gold Square Icon
    doc.setFillColor(...COLOR_GOLD);
    doc.rect(marginX, y - 2.8, 2.5, 2.5, 'F');

    // Title Text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...COLOR_TEXT_DARK);
    doc.text(title, marginX + 4.2, y - 0.7);

    y += 2.5;
  };

  // =========================================================================
  // 4. REKAP PER DIVISI TABLE (PAGE 1)
  // =========================================================================
  const drawDivisiTable = () => {
    drawSectionHeading('Rekap per Divisi');

    const divisiRows = byDivisi.map((d) => {
      const tot = d.ms + d.us;
      return [d.label, String(d.ms), String(d.us), String(tot)];
    });

    autoTable(doc, {
      startY: y,
      head: [['Divisi', 'MS', 'US', 'Total']],
      body: divisiRows,
      theme: 'plain',
      headStyles: {
        fillColor: COLOR_NAVY,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.2,
        cellPadding: { top: 1.8, bottom: 1.8, left: 3, right: 3 }
      },
      columnStyles: {
        0: { halign: 'left', cellWidth: contentWidth * 0.65 },
        1: { halign: 'center', cellWidth: contentWidth * 0.11 },
        2: { halign: 'center', cellWidth: contentWidth * 0.11 },
        3: { halign: 'center', cellWidth: contentWidth * 0.13 }
      },
      bodyStyles: {
        fontSize: 6.8,
        textColor: COLOR_TEXT_DARK,
        cellPadding: { top: 1.3, bottom: 1.3, left: 3, right: 3 }
      },
      alternateRowStyles: {
        fillColor: COLOR_BG_ALT
      },
      margin: { left: marginX, right: marginX }
    });

    y = ((doc as any).lastAutoTable?.finalY ?? y) + 6.5;
  };

  // =========================================================================
  // 5. REKAP PER DEPARTMENT TABLE (PAGE 1 OVERFLOWS TO PAGE 2)
  // =========================================================================
  const drawDepartmentTable = () => {
    drawSectionHeading('Rekap per Department');

    const deptRows = byDepartment.map((d) => {
      const tot = d.ms + d.us;
      return [d.label, String(d.ms), String(d.us), String(tot)];
    });

    autoTable(doc, {
      startY: y,
      head: [['Department', 'MS', 'US', 'Total']],
      body: deptRows,
      theme: 'plain',
      headStyles: {
        fillColor: COLOR_NAVY,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.2,
        cellPadding: { top: 1.8, bottom: 1.8, left: 3, right: 3 }
      },
      columnStyles: {
        0: { halign: 'left', cellWidth: contentWidth * 0.65 },
        1: { halign: 'center', cellWidth: contentWidth * 0.11 },
        2: { halign: 'center', cellWidth: contentWidth * 0.11 },
        3: { halign: 'center', cellWidth: contentWidth * 0.13 }
      },
      bodyStyles: {
        fontSize: 6.8,
        textColor: COLOR_TEXT_DARK,
        cellPadding: { top: 1.3, bottom: 1.3, left: 3, right: 3 }
      },
      alternateRowStyles: {
        fillColor: COLOR_BG_ALT
      },
      pageBreak: 'auto',
      margin: { left: marginX, right: marginX, top: 14, bottom: 16 }
    });

    y = ((doc as any).lastAutoTable?.finalY ?? y) + 6.5;
  };

  // =========================================================================
  // 6. REKAP PER GRADE TABLE (PAGE 2)
  // =========================================================================
  const drawGradeTable = () => {
    drawSectionHeading('Rekap per Grade');

    // Standard ordered grades as in template: M5, M4, M3, M2, M1, ST5, ST4, ST3, REM1, REM2, REM3, REM4
    const standardGrades = ['M5', 'M4', 'M3', 'M2', 'M1', 'ST5', 'ST4', 'ST3', 'REM1', 'REM2', 'REM3', 'REM4'];
    const gradeMap = new Map<string, { ms: number; us: number }>();
    byGrade.forEach((g) => gradeMap.set(g.label, { ms: g.ms, us: g.us }));

    const gradeRows = standardGrades.map((gr) => {
      const data = gradeMap.get(gr) || { ms: 0, us: 0 };
      const tot = data.ms + data.us;
      return [gr, String(data.ms), String(data.us), String(tot)];
    });

    // Also include any extra grades present in data
    byGrade.forEach((g) => {
      if (!standardGrades.includes(g.label)) {
        gradeRows.push([g.label, String(g.ms), String(g.us), String(g.ms + g.us)]);
      }
    });

    autoTable(doc, {
      startY: y,
      head: [['Grade', 'MS', 'US', 'Total']],
      body: gradeRows,
      theme: 'plain',
      headStyles: {
        fillColor: COLOR_NAVY,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.2,
        cellPadding: { top: 1.8, bottom: 1.8, left: 3, right: 3 }
      },
      columnStyles: {
        0: { halign: 'left', cellWidth: contentWidth * 0.65 },
        1: { halign: 'center', cellWidth: contentWidth * 0.11 },
        2: { halign: 'center', cellWidth: contentWidth * 0.11 },
        3: { halign: 'center', cellWidth: contentWidth * 0.13 }
      },
      bodyStyles: {
        fontSize: 6.8,
        textColor: COLOR_TEXT_DARK,
        cellPadding: { top: 1.3, bottom: 1.3, left: 3, right: 3 }
      },
      alternateRowStyles: {
        fillColor: COLOR_BG_ALT
      },
      margin: { left: marginX, right: marginX, top: 14, bottom: 16 }
    });

    y = ((doc as any).lastAutoTable?.finalY ?? y) + 6.5;
  };

  // =========================================================================
  // 7. REKAP PER JOB POSITION TABLE (PAGE 2)
  // =========================================================================
  const drawJobPositionTable = () => {
    drawSectionHeading('Rekap per Job Position');

    const posRows = (byPosition || []).map((p) => {
      return [
        p?.label || '',
        String(p?.threshold ?? 0),
        ((p?.target ?? 0) * 100).toFixed(1),
        String(p?.ok ?? 0),
        String(p?.notOk ?? 0),
        String(p?.manpower ?? 0),
        ((p?.resultPercent ?? 0) * 100).toFixed(1)
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [['Job Position', 'Threshold', 'Target (%)', 'OK', 'Not OK', 'Manpower', 'Result (%)']],
      body: posRows,
      theme: 'plain',
      headStyles: {
        fillColor: COLOR_NAVY,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.2,
        cellPadding: { top: 1.8, bottom: 1.8, left: 2.5, right: 2.5 }
      },
      columnStyles: {
        0: { halign: 'left', cellWidth: contentWidth * 0.28 },
        1: { halign: 'center', cellWidth: contentWidth * 0.12 },
        2: { halign: 'center', cellWidth: contentWidth * 0.12 },
        3: { halign: 'center', cellWidth: contentWidth * 0.12 },
        4: { halign: 'center', cellWidth: contentWidth * 0.12 },
        5: { halign: 'center', cellWidth: contentWidth * 0.12 },
        6: { halign: 'center', cellWidth: contentWidth * 0.12 }
      },
      bodyStyles: {
        fontSize: 6.8,
        textColor: COLOR_TEXT_DARK,
        cellPadding: { top: 1.4, bottom: 1.4, left: 2.5, right: 2.5 }
      },
      alternateRowStyles: {
        fillColor: COLOR_BG_ALT
      },
      margin: { left: marginX, right: marginX, top: 14, bottom: 16 }
    });

    y = ((doc as any).lastAutoTable?.finalY ?? y) + 8;
  };

  // =========================================================================
  // 8. ELECTRONIC SIGN-OFF BLOCK (PAGE 3)
  // =========================================================================
  const drawSignaturesBlock = () => {
    // Ensure the executive report signature page is cleanly placed on Page 3
    if (reportType !== 'employee_detail') {
      while (doc.getNumberOfPages() < 3) {
        doc.addPage();
      }
      doc.setPage(3);
      y = 18;
    } else if (y > pageHeight - 55) {
      doc.addPage();
      y = 18;
    }

    const boxW = 56;
    const boxH = 26;
    const signX = pageWidth - marginX - boxW;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.setTextColor(51, 65, 85);
    doc.text(`Mojokerto, ${tanggalStr}`, signX, y);
    y += 4.2;

    doc.text('Mengetahui,', signX, y);
    y += 4.2;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.8);
    doc.setTextColor(...COLOR_NAVY);
    doc.text('HR Management', signX, y);
    y += 2.8;

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
    const iconX = signX + 7.5;
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
    doc.setFontSize(8.8);
    doc.setTextColor(...COLOR_GOLD);
    doc.text('E-SIGNED', iconX + 6, iconY + 0.8);

    // Subtext inside box
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.4);
    doc.setTextColor(...COLOR_TEXT_MUTED);
    doc.text('Ditandatangani elektronik', iconX - 3, iconY + 6.5);
    doc.text(tanggalStr, iconX - 3, iconY + 10.5);
    doc.text(jamStr, iconX - 3, iconY + 14.5);

    y += boxH + 4.5;

    // Signer Name & Role below box
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.8);
    doc.setTextColor(...COLOR_TEXT_DARK);
    doc.text(`( ${signerName} )`, signX, y);
    y += 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.setTextColor(...COLOR_TEXT_MUTED);
    doc.text(signerRole, signX, y);
  };

  // =========================================================================
  // 9. OPTIONAL EMPLOYEE ROSTER DETAIL (FOR DETAILED REPORT TYPE)
  // =========================================================================
  const drawEmployeeRosterIfRequested = () => {
    if (reportType !== 'comprehensive' && reportType !== 'employee_detail') {
      return;
    }

    if (reportType === 'employee_detail') {
      drawSectionHeading(`Daftar Evaluasi Karyawan (${targetData.length} Karyawan)`);
      const rosterRows = targetData.map((emp, idx) => {
        const bLabel = emp.bulan ? BULAN_LABELS[emp.bulan - 1] || String(emp.bulan) : '-';
        return [
          String(idx + 1),
          emp.empId || `EMP-${idx + 1}`,
          emp.empName || '-',
          emp.divisi || '-',
          emp.department || '-',
          emp.grade || '-',
          emp.jabatan || '-',
          `${bLabel.slice(0, 3)} ${emp.tahun || ''}`.trim(),
          String(emp.totalScore || 0),
          emp.standard !== null && emp.standard !== undefined ? `≥ ${emp.standard}` : '-',
          emp.result || '-'
        ];
      });

      autoTable(doc, {
        startY: y,
        head: [['No', 'Emp ID', 'Nama Karyawan', 'Divisi', 'Dept', 'Grade', 'Jabatan', 'Periode', 'Skor', 'Std', 'Status']],
        body: rosterRows,
        theme: 'plain',
        headStyles: {
          fillColor: COLOR_NAVY,
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 6.5,
          cellPadding: 1.5
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 8 },
          1: { halign: 'left', fontStyle: 'bold', cellWidth: 20 },
          2: { halign: 'left', fontStyle: 'bold', cellWidth: 32 },
          3: { halign: 'left', cellWidth: 24 },
          4: { halign: 'left', cellWidth: 24 },
          5: { halign: 'center', cellWidth: 12 },
          6: { halign: 'left', cellWidth: 26 },
          7: { halign: 'center', cellWidth: 14 },
          8: { halign: 'center', fontStyle: 'bold', cellWidth: 10 },
          9: { halign: 'center', cellWidth: 10 },
          10: { halign: 'center', fontStyle: 'bold', cellWidth: 12 }
        },
        bodyStyles: {
          fontSize: 6,
          textColor: COLOR_TEXT_DARK,
          cellPadding: 1.2
        },
        alternateRowStyles: {
          fillColor: COLOR_BG_ALT
        },
        margin: { left: marginX, right: marginX }
      });

      y = ((doc as any).lastAutoTable?.finalY ?? y) + 8;
    }
  };

  // =========================================================================
  // EXECUTE GENERATION SEQUENCE (MATCHING EXACT 3-PAGE ATTACHMENT)
  // =========================================================================
  // Page 1:
  drawHeader();
  drawKpiCards();
  drawFilterAktif();
  drawDivisiTable();
  drawDepartmentTable();

  // Page 2 & subsequent:
  drawGradeTable();
  drawJobPositionTable();
  drawEmployeeRosterIfRequested();

  // Signature Block (Page 3):
  drawSignaturesBlock();

  // =========================================================================
  // 10. SECOND PASS: FOOTER ON ALL PAGES ("Halaman X / Y")
  // =========================================================================
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    const footerY = pageHeight - 9;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(148, 163, 184); // #94A3B8

    // Left Footer: Sistem Multi-Skill Monitoring – Ajinomoto Mojokerto Factory
    doc.text('Sistem Multi-Skill Monitoring – Ajinomoto Mojokerto Factory', marginX, footerY);

    // Right Footer: Halaman X / Y
    const pageStr = `Halaman ${p} / ${totalPages}`;
    doc.text(pageStr, pageWidth - marginX, footerY, { align: 'right' });
  }

  const cleanBulan = filters.bulan.length === 1 ? `_Bulan${filters.bulan[0]}` : '';
  const cleanTahun = filters.tahun.length === 1 ? `_${filters.tahun[0]}` : '';
  const filename = `Laporan_MultiSkill_Ajinomoto${cleanTahun}${cleanBulan}_${now.toISOString().slice(0, 10)}.pdf`;

  return {
    doc,
    filename,
    rowCount: targetData.length,
    pageCount: totalPages
  };
}
