import { Employee, AppFiltersState, UserSession } from '../types';
import { INITIAL_SKILL_META, BULAN_LABELS } from '../data/initialData';
import { AJINOMOTO_LOGO_URL } from './storage';

export interface ExportExcelOptions {
  scope: 'filtered' | 'all';
  filteredEmployees: Employee[];
  allEmployees: Employee[];
  filters: AppFiltersState;
  currentUser: UserSession;
}

/**
 * Generate and download a beautifully styled Excel (.xls) file
 * with Ajinomoto Corporate letterhead, official logo, KPI summary cards,
 * metadata info, and complete 92+ skill matrix dataset.
 */
export function exportDatabaseExcel({
  scope,
  filteredEmployees,
  allEmployees,
  filters,
  currentUser
}: ExportExcelOptions): { success: boolean; rowCount: number; filename: string } {
  const targetData = scope === 'filtered' ? filteredEmployees : allEmployees;
  const skillMeta = INITIAL_SKILL_META;

  const now = new Date();
  const tanggalStr = now.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const jamStr = now.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }) + ' WIB';

  // Statistics calculation
  const totalCount = targetData.length;
  const totalMS = targetData.filter((e) => e.result === 'MS').length;
  const totalUS = targetData.filter((e) => e.result === 'US').length;
  const percentMS = totalCount > 0 ? ((totalMS / totalCount) * 100).toFixed(1) : '0.0';

  const bulanLabelsText = filters.bulan.length
    ? filters.bulan.map((b) => BULAN_LABELS[Number(b) - 1] || b).join(', ')
    : 'Semua Bulan';
  const filterDesc = scope === 'filtered'
    ? `Tahun: ${filters.tahun.join(', ') || 'Semua'} | Bulan: ${bulanLabelsText} | Divisi: ${filters.divisi.join(', ') || 'Semua'} | Dept: ${filters.department.join(', ') || 'Semua'} | Jabatan: ${filters.jabatan.join(', ') || 'Semua'}`
    : 'Seluruh Database Master (Semua Periode & Organisasi)';

  // Build HTML Table for Excel (.xls)
  let html = `
  <html xmlns:o="urn:schemas-microsoft-com:office:office"
        xmlns:x="urn:schemas-microsoft-com:office:excel"
        xmlns="http://www.w3.org/TR/REC-html40">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <!--[if gte mso 9]>
    <xml>
      <x:ExcelWorkbook>
        <x:ExcelWorksheets>
          <x:ExcelWorksheet>
            <x:Name>Database Multi-Skill</x:Name>
            <x:WorksheetOptions>
              <x:DisplayGridlines/>
            </x:WorksheetOptions>
          </x:ExcelWorksheet>
        </x:ExcelWorksheets>
      </x:ExcelWorkbook>
    </xml>
    <![endif]-->
    <style>
      body {
        font-family: 'Segoe UI', Arial, sans-serif;
        color: #1E293B;
      }
      .title-main {
        font-size: 16pt;
        font-weight: bold;
        color: #0E2340;
        text-align: left;
      }
      .subtitle-main {
        font-size: 11pt;
        font-weight: bold;
        color: #B8874B;
        text-align: left;
      }
      .meta-label {
        font-weight: bold;
        color: #475569;
        font-size: 9pt;
        background-color: #F1F5F9;
        border: 1px solid #CBD5E1;
      }
      .meta-val {
        color: #0F172A;
        font-size: 9pt;
        border: 1px solid #CBD5E1;
      }
      .kpi-box {
        font-weight: bold;
        text-align: center;
        border: 1px solid #CBD5E1;
        font-size: 10pt;
      }
      .kpi-val {
        font-size: 14pt;
        font-weight: bold;
        text-align: center;
        border: 1px solid #CBD5E1;
      }
      .tbl-header {
        background-color: #0E2340;
        color: #FFFFFF;
        font-weight: bold;
        font-size: 9pt;
        text-align: center;
        vertical-align: middle;
        border: 1px solid #334155;
      }
      .tbl-header-skill {
        background-color: #1E3A8A;
        color: #FFFFFF;
        font-weight: bold;
        font-size: 8pt;
        text-align: center;
        vertical-align: middle;
        border: 1px solid #475569;
      }
      .tbl-header-result {
        background-color: #B8874B;
        color: #FFFFFF;
        font-weight: bold;
        font-size: 9pt;
        text-align: center;
        vertical-align: middle;
        border: 1px solid #78350F;
      }
      .cell-profile {
        font-size: 8.5pt;
        border: 1px solid #E2E8F0;
        vertical-align: middle;
      }
      .cell-center {
        text-align: center;
        font-size: 8.5pt;
        border: 1px solid #E2E8F0;
        vertical-align: middle;
      }
      .cell-skill-on {
        text-align: center;
        font-weight: bold;
        color: #047857;
        background-color: #DCFCE7;
        border: 1px solid #CBD5E1;
        font-size: 8.5pt;
      }
      .cell-skill-off {
        text-align: center;
        color: #94A3B8;
        background-color: #F8FAFC;
        border: 1px solid #CBD5E1;
        font-size: 8.5pt;
      }
      .cell-ms {
        text-align: center;
        font-weight: bold;
        color: #065F46;
        background-color: #A7F3D0;
        border: 1px solid #6EE7B7;
        font-size: 9pt;
      }
      .cell-us {
        text-align: center;
        font-weight: bold;
        color: #991B1B;
        background-color: #FECDD3;
        border: 1px solid #FDA4AF;
        font-size: 9pt;
      }
      .row-alt {
        background-color: #F8FAFC;
      }
    </style>
  </head>
  <body>
    <table>
      <!-- 1. OFFICIAL CORPORATE LETTERHEAD -->
      <tr>
        <td rowspan="3" style="width: 80px; text-align: center; vertical-align: middle; background-color: #FFFFFF; border: 1px solid #E2E8F0;">
          <img src="${AJINOMOTO_LOGO_URL}" width="65" height="65" alt="Logo Ajinomoto" />
        </td>
        <td colspan="15" class="title-main">PT AJINOMOTO INDONESIA - PT AJINEX INTERNATIONAL</td>
      </tr>
      <tr>
        <td colspan="15" class="subtitle-main">MOJOKERTO FACTORY &bull; SISTEM MONITORING MULTI-SKILL KARYAWAN &amp; MANAJER</td>
      </tr>
      <tr>
        <td colspan="15" style="font-size: 8.5pt; color: #64748B;">Laporan Database Resmi Rekapitulasi Kompetensi &bull; HR Development Section</td>
      </tr>

      <tr><td colspan="16" style="height: 10px;"></td></tr>

      <!-- 2. METADATA & REKAPITULASI KPI -->
      <tr>
        <td colspan="3" class="meta-label">Tanggal Export:</td>
        <td colspan="4" class="meta-val">${tanggalStr} (${jamStr})</td>
        <td colspan="2" class="kpi-box" style="background-color: #E2E8F0; color: #0E2340;">TOTAL KARYAWAN</td>
        <td colspan="2" class="kpi-box" style="background-color: #DCFCE7; color: #065F46;">MEMENUHI STANDAR (MS)</td>
        <td colspan="2" class="kpi-box" style="background-color: #FEE2E2; color: #991B1B;">BELUM STANDAR (US)</td>
        <td colspan="3" class="kpi-box" style="background-color: #FEF3C7; color: #92400E;">PENCAPAIAN STANDAR</td>
      </tr>
      <tr>
        <td colspan="3" class="meta-label">Operator / PIC:</td>
        <td colspan="4" class="meta-val">${currentUser.name} (${currentUser.role})</td>
        <td colspan="2" class="kpi-val" style="background-color: #F1F5F9; color: #0E2340;">${totalCount}</td>
        <td colspan="2" class="kpi-val" style="background-color: #ECFDF5; color: #059669;">${totalMS}</td>
        <td colspan="2" class="kpi-val" style="background-color: #FFF1F2; color: #E11D48;">${totalUS}</td>
        <td colspan="3" class="kpi-val" style="background-color: #FFFBEB; color: #D97706;">${percentMS}%</td>
      </tr>
      <tr>
        <td colspan="3" class="meta-label">Cakupan Data:</td>
        <td colspan="13" class="meta-val">${filterDesc}</td>
      </tr>

      <tr><td colspan="16" style="height: 12px;"></td></tr>

      <!-- 3. TABLE HEADERS -->
      <tr>
        <!-- Identitas Karyawan (14 kolom) -->
        <th class="tbl-header" style="width: 40px;">No</th>
        <th class="tbl-header" style="width: 100px;">Emp ID</th>
        <th class="tbl-header" style="width: 180px;">Nama Karyawan</th>
        <th class="tbl-header" style="width: 140px;">Divisi</th>
        <th class="tbl-header" style="width: 140px;">Department</th>
        <th class="tbl-header" style="width: 130px;">Section</th>
        <th class="tbl-header" style="width: 65px;">Grade</th>
        <th class="tbl-header" style="width: 75px;">Job Grade</th>
        <th class="tbl-header" style="width: 130px;">Jabatan</th>
        <th class="tbl-header" style="width: 60px;">Gender</th>
        <th class="tbl-header" style="width: 90px;">Tgl Pensiun</th>
        <th class="tbl-header" style="width: 120px;">PIC</th>
        <th class="tbl-header" style="width: 55px;">Tahun</th>
        <th class="tbl-header" style="width: 55px;">Bulan</th>

        <!-- 92 Kolom Kompetensi Multi-Skill -->
        ${skillMeta
          .map(
            (s) =>
              `<th class="tbl-header-skill" style="width: 65px;" title="${s.family}">${s.code}</th>`
          )
          .join('')}

        <!-- 4 Kolom Hasil Penilaian -->
        <th class="tbl-header-result" style="width: 75px;">Total Score</th>
        <th class="tbl-header-result" style="width: 75px;">Standard</th>
        <th class="tbl-header-result" style="width: 75px;">Result</th>
        <th class="tbl-header-result" style="width: 65px;">GAP</th>
      </tr>
  `;

  // 4. DATA ROWS
  targetData.forEach((emp, index) => {
    const isAlt = index % 2 === 1 ? ' class="row-alt"' : '';
    const isMS = emp.result === 'MS';

    html += `<tr${isAlt}>`;
    html += `<td class="cell-center">${emp.no || index + 1}</td>`;
    html += `<td class="cell-profile" style="font-family: monospace; font-weight: bold;">${emp.empId}</td>`;
    html += `<td class="cell-profile" style="font-weight: bold;">${emp.empName}</td>`;
    html += `<td class="cell-profile">${emp.divisi || '-'}</td>`;
    html += `<td class="cell-profile">${emp.department || '-'}</td>`;
    html += `<td class="cell-profile">${emp.section || '-'}</td>`;
    html += `<td class="cell-center" style="font-weight: bold;">${emp.grade || '-'}</td>`;
    html += `<td class="cell-center">${emp.jobGrade || '-'}</td>`;
    html += `<td class="cell-profile">${emp.jabatan || '-'}</td>`;
    html += `<td class="cell-center">${emp.gender || '-'}</td>`;
    html += `<td class="cell-center">${emp.tanggalPensiun || '-'}</td>`;
    html += `<td class="cell-profile">${emp.pic || '-'}</td>`;
    html += `<td class="cell-center">${emp.tahun}</td>`;
    html += `<td class="cell-center">${emp.bulan}</td>`;

    // 92 Skills
    skillMeta.forEach((s) => {
      const hasSkill = emp.skills && emp.skills[s.code];
      if (hasSkill) {
        html += `<td class="cell-skill-on">1</td>`;
      } else {
        html += `<td class="cell-skill-off">0</td>`;
      }
    });

    // Results
    html += `<td class="cell-center" style="font-weight: bold; font-size: 9.5pt;">${emp.totalScore || 0}</td>`;
    html += `<td class="cell-center">${emp.standard ?? '-'}</td>`;
    html += `<td class="${isMS ? 'cell-ms' : 'cell-us'}">${emp.result || '-'}</td>`;
    html += `<td class="cell-center" style="font-weight: bold;">${emp.gap !== undefined ? emp.gap : '-'}</td>`;

    html += `</tr>`;
  });

  // 5. FOOTER SUMMARY & VALIDATION
  html += `
      <tr><td colspan="${18 + skillMeta.length}" style="height: 14px;"></td></tr>
      <tr>
        <td colspan="8" style="font-size: 8pt; color: #64748B; font-style: italic;">
          * Dokumen ini dibuat otomatis oleh Sistem Multi-Skill Monitoring PT Ajinomoto Indonesia &amp; PT Ajinex International (Mojokerto Factory).
        </td>
        <td colspan="6" style="text-align: right; font-size: 8pt; font-weight: bold; color: #0E2340;">
          Status Tervalidasi E-Signed HR Development
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;

  // Trigger File Download
  const filename = `Ajinomoto_Database_MultiSkill_${scope === 'filtered' ? 'Filtered' : 'Master'}_${Date.now()}.xls`;
  const blob = new Blob(['\uFEFF' + html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);

  return {
    success: true,
    rowCount: targetData.length,
    filename
  };
}
