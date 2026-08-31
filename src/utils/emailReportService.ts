import { Employee, AppFiltersState, UserSession } from '../types';
import { BULAN_LABELS } from '../data/initialData';
import { computeDashboardStats } from './storage';

export interface EmailCustomContent {
  toEmail: string;
  ccEmail?: string;
  bccEmail?: string;
  subject: string;
  salutation: string;
  mainParagraph: string;
  closingParagraph: string;
  senderSign: string;
  showStatsTable: boolean;
  showFilterLine: boolean;
  includeMagicLink: boolean;
  additionalNotes?: string;
}

export interface EmailDispatchPayload {
  toEmail: string;
  ccEmail?: string;
  bccEmail?: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  htmlBody: string;
  plainTextBody: string;
  customContent: EmailCustomContent;
  magicLinkUrl: string;
  reportMetadata: {
    periode: string;
    totalKaryawan: number;
    totalMS: number;
    totalUS: number;
    percentMS: string;
    divisiFilter: string;
    deptFilter: string;
    generatedAt: string;
    fileName: string;
  };
}

export interface EmailDispatchResult {
  success: boolean;
  message: string;
  methodUsed: 'gmail_web' | 'outlook_web' | 'mailto' | 'gas_webhook' | 'direct_system' | 'smtp' | 'clipboard';
  messageId?: string;
  previewUrl?: string;
  timestamp?: string;
}

export interface SmtpConfig {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
}

export interface AutomatedReportSchedule {
  enabled: boolean;
  frequency: 'end_of_month' | 'weekly' | 'biweekly';
  format: 'both' | 'pdf' | 'excel';
  recipients: string;
  gasWebhookUrl: string;
  action: 'draft' | 'send';
  sendTime?: string;
  lastRun?: string;
  nextRun?: string;
}

export interface GasWebhookPayload {
  action: 'draft' | 'send';
  to: string;
  cc?: string;
  subject: string;
  body: string;
  htmlBody: string;
  pdfBase64?: string;
  pdfFileName?: string;
  excelCsvData?: string;
  excelFileName?: string;
}

export interface EmailHistoryItem {
  id: string;
  timestamp: string;
  to: string;
  subject: string;
  periode: string;
  status: 'SUCCESS' | 'FAILED';
  method: string;
  messageId?: string;
  previewUrl?: string;
  hasPdfAttachment: boolean;
  notes?: string;
}

const EMAIL_WEBHOOK_URL_KEY = 'msm_email_report_webhook_url_v1';
const SMTP_CONFIG_KEY = 'msm_smtp_config_v1';
const EMAIL_HISTORY_KEY = 'msm_email_dispatch_history_v1';
const EMAIL_SCHEDULE_KEY = 'msm_automated_report_schedule_v1';

// Default Automated Schedule Config
export const DEFAULT_AUTOMATED_SCHEDULE: AutomatedReportSchedule = {
  enabled: false,
  frequency: 'end_of_month',
  format: 'both',
  recipients: 'pimpinan@ajinomoto.co.id, hr.management@ajinomoto.co.id',
  gasWebhookUrl: '',
  action: 'draft',
  sendTime: '08:00'
};

// Default SMTP Configuration
export const DEFAULT_SMTP_CONFIG: SmtpConfig = {
  enabled: false,
  host: '',
  port: 587,
  secure: false,
  user: '',
  pass: '',
  fromName: 'Multi-Skill Monitoring — PT Ajinomoto Indonesia',
  fromEmail: 'noreply@ajinomoto.co.id'
};

// Complete Google Apps Script Code Template
export const GAS_SCRIPT_CODE_TEMPLATE = `/**
 * =========================================================================
 * GOOGLE APPS SCRIPT (GAS) - HYBRID EMAIL ENGINE WEBHOOK
 * PT Ajinomoto Indonesia - Multi-Skill Monitoring System
 * =========================================================================
 * Petunjuk Pemasangan:
 * 1. Buka https://script.google.com dan buat Proyek Baru.
 * 2. Salin seluruh kode ini dan tempel di editor (Code.gs).
 * 3. Klik "Deploy" -> "New deployment" -> Pilih jenis "Web app".
 * 4. Atur "Execute as": Me (Akun Anda), "Who has access": Anyone (Siapa saja).
 * 5. Salin URL Web App yang dihasilkan dan tempelkan ke Pengaturan Sistem MSM.
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var to = data.to || "pimpinan@ajinomoto.co.id";
    var cc = data.cc || "";
    var subject = data.subject || "[MSM] Laporan Multi-Skill Monitoring Ajinomoto";
    var plainBody = data.body || "";
    var htmlBody = data.htmlBody || data.body || "";
    var action = data.action || "draft"; // Pilihan: 'draft' atau 'send'
    var attachments = [];

    // 1. Dekode dan lampirkan file PDF jika ada
    if (data.pdfBase64 && data.pdfFileName) {
      var cleanBase64 = data.pdfBase64.replace(/^data:application\\/pdf;base64,/, "");
      var pdfBytes = Utilities.base64Decode(cleanBase64);
      var pdfBlob = Utilities.newBlob(pdfBytes, "application/pdf", data.pdfFileName);
      attachments.push(pdfBlob);
    }

    // 2. Lampirkan file CSV / Data Spreadsheet jika ada
    if (data.excelCsvData && data.excelFileName) {
      var csvBlob = Utilities.newBlob(data.excelCsvData, "text/csv", data.excelFileName);
      attachments.push(csvBlob);
    }

    if (action === "send") {
      MailApp.sendEmail({
        to: to,
        cc: cc,
        subject: subject,
        body: plainBody,
        htmlBody: htmlBody,
        attachments: attachments
      });
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        action: "send",
        message: "Email berhasil dikirim langsung ke " + to
      })).setMimeType(ContentService.MimeType.JSON);
    } else {
      // Buat Draft di Gmail pengguna
      var draft = GmailApp.createDraft(to, subject, plainBody, {
        htmlBody: htmlBody,
        cc: cc,
        attachments: attachments
      });
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        action: "draft",
        draftId: draft.getId(),
        message: "Draft email berhasil dibuat di Gmail dengan lampiran lengkap"
      })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;

export function getSavedScheduleConfig(): AutomatedReportSchedule {
  try {
    const raw = localStorage.getItem(EMAIL_SCHEDULE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_AUTOMATED_SCHEDULE, ...parsed };
    }
  } catch (_) {}
  return DEFAULT_AUTOMATED_SCHEDULE;
}

export function saveScheduleConfig(config: AutomatedReportSchedule): void {
  try {
    localStorage.setItem(EMAIL_SCHEDULE_KEY, JSON.stringify(config));
  } catch (err) {
    console.error('Error saving schedule config:', err);
  }
}

export function getSavedSmtpConfig(): SmtpConfig {
  try {
    const raw = localStorage.getItem(SMTP_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SMTP_CONFIG, ...parsed };
    }
  } catch (_) {}
  return DEFAULT_SMTP_CONFIG;
}

export function saveSmtpConfig(config: SmtpConfig): void {
  try {
    localStorage.setItem(SMTP_CONFIG_KEY, JSON.stringify(config));
  } catch (err) {
    console.error('Error saving SMTP config:', err);
  }
}

export function getSavedEmailWebhookUrl(): string {
  try {
    const saved = localStorage.getItem(EMAIL_WEBHOOK_URL_KEY);
    if (saved && saved.trim()) return saved.trim();
  } catch (_) {}
  return '';
}

export function saveEmailWebhookUrl(url: string): void {
  try {
    localStorage.setItem(EMAIL_WEBHOOK_URL_KEY, url.trim());
  } catch (err) {
    console.error('Error saving email webhook URL:', err);
  }
}

export function getEmailHistory(): EmailHistoryItem[] {
  try {
    const raw = localStorage.getItem(EMAIL_HISTORY_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (_) {}
  return [];
}

export function addEmailHistoryItem(item: Omit<EmailHistoryItem, 'id'>): void {
  try {
    const current = getEmailHistory();
    const newItem: EmailHistoryItem = {
      ...item,
      id: `EMAIL-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
    };
    const updated = [newItem, ...current].slice(0, 50); // Keep last 50
    localStorage.setItem(EMAIL_HISTORY_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Error saving email history item:', err);
  }
}

export function clearEmailHistory(): void {
  try {
    localStorage.removeItem(EMAIL_HISTORY_KEY);
  } catch (err) {
    console.error('Error clearing email history:', err);
  }
}

/**
 * =========================================================================
 * DUAL-MIME CLIPBOARD COPY (Salin Format Rich HTML + Plain Text)
 * =========================================================================
 * Menyalin format HTML cantik (tabel warna, logo, badge KPI) ke clipboard.
 * Saat pengguna menekan Ctrl+V di Gmail atau Outlook Web, email terformat rapi.
 */
export async function copyRichHtmlToClipboard(plainText: string, htmlContent: string): Promise<boolean> {
  try {
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard && navigator.clipboard.write) {
      const textBlob = new Blob([plainText], { type: 'text/plain' });
      const htmlBlob = new Blob([htmlContent], { type: 'text/html' });

      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': textBlob,
          'text/html': htmlBlob
        })
      ]);
      return true;
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(plainText);
      return true;
    }
  } catch (err) {
    console.warn('ClipboardItem not fully supported in this context, using writeText fallback:', err);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(plainText);
        return true;
      }
    } catch (_) {}
  }
  return false;
}

/**
 * =========================================================================
 * DIRECT DOWNLOAD MAGIC LINK BUILDER
 * =========================================================================
 * Menghasilkan tautan langsung untuk penerima (Direksi/Pimpinan).
 * Saat diklik, penerima langsung diarahkan ke portal unduh client-side
 * yang otomatis meng-generate PDF di browser tanpa server storage.
 */
export function generateMagicDownloadUrl(params: {
  report?: string;
  month?: string | number;
  year?: string | number;
  divisi?: string;
  dept?: string;
}): string {
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://ajinomoto.co.id';
    const path = typeof window !== 'undefined' ? window.location.pathname : '/';
    const url = new URL(path, origin);

    url.searchParams.set('action', 'download-pdf');
    url.searchParams.set('report', params.report || 'comprehensive');

    if (params.month) url.searchParams.set('month', String(params.month));
    if (params.year) url.searchParams.set('year', String(params.year));
    if (params.divisi) url.searchParams.set('divisi', params.divisi);
    if (params.dept) url.searchParams.set('dept', params.dept);

    return url.toString();
  } catch (_) {
    return `/?action=download-pdf&report=${params.report || 'comprehensive'}&month=${params.month || ''}&year=${params.year || ''}`;
  }
}

/**
 * Menghasilkan data CSV terformat untuk lampiran email otomatis
 */
export function generateCsvDataForEmail(employees: Employee[]): string {
  const headers = [
    'NIK',
    'Nama Karyawan',
    'Divisi',
    'Department',
    'Job Position',
    'Grade',
    'Bulan',
    'Tahun',
    'Status Multi-Skill',
    'Rata-rata Skor'
  ];

  const rows = employees.map((emp) => {
    const isMS = emp.result === 'MS' ? 'MS (Standar)' : 'US (Under Standard)';
    const score = emp.totalScore !== undefined ? emp.totalScore.toFixed(1) : '-';
    return [
      `"${emp.empId || ''}"`,
      `"${(emp.empName || '').replace(/"/g, '""')}"`,
      `"${emp.divisi || ''}"`,
      `"${emp.department || ''}"`,
      `"${emp.jabatan || ''}"`,
      `"${emp.grade || ''}"`,
      `"${emp.bulan || ''}"`,
      `"${emp.tahun || ''}"`,
      `"${isMS}"`,
      `"${score}"`
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
}

/**
 * =========================================================================
 * METODE PENGIRIMAN 1: GMAIL WEBMAIL COMPOSER (DEEP-LINKING)
 * =========================================================================
 */
export async function dispatchViaGmailWeb(options: {
  to: string;
  cc?: string;
  subject: string;
  plainTextBody: string;
  htmlBody?: string;
}): Promise<boolean> {
  const { to, cc = '', subject, plainTextBody, htmlBody } = options;

  // 1. Salin format HTML cantik ke clipboard otomatis
  if (htmlBody) {
    await copyRichHtmlToClipboard(plainTextBody, htmlBody);
  }

  // 2. Buka Gmail Webmail Composer
  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
    to
  )}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(
    plainTextBody
  )}&cc=${encodeURIComponent(cc)}`;

  window.open(gmailUrl, '_blank', 'noopener,noreferrer');

  // Catat riwayat
  addEmailHistoryItem({
    timestamp: new Date().toISOString(),
    to,
    subject,
    periode: new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
    status: 'SUCCESS',
    method: 'Gmail Webmail Composer',
    hasPdfAttachment: false,
    notes: 'Dibuka via Gmail Web Deep-Linking (Dual-MIME HTML tersalin di clipboard)'
  });

  return true;
}

/**
 * =========================================================================
 * METODE PENGIRIMAN 2: OUTLOOK WEB / MICROSOFT 365 DEEP-LINKING
 * =========================================================================
 */
export async function dispatchViaOutlookWeb(options: {
  to: string;
  cc?: string;
  subject: string;
  plainTextBody: string;
  htmlBody?: string;
}): Promise<boolean> {
  const { to, cc = '', subject, plainTextBody, htmlBody } = options;

  // 1. Salin format HTML cantik ke clipboard otomatis
  if (htmlBody) {
    await copyRichHtmlToClipboard(plainTextBody, htmlBody);
  }

  // 2. Buka Outlook Webmail Composer
  const outlookWebUrl = `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(
    to
  )}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
    plainTextBody
  )}&cc=${encodeURIComponent(cc)}`;

  window.open(outlookWebUrl, '_blank', 'noopener,noreferrer');

  // Catat riwayat
  addEmailHistoryItem({
    timestamp: new Date().toISOString(),
    to,
    subject,
    periode: new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
    status: 'SUCCESS',
    method: 'Outlook Web 365 Composer',
    hasPdfAttachment: false,
    notes: 'Dibuka via Outlook 365 Deep-Linking (Dual-MIME HTML tersalin di clipboard)'
  });

  return true;
}

/**
 * =========================================================================
 * METODE PENGIRIMAN 3: CLIENT DESKTOP STANDAR (MAILTO)
 * =========================================================================
 */
export function dispatchViaMailto(options: {
  to: string;
  cc?: string;
  subject: string;
  plainTextBody: string;
}): boolean {
  const { to, cc = '', subject, plainTextBody } = options;

  const mailtoUrl = `mailto:${encodeURIComponent(to)}?cc=${encodeURIComponent(
    cc
  )}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(plainTextBody)}`;

  const link = document.createElement('a');
  link.href = mailtoUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  addEmailHistoryItem({
    timestamp: new Date().toISOString(),
    to,
    subject,
    periode: new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
    status: 'SUCCESS',
    method: 'Desktop Mail Client (mailto:)',
    hasPdfAttachment: false,
    notes: 'Dibuka di aplikasi email desktop default'
  });

  return true;
}

/**
 * =========================================================================
 * METODE PENGIRIMAN 4: GOOGLE APPS SCRIPT (GAS) WEBHOOK DISPATCHER
 * =========================================================================
 */
export async function dispatchViaGasWebhook(
  gasWebhookUrl: string,
  payload: GasWebhookPayload
): Promise<EmailDispatchResult> {
  if (!gasWebhookUrl || !gasWebhookUrl.startsWith('http')) {
    return {
      success: false,
      methodUsed: 'gas_webhook',
      message: 'URL Google Apps Script Webhook belum dikonfigurasi.'
    };
  }

  try {
    // Mode no-cors menghindari pembatasan CORS pada Google Web App
    await fetch(gasWebhookUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const isDraft = payload.action === 'draft';
    const actionLabel = isDraft
      ? `Draft email resmi berhasil disiapkan di akun Gmail pimpinan/operator dengan lampiran PDF & CSV`
      : `Email laporan resmi berhasil dikirimkan langsung melalui Google Apps Script Engine ke ${payload.to}`;

    addEmailHistoryItem({
      timestamp: new Date().toISOString(),
      to: payload.to,
      subject: payload.subject,
      periode: new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
      status: 'SUCCESS',
      method: isDraft ? 'GAS Webhook (Gmail Draft)' : 'GAS Webhook (Direct Send)',
      hasPdfAttachment: Boolean(payload.pdfBase64),
      notes: isDraft ? 'Draft otomatis di Gmail' : 'Terkirim via GAS'
    });

    return {
      success: true,
      methodUsed: 'gas_webhook',
      message: actionLabel
    };
  } catch (err: any) {
    addEmailHistoryItem({
      timestamp: new Date().toISOString(),
      to: payload.to,
      subject: payload.subject,
      periode: new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
      status: 'FAILED',
      method: 'GAS Webhook',
      hasPdfAttachment: Boolean(payload.pdfBase64),
      notes: `Gagal GAS: ${err?.message}`
    });

    return {
      success: false,
      methodUsed: 'gas_webhook',
      message: `Gagal memicu webhook GAS: ${err?.message || 'Server Google tidak merespons'}`
    };
  }
}

/**
 * Tes Koneksi ke Server SMTP via Backend API
 */
export async function testSmtpConnection(config: Partial<SmtpConfig>): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/test-smtp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: config.host,
        port: config.port,
        secure: config.secure,
        user: config.user,
        pass: config.pass,
        from: config.fromEmail
      })
    });

    const data = await res.json();
    return {
      success: !!data.success,
      message: data.message || (data.success ? 'Koneksi SMTP berhasil.' : 'Gagal terhubung ke SMTP.')
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Gagal menghubungi endpoint API: ${err?.message || 'Server backend tidak merespons'}`
    };
  }
}

/**
 * Menghasilkan nilai redaksional default sesuai standar resmi PT Ajinomoto Indonesia - Mojokerto Factory
 */
export function getDefaultEmailContent(options: {
  targetData: Employee[];
  filters: AppFiltersState;
  toEmail?: string;
}): EmailCustomContent {
  const { toEmail = 'pimpinan@ajinomoto.co.id' } = options;

  return {
    toEmail,
    subject: 'Laporan Multi-Skill Monitoring — Ajinomoto Mojokerto Factory',
    salutation: 'Yth. Bapak/Ibu Pimpinan & Manajemen,',
    mainParagraph:
      'Bersama email ini kami sampaikan Laporan Multi-Skill Monitoring periode terkini, mencakup rekapitulasi data per Divisi, Department, Grade, dan Job Position, serta telah dilengkapi tanda tangan elektronik dari HR Management sebagai bentuk validasi resmi.',
    closingParagraph:
      'Apabila terdapat pertanyaan atau memerlukan klarifikasi lebih lanjut terkait laporan kompetensi ini, mohon berkenan menghubungi Tim HR Development Section.',
    senderSign:
      'Hormat kami,\nSistem Multi-Skill Monitoring\nHR Development Section\nPT Ajinomoto Indonesia — Mojokerto Factory',
    showStatsTable: true,
    showFilterLine: true,
    includeMagicLink: true,
    additionalNotes: ''
  };
}

/**
 * Menyusun Draf Email Lengkap (HTML & Plain Text) berbasis data & kustomisasi user
 */
export function buildMultiSkillEmailDraft(options: {
  targetData: Employee[];
  filters: AppFiltersState;
  currentUser: UserSession;
  customContent?: Partial<EmailCustomContent>;
}): EmailDispatchPayload {
  const { targetData, filters, currentUser } = options;

  const defaultContent = getDefaultEmailContent({ targetData, filters });
  const content: EmailCustomContent = {
    ...defaultContent,
    ...(options.customContent || {})
  };

  const stats = computeDashboardStats(targetData);
  const totalKaryawan = stats.totalManpower;
  const totalMS = stats.totalMS;
  const totalUS = stats.totalUS;
  const percentMSNum = (stats.percentMS * 100).toFixed(1);
  const percentMS = `${percentMSNum}%`;

  const thnStr = filters.tahun.join(', ') || String(new Date().getFullYear());
  const blnStr = filters.bulan.length
    ? filters.bulan.map((b) => BULAN_LABELS[Number(b) - 1] || b).join(', ')
    : BULAN_LABELS[new Date().getMonth()];

  const periodeStr = `${blnStr} ${thnStr}`;
  const divisiFilter = filters.divisi.length ? filters.divisi.join(', ') : 'Semua Divisi';
  const deptFilter = filters.department.length ? filters.department.join(', ') : 'Semua Departemen';

  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
  const waktuKirim = `${dateStr}, ${timeStr}`;

  const senderEmail = currentUser.email || 'mahmudnurdiansyah4@gmail.com';
  const fileName = `Laporan_MultiSkill_Ajinomoto_${periodeStr.replace(/\s+/g, '_')}_${now.toISOString().slice(0, 10)}.pdf`;

  const filterLine = `Periode: ${periodeStr} | Divisi: ${divisiFilter} | Dept: ${deptFilter}`;

  // Direct Download Magic Link
  const magicLinkUrl = generateMagicDownloadUrl({
    report: 'comprehensive',
    month: filters.bulan.length ? filters.bulan.join(',') : '',
    year: filters.tahun.length ? filters.tahun.join(',') : '',
    divisi: filters.divisi.length ? filters.divisi.join(',') : '',
    dept: filters.department.length ? filters.department.join(',') : ''
  });

  // Stat Table HTML
  const statTableHtml = content.showStatsTable
    ? `
    <table style="width:100%;border-collapse:collapse;margin:18px 0;font-size:13px;border-radius:10px;overflow:hidden;border:1px solid #E2E8F0;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
      <tr style="background:#0E2340;color:#ffffff;">
        <th style="padding:10px 14px;text-align:left;font-size:12px;font-weight:700;">Metrik Monitoring Multi-Skill</th>
        <th style="padding:10px 14px;text-align:right;font-size:12px;font-weight:700;">Hasil Aktual</th>
      </tr>
      <tr>
        <td style="padding:10px 14px;background:#F8FAFC;border-top:1px solid #E2E8F0;color:#475569;font-weight:600;">Total Karyawan Terdata</td>
        <td style="padding:10px 14px;background:#F8FAFC;border-top:1px solid #E2E8F0;text-align:right;font-weight:700;color:#0F172A;">${totalKaryawan} Orang</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;border-top:1px solid #E2E8F0;color:#475569;">Memenuhi Standar (MS)</td>
        <td style="padding:10px 14px;border-top:1px solid #E2E8F0;text-align:right;font-weight:700;color:#0FA968;">${totalMS} Orang</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;background:#F8FAFC;border-top:1px solid #E2E8F0;color:#475569;">Belum Standar (US)</td>
        <td style="padding:10px 14px;background:#F8FAFC;border-top:1px solid #E2E8F0;text-align:right;font-weight:700;color:#E10600;">${totalUS} Orang</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;border-top:1px solid #E2E8F0;color:#475569;font-weight:600;">Tingkat Pencapaian Standar (KPI)</td>
        <td style="padding:10px 14px;border-top:1px solid #E2E8F0;text-align:right;font-weight:800;color:#B8874B;font-size:14px;">${percentMS}</td>
      </tr>
    </table>
  `
    : '';

  const filterBadgeHtml = content.showFilterLine
    ? `
    <div style="text-align:center;padding:10px 14px;border-radius:8px;border:1px dashed #B8874B;background:#FBF3E7;margin-bottom:18px;font-size:12px;color:#5B6472;">
      <strong style="color:#B8874B;text-transform:uppercase;font-size:10px;letter-spacing:0.5px;display:block;margin-bottom:3px;">Filter & Parameter Monitoring</strong>
      ${filterLine}
    </div>
  `
    : '';

  // Direct Download Magic Link Banner HTML (Feature 3 of MPC Engine)
  const magicLinkBannerHtml = content.includeMagicLink
    ? `
    <div style="margin:20px 0;padding:18px;border-radius:12px;background:linear-gradient(135deg,#0E2340 0%,#1E4976 100%);color:#ffffff;text-align:center;box-shadow:0 4px 12px rgba(14,35,64,0.15);border:1px solid #B8874B;">
      <div style="font-size:10.5px;text-transform:uppercase;letter-spacing:1px;color:#FDE68A;font-weight:700;margin-bottom:4px;">
        ✦ DIRECT DOWNLOAD MAGIC LINK ✦
      </div>
      <div style="font-size:14px;font-weight:800;color:#ffffff;margin-bottom:6px;">
        Unduh Dokumen Laporan PDF Resmi (3 Halaman)
      </div>
      <div style="font-size:11.5px;color:#CBD5E1;margin-bottom:14px;line-height:1.4;">
        Klik tombol di bawah untuk men-generate dan mengunduh berkas PDF bertanda tangan digital secara instan dari perangkat Anda.
      </div>
      <a href="${magicLinkUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#B8874B;color:#0E2340;text-decoration:none;font-weight:800;font-size:13px;padding:10px 22px;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.2);">
        📥 Unduh Laporan PDF Sekarang
      </a>
      <div style="font-size:10px;color:#94A3B8;margin-top:10px;">
        Tautan langsung: <span style="font-family:monospace;color:#E2E8F0;word-break:break-all;">${magicLinkUrl}</span>
      </div>
    </div>
  `
    : '';

  const additionalNotesHtml = content.additionalNotes?.trim()
    ? `
    <div style="background:#F1F5F9;border-left:4px solid #0E2340;padding:12px 16px;margin:16px 0;font-size:13px;color:#334155;border-radius:0 6px 6px 0;">
      <strong style="color:#0E2340;">Catatan Tambahan:</strong><br>${content.additionalNotes.replace(/\n/g, '<br>')}
    </div>
  `
    : '';

  const formattedSignHtml = content.senderSign
    .split('\n')
    .map((line, idx) => (idx === 1 ? `<b style="color:#0E2340;">${line}</b>` : line))
    .join('<br>');

  // HTML Body (Format Resmi Standar Factory)
  const htmlBody = `
<div style="font-family:'Segoe UI',Arial,Helvetica,sans-serif;color:#0F172A;max-width:620px;margin:0 auto;background:#F8FAFC;padding:16px 8px;">
  <div style="background:linear-gradient(135deg,#0E2340 0%,#16345E 100%);padding:24px 28px;border-radius:12px 12px 0 0;border-bottom:4px solid #B8874B;">
    <table role="presentation" style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="width:50px;vertical-align:middle;">
          <img src="https://upload.wikimedia.org/wikipedia/commons/0/01/Ajinomoto_Group_Global_Brand_logo.png" width="46" style="display:block;border-radius:6px;background:#ffffff;padding:4px;" alt="Logo Ajinomoto">
        </td>
        <td style="vertical-align:middle;padding-left:16px;">
          <div style="color:#B8874B;font-size:10.5px;letter-spacing:1.5px;text-transform:uppercase;font-weight:700;">PT AJINOMOTO INDONESIA</div>
          <div style="color:#ffffff;font-size:18px;font-weight:800;margin-top:2px;">MOJOKERTO FACTORY</div>
          <div style="color:#CBD5E1;font-size:12px;margin-top:2px;">Sistem Monitoring Multi-Skill Karyawan & Manajer</div>
        </td>
      </tr>
    </table>
  </div>
  <div style="border:1px solid #E2E8F0;border-top:none;padding:26px;border-radius:0 0 12px 12px;background:#ffffff;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
    <p style="margin-top:0;font-size:14.5px;color:#334155;font-weight:600;">${content.salutation}</p>
    <p style="font-size:14px;color:#334155;line-height:1.65;">${content.mainParagraph.replace(/\n/g, '<br>')}</p>
    
    ${filterBadgeHtml}
    ${statTableHtml}
    ${magicLinkBannerHtml}
    ${additionalNotesHtml}

    <div style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:8px;padding:12px 16px;margin:18px 0;display:flex;align-items:center;">
      <div style="font-size:12.5px;color:#065F46;line-height:1.5;">
        <strong>✓ Dokumen PDF Resmi 3 Halaman:</strong> Berkas laporan lengkap mencakup rekapitulasi Divisi, Department, Grade, Job Position, serta Tanda Tangan Digital HR Management.
      </div>
    </div>

    <p style="font-size:12.5px;color:#64748B;line-height:1.7;margin-top:16px;">
      Laporan ini digenerate secara otomatis oleh sistem pada ${waktuKirim}, sebagai bagian dari monitoring berkala kompetensi multi-skill di lingkungan Ajinomoto Mojokerto Factory.
    </p>
    <p style="font-size:13.5px;color:#475569;margin-top:14px;">
      ${content.closingParagraph.replace(/\n/g, '<br>')}
    </p>
    <div style="margin-top:22px;padding-top:14px;border-top:1px solid #F1F5F9;font-size:13px;color:#334155;line-height:1.6;">
      ${formattedSignHtml}
    </div>
    <div style="margin-top:22px;padding-top:12px;border-top:1px solid #E2E8F0;font-size:11px;color:#94A3B8;text-align:center;">
      Email ini dikirimkan melalui Hybrid Email Engine Sistem Multi-Skill Monitoring Ajinomoto Mojokerto Factory.
    </div>
  </div>
</div>
  `.trim();

  // Plain text version with embedded magic link
  const plainTextBody = `
${content.salutation}

${content.mainParagraph}

${
  content.showStatsTable
    ? `[RINGKASAN LAPORAN MULTI-SKILL]
• Total Karyawan      : ${totalKaryawan} Orang
• Standar (MS)        : ${totalMS} Orang
• Belum Standar (US)  : ${totalUS} Orang
• Pencapaian Standar  : ${percentMS}`
    : ''
}
${content.showFilterLine ? `• Parameter Filter    : ${filterLine}` : ''}
${content.additionalNotes?.trim() ? `\n[CATATAN TAMBAHAN]\n${content.additionalNotes}` : ''}

${
  content.includeMagicLink
    ? `[DIRECT DOWNLOAD MAGIC LINK]
Unduh Dokumen Laporan PDF Resmi secara instan:
${magicLinkUrl}
`
    : ''
}
Dokumen PDF Resmi: Laporan 3 halaman lengkap (Rekap Divisi, Department, Grade, Job Position, dan E-Signature HR Management).

Laporan ini dihasilkan secara otomatis oleh sistem pada ${waktuKirim}, sebagai bagian dari monitoring berkala kompetensi multi-skill di lingkungan Ajinomoto Mojokerto Factory.

${content.closingParagraph}

${content.senderSign}

---
Email ini dikirimkan melalui Hybrid Email Engine Sistem Multi-Skill Monitoring Ajinomoto Mojokerto Factory.
  `.trim();

  return {
    toEmail: content.toEmail,
    ccEmail: content.ccEmail,
    bccEmail: content.bccEmail,
    senderName: 'Multi-Skill Monitoring System — PT Ajinomoto Indonesia',
    senderEmail,
    subject: content.subject,
    htmlBody,
    plainTextBody,
    customContent: content,
    magicLinkUrl,
    reportMetadata: {
      periode: periodeStr,
      totalKaryawan,
      totalMS,
      totalUS,
      percentMS,
      divisiFilter,
      deptFilter,
      generatedAt: waktuKirim,
      fileName
    }
  };
}

/**
 * =========================================================================
 * HYBRID DISPATCHER HUB
 * =========================================================================
 * 1. Mengirim langsung melalui Backend API (/api/send-email) dengan lampiran file PDF (Base64).
 * 2. Menggunakan konfigurasi SMTP custom bila ada, atau built-in direct server dispatcher.
 * 3. Mendukung GAS Webhook jika diatur.
 * 4. Fallback ke Webmail Deep-Linking & Mailto.
 */
export async function sendMultiSkillEmailReport(
  payload: EmailDispatchPayload,
  pdfBase64?: string,
  pdfFileName?: string,
  excelCsvData?: string,
  excelFileName?: string
): Promise<EmailDispatchResult> {
  const smtpConfig = getSavedSmtpConfig();
  const gasWebhookUrl = getSavedEmailWebhookUrl();

  // If GAS Webhook is preferred and configured
  if (gasWebhookUrl && gasWebhookUrl.startsWith('http')) {
    try {
      const gasResult = await dispatchViaGasWebhook(gasWebhookUrl, {
        action: 'draft', // by default creates draft with attachments in Gmail
        to: payload.toEmail,
        cc: payload.ccEmail,
        subject: payload.subject,
        body: payload.plainTextBody,
        htmlBody: payload.htmlBody,
        pdfBase64: pdfBase64 || undefined,
        pdfFileName: pdfFileName || payload.reportMetadata.fileName,
        excelCsvData: excelCsvData || undefined,
        excelFileName: excelFileName || `Database_MultiSkill_${payload.reportMetadata.periode.replace(/\s+/g, '_')}.csv`
      });

      if (gasResult.success) {
        return gasResult;
      }
    } catch (gasErr) {
      console.warn('GAS webhook attempt error, proceeding to backend dispatch:', gasErr);
    }
  }

  // =========================================================================
  // METODE UTAMA: KIRIM LANGSUNG DARI SYSTEM VIA BACKEND /api/send-email
  // =========================================================================
  try {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: payload.toEmail,
        cc: payload.ccEmail,
        bcc: payload.bccEmail,
        subject: payload.subject,
        htmlBody: payload.htmlBody,
        plainTextBody: payload.plainTextBody,
        senderName: smtpConfig.enabled && smtpConfig.fromName ? smtpConfig.fromName : payload.senderName,
        senderEmail: smtpConfig.enabled && smtpConfig.fromEmail ? smtpConfig.fromEmail : payload.senderEmail,
        pdfBase64: pdfBase64 || undefined,
        pdfFileName: pdfFileName || payload.reportMetadata.fileName,
        smtpConfig: smtpConfig.enabled
          ? {
              host: smtpConfig.host,
              port: smtpConfig.port,
              secure: smtpConfig.secure,
              user: smtpConfig.user,
              pass: smtpConfig.pass,
              from: smtpConfig.fromEmail
            }
          : undefined
      })
    });

    if (res.ok) {
      const data = await res.json();

      addEmailHistoryItem({
        timestamp: new Date().toISOString(),
        to: payload.toEmail,
        subject: payload.subject,
        periode: payload.reportMetadata.periode,
        status: 'SUCCESS',
        method: smtpConfig.enabled ? `SMTP (${smtpConfig.host})` : 'Direct System Server',
        messageId: data.messageId,
        previewUrl: data.previewUrl,
        hasPdfAttachment: Boolean(pdfBase64),
        notes: `Terkirim ke ${payload.toEmail}`
      });

      return {
        success: true,
        methodUsed: smtpConfig.enabled ? 'smtp' : 'direct_system',
        message:
          data.message ||
          `Laporan resmi berhasil dikirimkan langsung dari sistem ke ${payload.toEmail}${pdfBase64 ? ' beserta lampiran PDF' : ''}.`,
        messageId: data.messageId,
        previewUrl: data.previewUrl,
        timestamp: data.timestamp || new Date().toISOString()
      };
    } else {
      const errData = await res.json().catch(() => ({}));
      console.warn('Backend send-email error status:', res.status, errData);
      throw new Error(errData.message || `Server merespons dengan status ${res.status}`);
    }
  } catch (backendError: any) {
    console.warn('Pengiriman langsung backend mengalami kendala, fallback ke Gmail Web Composer:', backendError);

    // Fallback: Salin format rich HTML dan buka Gmail Web Deep-Linking
    await copyRichHtmlToClipboard(payload.plainTextBody, payload.htmlBody);
    await dispatchViaGmailWeb({
      to: payload.toEmail,
      cc: payload.ccEmail,
      subject: payload.subject,
      plainTextBody: payload.plainTextBody,
      htmlBody: payload.htmlBody
    });

    return {
      success: true,
      methodUsed: 'gmail_web',
      message: `Membuka Gmail Composer untuk penerima ${payload.toEmail}. Format email kaya (tabel warna) telah otomatis disalin ke clipboard (tekan Ctrl+V).`
    };
  }
}
