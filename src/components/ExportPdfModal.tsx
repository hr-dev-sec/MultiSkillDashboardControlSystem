import React, { useState, useEffect } from 'react';
import { Employee, AppFiltersState, UserSession } from '../types';
import { generateMultiSkillReportPdf } from '../utils/pdfExport';
import { BULAN_LABELS } from '../data/initialData';
import { computeDashboardStats } from '../utils/storage';
import { ConfirmationModal } from './ConfirmationModal';
import {
  EmailCustomContent,
  EmailHistoryItem,
  SmtpConfig,
  AutomatedReportSchedule,
  DEFAULT_AUTOMATED_SCHEDULE,
  GAS_SCRIPT_CODE_TEMPLATE,
  getDefaultEmailContent,
  buildMultiSkillEmailDraft,
  sendMultiSkillEmailReport,
  getSavedSmtpConfig,
  saveSmtpConfig,
  testSmtpConnection,
  getEmailHistory,
  clearEmailHistory,
  getSavedEmailWebhookUrl,
  saveEmailWebhookUrl,
  getSavedScheduleConfig,
  saveScheduleConfig,
  copyRichHtmlToClipboard,
  dispatchViaGmailWeb,
  dispatchViaOutlookWeb,
  dispatchViaMailto,
  dispatchViaGasWebhook,
  generateMagicDownloadUrl,
  generateCsvDataForEmail
} from '../utils/emailReportService';
import confetti from 'canvas-confetti';

interface ExportPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  filteredEmployees: Employee[];
  allEmployees: Employee[];
  filters: AppFiltersState;
  currentUser: UserSession;
  onExportSuccess?: (msg: string) => void;
}

export const ExportPdfModal: React.FC<ExportPdfModalProps> = ({
  isOpen,
  onClose,
  filteredEmployees,
  allEmployees,
  filters,
  currentUser,
  onExportSuccess
}) => {
  const [scope, setScope] = useState<'filtered' | 'all'>('filtered');
  const [reportType, setReportType] = useState<'comprehensive' | 'executive' | 'employee_detail'>('comprehensive');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');

  // Custom approver signatures
  const [signerName, setSignerName] = useState(currentUser.name || 'Mahmud Nurdiansyah');
  const [signerRole, setSignerRole] = useState(currentUser.role || 'HR Development Specialist');

  // Tab state: 'page1' | 'page2' | 'page3' | 'email' | 'magic_link' | 'gas' | 'schedule' | 'smtp' | 'history'
  const [activePreviewPage, setActivePreviewPage] = useState<
    'page1' | 'page2' | 'page3' | 'email' | 'magic_link' | 'gas' | 'schedule' | 'smtp' | 'history'
  >('page1');

  // Email state
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSendingStep, setEmailSendingStep] = useState<string>('');
  const [emailAlert, setEmailAlert] = useState<{ type: 'success' | 'error'; message: string; previewUrl?: string } | null>(null);
  const [copiedEmailText, setCopiedEmailText] = useState(false);
  const [copiedMagicLink, setCopiedMagicLink] = useState(false);
  const [copiedGasCode, setCopiedGasCode] = useState(false);

  // Editable Email Content
  const [emailContent, setEmailContent] = useState<EmailCustomContent>(() =>
    getDefaultEmailContent({
      targetData: filteredEmployees,
      filters,
      toEmail: 'pimpinan@ajinomoto.co.id'
    })
  );

  // Email view sub-mode: 'visual_preview' | 'edit' | 'plain_preview'
  const [emailViewMode, setEmailViewMode] = useState<'visual_preview' | 'edit' | 'plain_preview'>('visual_preview');

  // GAS Webhook Settings
  const [gasWebhookUrl, setGasWebhookUrl] = useState<string>(getSavedEmailWebhookUrl());
  const [gasAction, setGasAction] = useState<'draft' | 'send'>('draft');
  const [isTestingGas, setIsTestingGas] = useState(false);

  // Automated Schedule Config
  const [scheduleConfig, setScheduleConfig] = useState<AutomatedReportSchedule>(getSavedScheduleConfig());
  const [scheduleSavedToast, setScheduleSavedToast] = useState(false);

  // SMTP Settings State
  const [smtpConfig, setSmtpConfig] = useState<SmtpConfig>(getSavedSmtpConfig());
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Dispatch History
  const [dispatchHistory, setDispatchHistory] = useState<EmailHistoryItem[]>([]);

  // Loading generation state for PDF download
  const [isGenerating, setIsGenerating] = useState(false);

  // PDF Generation Error Modal State
  const [errorModalMsg, setErrorModalMsg] = useState<string | null>(null);

  // Load configs on modal open
  useEffect(() => {
    if (isOpen) {
      setDispatchHistory(getEmailHistory());
      setSmtpConfig(getSavedSmtpConfig());
      setGasWebhookUrl(getSavedEmailWebhookUrl());
      setScheduleConfig(getSavedScheduleConfig());
    }
  }, [isOpen]);

  // Sync email default content when filters or scope change
  useEffect(() => {
    const targetData = scope === 'filtered' ? filteredEmployees : allEmployees;
    const defaults = getDefaultEmailContent({ targetData, filters, toEmail: emailContent.toEmail });
    setEmailContent((prev) => ({
      ...prev,
      toEmail: prev.toEmail || defaults.toEmail
    }));
  }, [scope, filters, filteredEmployees, allEmployees]);

  if (!isOpen) return null;

  const targetData = scope === 'filtered' ? filteredEmployees : allEmployees;
  const stats = computeDashboardStats(targetData);
  const { totalMS, totalUS, totalManpower, percentMS, byDivisi, byDepartment, byGrade, byPosition } = stats;
  const pctFormatted = (percentMS * 100).toFixed(1) + '%';

  const thnStr = filters.tahun.join(', ') || '2026';
  const blnStr = filters.bulan.length
    ? filters.bulan.map((b) => BULAN_LABELS[Number(b) - 1] || b).join(', ')
    : 'Juli';
  const divStr = filters.divisi.join(', ') || '';
  const deptStr = filters.department.join(', ') || '';
  const jabStr = filters.jabatan.join(', ') || '';

  const emailDraftPayload = buildMultiSkillEmailDraft({
    targetData,
    filters,
    currentUser,
    customContent: emailContent
  });

  const magicLinkUrl = emailDraftPayload.magicLinkUrl;

  const handleResetEmailToDefault = () => {
    const defaultData = getDefaultEmailContent({ targetData, filters, toEmail: emailContent.toEmail });
    setEmailContent(defaultData);
    setEmailAlert({ type: 'success', message: 'Format redaksional email telah dikembalikan ke standar resmi.' });
    setTimeout(() => setEmailAlert(null), 3000);
  };

  const handleCopyDualMime = async () => {
    const success = await copyRichHtmlToClipboard(emailDraftPayload.plainTextBody, emailDraftPayload.htmlBody);
    if (success) {
      setCopiedEmailText(true);
      setEmailAlert({
        type: 'success',
        message: 'Format Rich HTML (Tabel Warna & Badge KPI) dan Plain Text berhasil disalin! Tekan Ctrl+V di Gmail/Outlook.'
      });
      setTimeout(() => {
        setCopiedEmailText(false);
        setEmailAlert(null);
      }, 3500);
    }
  };

  const handleCopyMagicLink = async () => {
    try {
      await navigator.clipboard.writeText(magicLinkUrl);
      setCopiedMagicLink(true);
      setTimeout(() => setCopiedMagicLink(false), 2500);
    } catch (_) {}
  };

  const handleCopyGasCode = async () => {
    try {
      await navigator.clipboard.writeText(GAS_SCRIPT_CODE_TEMPLATE);
      setCopiedGasCode(true);
      setTimeout(() => setCopiedGasCode(false), 2500);
    } catch (_) {}
  };

  const handleSaveGasUrl = (url: string) => {
    setGasWebhookUrl(url);
    saveEmailWebhookUrl(url);
  };

  const handleSaveSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    saveScheduleConfig(scheduleConfig);
    setScheduleSavedToast(true);
    setTimeout(() => setScheduleSavedToast(false), 3000);
  };

  // Unduh PDF ke komputer lokal
  const handleDownloadPdf = () => {
    setIsGenerating(true);
    setTimeout(() => {
      try {
        const result = generateMultiSkillReportPdf({
          scope,
          filteredEmployees,
          allEmployees,
          filters,
          currentUser,
          reportType,
          orientation,
          approvers: {
            preparedBy: { name: signerName, title: signerRole }
          }
        });

        result.doc.save(result.filename);
        setIsGenerating(false);

        try {
          confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } });
        } catch (_) {}

        const msg = `Berhasil mengunduh dokumen Laporan PDF (${result.pageCount} Halaman, ${result.rowCount} Karyawan) bertanda tangan resmi.`;
        if (onExportSuccess) {
          onExportSuccess(msg);
        }
        onClose();
      } catch (err: any) {
        setIsGenerating(false);
        setErrorModalMsg(err?.message || 'Terjadi kesalahan sistem saat menyusun dokumen PDF.');
      }
    }, 350);
  };

  // Channel 1: Gmail Webmail Composer (Deep-Linking)
  const handleOpenGmailWeb = async () => {
    setEmailAlert(null);
    if (!emailContent.toEmail || !emailContent.toEmail.includes('@')) {
      setEmailAlert({ type: 'error', message: 'Masukkan alamat email penerima yang valid terlebih dahulu.' });
      return;
    }

    await dispatchViaGmailWeb({
      to: emailContent.toEmail,
      cc: emailContent.ccEmail,
      subject: emailContent.subject,
      plainTextBody: emailDraftPayload.plainTextBody,
      htmlBody: emailDraftPayload.htmlBody
    });

    setDispatchHistory(getEmailHistory());
    setEmailAlert({
      type: 'success',
      message: 'Membuka Gmail Webmail Composer di tab baru. Tabel & format visual kaya telah otomatis disalin ke clipboard (tekan Ctrl+V).'
    });
  };

  // Channel 2: Outlook Web 365 Deep-Linking
  const handleOpenOutlookWeb = async () => {
    setEmailAlert(null);
    if (!emailContent.toEmail || !emailContent.toEmail.includes('@')) {
      setEmailAlert({ type: 'error', message: 'Masukkan alamat email penerima yang valid terlebih dahulu.' });
      return;
    }

    await dispatchViaOutlookWeb({
      to: emailContent.toEmail,
      cc: emailContent.ccEmail,
      subject: emailContent.subject,
      plainTextBody: emailDraftPayload.plainTextBody,
      htmlBody: emailDraftPayload.htmlBody
    });

    setDispatchHistory(getEmailHistory());
    setEmailAlert({
      type: 'success',
      message: 'Membuka Microsoft Outlook Web di tab baru. Tabel & format visual kaya telah otomatis disalin ke clipboard (tekan Ctrl+V).'
    });
  };

  // Channel 3: Desktop Mailto
  const handleOpenMailto = () => {
    setEmailAlert(null);
    if (!emailContent.toEmail || !emailContent.toEmail.includes('@')) {
      setEmailAlert({ type: 'error', message: 'Masukkan alamat email penerima yang valid terlebih dahulu.' });
      return;
    }

    dispatchViaMailto({
      to: emailContent.toEmail,
      cc: emailContent.ccEmail,
      subject: emailContent.subject,
      plainTextBody: emailDraftPayload.plainTextBody
    });

    setDispatchHistory(getEmailHistory());
  };

  // Channel 4: Google Apps Script Webhook (Auto Draft / Send with PDF & CSV Attachments)
  const handleSendViaGas = async () => {
    setEmailAlert(null);
    if (!gasWebhookUrl || !gasWebhookUrl.startsWith('http')) {
      setEmailAlert({
        type: 'error',
        message: 'URL Google Apps Script Webhook belum dikonfigurasi. Masukkan URL Web App pada tab Integrasi GAS.'
      });
      setActivePreviewPage('gas');
      return;
    }

    if (!emailContent.toEmail || !emailContent.toEmail.includes('@')) {
      setEmailAlert({ type: 'error', message: 'Masukkan alamat email penerima yang valid.' });
      return;
    }

    setIsSendingEmail(true);
    setEmailSendingStep('Meng-generate PDF Base64 & CSV Spreadsheet Data...');

    try {
      await new Promise((resolve) => setTimeout(resolve, 200));

      const pdfResult = generateMultiSkillReportPdf({
        scope,
        filteredEmployees,
        allEmployees,
        filters,
        currentUser,
        reportType,
        orientation,
        approvers: {
          preparedBy: { name: signerName, title: signerRole }
        }
      });

      const pdfBase64 = pdfResult.doc.output('datauristring');
      const pdfFileName = pdfResult.filename;
      const csvData = generateCsvDataForEmail(targetData);
      const csvFileName = `Database_MultiSkill_${emailDraftPayload.reportMetadata.periode.replace(/\s+/g, '_')}.csv`;

      setEmailSendingStep('Mengirim payload ke Google Apps Script Webhook...');

      const result = await dispatchViaGasWebhook(gasWebhookUrl, {
        action: gasAction,
        to: emailContent.toEmail,
        cc: emailContent.ccEmail,
        subject: emailContent.subject,
        body: emailDraftPayload.plainTextBody,
        htmlBody: emailDraftPayload.htmlBody,
        pdfBase64,
        pdfFileName,
        excelCsvData: csvData,
        excelFileName: csvFileName
      });

      setIsSendingEmail(false);
      setEmailSendingStep('');
      setDispatchHistory(getEmailHistory());

      if (result.success) {
        setEmailAlert({ type: 'success', message: result.message });
        try {
          confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } });
        } catch (_) {}
      } else {
        setEmailAlert({ type: 'error', message: result.message });
      }
    } catch (err: any) {
      setIsSendingEmail(false);
      setEmailSendingStep('');
      setEmailAlert({
        type: 'error',
        message: `Gagal memproses pengiriman via GAS: ${err?.message || 'Error tidak diketahui'}`
      });
    }
  };

  // Channel 5: Direct System Dispatcher (/api/send-email / SMTP)
  const handleSendEmailDirect = async () => {
    setEmailAlert(null);
    if (!emailContent.toEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailContent.toEmail.trim())) {
      setEmailAlert({ type: 'error', message: 'Masukkan alamat email penerima / pimpinan yang valid.' });
      return;
    }

    setIsSendingEmail(true);
    setEmailSendingStep('Menyusun dokumen PDF resmi 3 halaman...');

    try {
      await new Promise((resolve) => setTimeout(resolve, 200));
      const pdfResult = generateMultiSkillReportPdf({
        scope,
        filteredEmployees,
        allEmployees,
        filters,
        currentUser,
        reportType,
        orientation,
        approvers: {
          preparedBy: { name: signerName, title: signerRole }
        }
      });

      const pdfBase64 = pdfResult.doc.output('datauristring');
      const pdfFileName = pdfResult.filename;

      setEmailSendingStep('Mengirim laporan resmi via Direct System Server...');
      const payload = buildMultiSkillEmailDraft({
        targetData,
        filters,
        currentUser,
        customContent: emailContent
      });

      const res = await sendMultiSkillEmailReport(payload, pdfBase64, pdfFileName);
      setIsSendingEmail(false);
      setEmailSendingStep('');

      setDispatchHistory(getEmailHistory());

      if (res.success) {
        setEmailAlert({
          type: 'success',
          message: res.message,
          previewUrl: res.previewUrl
        });
        try {
          confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } });
        } catch (_) {}
      } else {
        setEmailAlert({
          type: 'error',
          message: res.message
        });
      }
    } catch (err: any) {
      setIsSendingEmail(false);
      setEmailSendingStep('');
      setEmailAlert({
        type: 'error',
        message: `Gagal mengirim email: ${err?.message || 'Terjadi gangguan internal pada sistem.'}`
      });
    }
  };

  // Preset SMTP Handlers
  const handleApplySmtpPreset = (preset: 'direct' | 'ajinomoto' | 'office365' | 'gmail') => {
    if (preset === 'direct') {
      const updated: SmtpConfig = {
        enabled: false,
        host: '',
        port: 587,
        secure: false,
        user: '',
        pass: '',
        fromName: 'Multi-Skill Monitoring — PT Ajinomoto Indonesia',
        fromEmail: 'noreply@ajinomoto.co.id'
      };
      setSmtpConfig(updated);
      saveSmtpConfig(updated);
    } else if (preset === 'ajinomoto') {
      const updated: SmtpConfig = {
        enabled: true,
        host: 'mail.ajinomoto.co.id',
        port: 587,
        secure: false,
        user: 'hr.monitoring@ajinomoto.co.id',
        pass: '',
        fromName: 'PT Ajinomoto Indonesia — Mojokerto Factory',
        fromEmail: 'hr.monitoring@ajinomoto.co.id'
      };
      setSmtpConfig(updated);
      saveSmtpConfig(updated);
    } else if (preset === 'office365') {
      const updated: SmtpConfig = {
        enabled: true,
        host: 'smtp.office365.com',
        port: 587,
        secure: false,
        user: currentUser.email || 'hr.admin@ajinomoto.co.id',
        pass: '',
        fromName: 'HR Multi-Skill Monitoring System',
        fromEmail: currentUser.email || 'hr.admin@ajinomoto.co.id'
      };
      setSmtpConfig(updated);
      saveSmtpConfig(updated);
    } else if (preset === 'gmail') {
      const updated: SmtpConfig = {
        enabled: true,
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        user: currentUser.email || 'mahmudnurdiansyah4@gmail.com',
        pass: '',
        fromName: 'Ajinomoto Multi-Skill Monitoring',
        fromEmail: currentUser.email || 'mahmudnurdiansyah4@gmail.com'
      };
      setSmtpConfig(updated);
      saveSmtpConfig(updated);
    }
  };

  const handleTestSmtp = async () => {
    setIsTestingSmtp(true);
    setSmtpTestResult(null);
    const res = await testSmtpConnection(smtpConfig);
    setIsTestingSmtp(false);
    setSmtpTestResult(res);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-gradient-to-r from-slate-50 via-white to-amber-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#0E2340] to-[#16345E] text-white flex items-center justify-center shadow-md">
              <i className="fa-solid fa-envelope-open-text text-amber-400 text-lg"></i>
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Hybrid Email Engine &amp; Laporan PDF Resmi</span>
                <span className="badge-pill bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 text-[11px] px-2 py-0.5 font-bold">
                  HYBRID ENGINE
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                PT Ajinomoto Indonesia &bull; Mojokerto Factory &bull; Webmail Deep-Linking &bull; Serverless GAS &bull; Direct Magic Link
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center transition cursor-pointer"
          >
            <i className="fa-solid fa-xmark text-sm"></i>
          </button>
        </div>

        {/* Modal Body: Left Config / Right Preview & Tools */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 min-h-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800">
          {/* Left Column (5 Cols): Scope, KPI, Approver, and Quick Channels */}
          <div className="lg:col-span-5 p-5 space-y-4 overflow-y-auto bg-slate-50/50 dark:bg-slate-900/50">
            {/* Scope Selection */}
            <div className="card-elegant p-4 space-y-2.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                1. Cakupan Data Laporan
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setScope('filtered')}
                  className={`p-2.5 rounded-xl text-left border transition text-xs font-semibold cursor-pointer ${
                    scope === 'filtered'
                      ? 'border-[#0E2340] dark:border-amber-400 bg-white dark:bg-slate-800 text-[#0E2340] dark:text-amber-300 shadow-sm'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-white/60'
                  }`}
                >
                  <p className="font-bold flex items-center justify-between">
                    <span>Sesuai Filter Aktif</span>
                    <i className="fa-solid fa-filter text-[10px]"></i>
                  </p>
                  <p className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {filteredEmployees.length} Karyawan ({blnStr} {thnStr})
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setScope('all')}
                  className={`p-2.5 rounded-xl text-left border transition text-xs font-semibold cursor-pointer ${
                    scope === 'all'
                      ? 'border-[#0E2340] dark:border-amber-400 bg-white dark:bg-slate-800 text-[#0E2340] dark:text-amber-300 shadow-sm'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-white/60'
                  }`}
                >
                  <p className="font-bold flex items-center justify-between">
                    <span>Seluruh Database</span>
                    <i className="fa-solid fa-database text-[10px]"></i>
                  </p>
                  <p className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {allEmployees.length} Total Rekam Data
                  </p>
                </button>
              </div>

              {scope === 'filtered' && (
                <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/60 text-[11px] text-amber-800 dark:text-amber-300 space-y-0.5">
                  <p className="font-bold flex items-center gap-1">
                    <i className="fa-solid fa-circle-info text-[10px]"></i> Filter Parameter:
                  </p>
                  <p className="truncate">
                    Periode: <strong>{blnStr} {thnStr}</strong> {divStr ? `| Divisi: ${divStr}` : ''} {deptStr ? `| Dept: ${deptStr}` : ''}
                  </p>
                </div>
              )}
            </div>

            {/* Quick KPI Stats Overview */}
            <div className="card-elegant p-4 space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                2. Rekapitulasi Metrik PDF &amp; Email
              </label>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800">
                  <p className="text-[10px] text-slate-500 uppercase font-semibold">Total</p>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{totalManpower}</p>
                </div>
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50">
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-semibold">MS</p>
                  <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{totalMS}</p>
                </div>
                <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/50">
                  <p className="text-[10px] text-rose-600 dark:text-rose-400 uppercase font-semibold">US</p>
                  <p className="text-sm font-bold text-rose-600 dark:text-rose-400">{totalUS}</p>
                </div>
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50">
                  <p className="text-[10px] text-blue-600 dark:text-blue-400 uppercase font-semibold">% MS</p>
                  <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{pctFormatted}</p>
                </div>
              </div>
            </div>

            {/* Signer Customization */}
            <div className="card-elegant p-4 space-y-3">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center justify-between">
                <span>3. Pejabat Penanda Tangan (E-Sign)</span>
                <span className="text-[10px] font-normal text-slate-400">Dicetak pada Hal. 3</span>
              </label>
              <div className="space-y-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">Nama Approver / Penyusun:</label>
                  <input
                    type="text"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    className="input-elegant w-full px-3 py-1.5 text-xs outline-none font-semibold text-slate-800 dark:text-slate-100"
                    placeholder="Nama Penanda Tangan"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">Jabatan / Role:</label>
                  <input
                    type="text"
                    value={signerRole}
                    onChange={(e) => setSignerRole(e.target.value)}
                    className="input-elegant w-full px-3 py-1.5 text-xs outline-none text-slate-800 dark:text-slate-100"
                    placeholder="Jabatan Approver"
                  />
                </div>
              </div>
            </div>

            {/* Direct Magic Link Card */}
            <div className="card-elegant p-4 space-y-2.5 bg-gradient-to-br from-amber-50/50 via-white to-amber-50/20 dark:from-slate-900 dark:via-slate-900 dark:to-amber-950/20 border-amber-200 dark:border-amber-900/50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                  <i className="fa-solid fa-wand-magic-sparkles text-amber-500"></i> Direct Download Magic Link
                </span>
                <button
                  type="button"
                  onClick={handleCopyMagicLink}
                  className="text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <i className={`fa-solid ${copiedMagicLink ? 'fa-check text-emerald-600' : 'fa-copy'}`}></i>
                  <span>{copiedMagicLink ? 'Tersalin!' : 'Salin Tautan'}</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                Tautan ini dapat dibagikan kepada Direksi/Pimpinan untuk mengunduh PDF secara instan tanpa perlu akun login.
              </p>
              <div className="p-2 rounded-xl bg-white dark:bg-slate-950 border border-amber-200/80 dark:border-slate-800 font-mono text-[10.5px] text-slate-700 dark:text-slate-300 truncate select-all">
                {magicLinkUrl}
              </div>
            </div>
          </div>

          {/* Right Column (7 Cols): Dynamic Preview & Tools Navigation */}
          <div className="lg:col-span-7 p-5 flex flex-col space-y-4 overflow-y-auto">
            {/* Nav Tabs */}
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                {/* PDF Page Tabs */}
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setActivePreviewPage('page1')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      activePreviewPage === 'page1'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Hal 1
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePreviewPage('page2')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      activePreviewPage === 'page2'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Hal 2
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePreviewPage('page3')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      activePreviewPage === 'page3'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Hal 3
                  </button>
                </div>

                {/* Email Draft Tab */}
                <button
                  type="button"
                  onClick={() => setActivePreviewPage('email')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    activePreviewPage === 'email'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  <i className="fa-solid fa-envelope text-xs"></i>
                  <span>Draf Email</span>
                </button>

                {/* GAS Integration Tab */}
                <button
                  type="button"
                  onClick={() => setActivePreviewPage('gas')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    activePreviewPage === 'gas'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  <i className="fa-brands fa-google text-xs"></i>
                  <span>GAS Webhook</span>
                </button>

                {/* Schedule Tab */}
                <button
                  type="button"
                  onClick={() => setActivePreviewPage('schedule')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    activePreviewPage === 'schedule'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  <i className="fa-solid fa-calendar-check text-xs"></i>
                  <span>Jadwal</span>
                </button>

                {/* History Tab */}
                <button
                  type="button"
                  onClick={() => setActivePreviewPage('history')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    activePreviewPage === 'history'
                      ? 'bg-slate-800 dark:bg-slate-700 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  <i className="fa-solid fa-clock-rotate-left text-xs"></i>
                  <span>Riwayat</span>
                </button>
              </div>
            </div>

            {/* TAB CONTENT AREA */}
            <div className="flex-1 flex flex-col justify-start">
              {/* TAB: EMAIL DRAFT PREVIEW & EDITOR */}
              {activePreviewPage === 'email' && (
                <div className="space-y-3.5 animate-fadeIn">
                  {/* Email Sub-Modes (Visual, Edit, Plain) */}
                  <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs">
                      <button
                        type="button"
                        onClick={() => setEmailViewMode('visual_preview')}
                        className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                          emailViewMode === 'visual_preview'
                            ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        Pratinjau HTML Visual
                      </button>
                      <button
                        type="button"
                        onClick={() => setEmailViewMode('edit')}
                        className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                          emailViewMode === 'edit'
                            ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        Edit Redaksional
                      </button>
                      <button
                        type="button"
                        onClick={() => setEmailViewMode('plain_preview')}
                        className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                          emailViewMode === 'plain_preview'
                            ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        Teks Polos
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopyDualMime}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5 transition cursor-pointer border border-indigo-200 dark:border-indigo-800"
                      >
                        <i className={`fa-solid ${copiedEmailText ? 'fa-check text-emerald-600' : 'fa-copy'}`}></i>
                        <span>{copiedEmailText ? 'HTML Tersalin!' : 'Salin HTML Cantik (Dual-MIME)'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleResetEmailToDefault}
                        className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline cursor-pointer"
                      >
                        Reset Default
                      </button>
                    </div>
                  </div>

                  {emailViewMode === 'edit' ? (
                    /* EDIT FORM */
                    <div className="space-y-3 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
                      <div>
                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Subjek Email:</label>
                        <input
                          type="text"
                          value={emailContent.subject}
                          onChange={(e) => setEmailContent({ ...emailContent, subject: e.target.value })}
                          className="input-elegant w-full px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Salam Pembuka / Kepada:</label>
                        <input
                          type="text"
                          value={emailContent.salutation}
                          onChange={(e) => setEmailContent({ ...emailContent, salutation: e.target.value })}
                          className="input-elegant w-full px-3 py-2 text-xs text-slate-800 dark:text-slate-100"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Paragraf Pengantar:</label>
                        <textarea
                          rows={3}
                          value={emailContent.mainParagraph}
                          onChange={(e) => setEmailContent({ ...emailContent, mainParagraph: e.target.value })}
                          className="input-elegant w-full px-3 py-2 text-xs text-slate-800 dark:text-slate-100 leading-relaxed"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                        <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={emailContent.showStatsTable}
                            onChange={(e) => setEmailContent({ ...emailContent, showStatsTable: e.target.checked })}
                            className="rounded text-indigo-600"
                          />
                          <span>Tabel Ringkasan KPI</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={emailContent.showFilterLine}
                            onChange={(e) => setEmailContent({ ...emailContent, showFilterLine: e.target.checked })}
                            className="rounded text-indigo-600"
                          />
                          <span>Badge Filter</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={emailContent.includeMagicLink}
                            onChange={(e) => setEmailContent({ ...emailContent, includeMagicLink: e.target.checked })}
                            className="rounded text-indigo-600"
                          />
                          <span>Magic Link Download</span>
                        </label>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Catatan Tambahan (Opsional):</label>
                        <input
                          type="text"
                          value={emailContent.additionalNotes || ''}
                          onChange={(e) => setEmailContent({ ...emailContent, additionalNotes: e.target.value })}
                          placeholder="Misal: Mohon verifikasi divisi MSG sebelum tanggal 10..."
                          className="input-elegant w-full px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Kalimat Penutup:</label>
                        <textarea
                          rows={2}
                          value={emailContent.closingParagraph}
                          onChange={(e) => setEmailContent({ ...emailContent, closingParagraph: e.target.value })}
                          className="input-elegant w-full px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 leading-relaxed"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Tanda Tangan Pengirim:</label>
                        <textarea
                          rows={3}
                          value={emailContent.senderSign}
                          onChange={(e) => setEmailContent({ ...emailContent, senderSign: e.target.value })}
                          className="input-elegant w-full px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 font-mono"
                        />
                      </div>
                    </div>
                  ) : emailViewMode === 'plain_preview' ? (
                    /* PLAIN TEXT PREVIEW */
                    <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 text-xs">
                        <span className="font-bold text-slate-700 dark:text-slate-200">Subjek: {emailDraftPayload.subject}</span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 font-mono text-[11px] text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed border border-slate-200 dark:border-slate-800 max-h-[380px] overflow-y-auto">
                        {emailDraftPayload.plainTextBody}
                      </div>
                    </div>
                  ) : (
                    /* VISUAL HTML PREVIEW */
                    <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-md bg-white text-slate-900 text-xs">
                      {/* Email Header Banner */}
                      <div className="p-4 text-white flex items-center gap-3.5" style={{ background: 'linear-gradient(135deg, #0E2340, #16345E)' }}>
                        <div className="w-10 h-10 rounded-lg bg-white p-1 flex items-center justify-center shrink-0">
                          <img
                            src="https://upload.wikimedia.org/wikipedia/commons/0/01/Ajinomoto_Group_Global_Brand_logo.png"
                            alt="Logo"
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                        <div>
                          <p className="text-[10px] tracking-wider text-amber-300 font-bold uppercase">
                            PT AJINOMOTO INDONESIA — MOJOKERTO FACTORY
                          </p>
                          <p className="text-sm font-extrabold text-white">Laporan Multi-Skill Monitoring</p>
                        </div>
                      </div>

                      {/* Email Body Content */}
                      <div className="p-5 space-y-3.5 bg-white text-slate-700">
                        <p className="font-semibold text-slate-900">{emailContent.salutation}</p>
                        <p className="leading-relaxed">{emailContent.mainParagraph}</p>

                        {/* Parameter Badge */}
                        {emailContent.showFilterLine && (
                          <div className="p-2 text-center rounded-xl border border-dashed border-amber-400 bg-amber-50 text-[11px] text-slate-600 font-semibold">
                            Periode: {blnStr} {thnStr} | Divisi: {divStr || 'Semua Divisi'} | Dept: {deptStr || 'Semua Departemen'}
                          </div>
                        )}

                        {/* Summary Table */}
                        {emailContent.showStatsTable && (
                          <div className="border border-slate-200 rounded-xl overflow-hidden my-3">
                            <table className="w-full text-xs text-left">
                              <tbody>
                                <tr className="border-b border-slate-200 bg-slate-50">
                                  <td className="p-2.5 text-slate-600">Total Karyawan</td>
                                  <td className="p-2.5 text-right font-bold text-slate-900">{totalManpower} Orang</td>
                                </tr>
                                <tr className="border-b border-slate-200">
                                  <td className="p-2.5 text-slate-600">Standar (MS)</td>
                                  <td className="p-2.5 text-right font-bold text-emerald-600">{totalMS} Orang</td>
                                </tr>
                                <tr className="border-b border-slate-200 bg-slate-50">
                                  <td className="p-2.5 text-slate-600">Belum Standar (US)</td>
                                  <td className="p-2.5 text-right font-bold text-rose-600">{totalUS} Orang</td>
                                </tr>
                                <tr>
                                  <td className="p-2.5 text-slate-600">Pencapaian</td>
                                  <td className="p-2.5 text-right font-bold text-slate-900">{pctFormatted}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* Magic Link Box */}
                        {emailContent.includeMagicLink && (
                          <div className="p-3.5 rounded-xl bg-gradient-to-r from-[#0E2340] to-[#1E4976] text-white text-center space-y-1.5 border border-amber-400/40">
                            <p className="text-[10px] text-amber-300 font-bold uppercase tracking-wider">✦ Direct Download Magic Link ✦</p>
                            <p className="text-xs font-bold">Unduh Dokumen Laporan PDF Resmi (3 Halaman)</p>
                            <a
                              href={magicLinkUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block px-4 py-1.5 rounded-lg bg-amber-400 text-[#0E2340] font-bold text-[11px] hover:bg-amber-300 transition"
                            >
                              📥 Unduh Laporan PDF Sekarang
                            </a>
                          </div>
                        )}

                        {/* Attached PDF Notice */}
                        <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-emerald-900">
                          <i className="fa-solid fa-file-pdf text-rose-600 text-lg shrink-0"></i>
                          <div className="text-[11px]">
                            <strong className="block font-bold text-slate-900">Lampiran Dokumen PDF Resmi (3 Halaman)</strong>
                            <span>Laporan lengkap beserta tanda tangan digital HR Management disertakan pada pesan.</span>
                          </div>
                        </div>

                        {emailContent.additionalNotes && (
                          <div className="p-2.5 rounded-lg bg-slate-100 border-l-4 border-[#0E2340] text-[11px] text-slate-700">
                            <strong>Catatan:</strong> {emailContent.additionalNotes}
                          </div>
                        )}

                        <p className="leading-relaxed">{emailContent.closingParagraph}</p>
                        <div className="pt-2 text-slate-800 whitespace-pre-line font-medium">{emailContent.senderSign}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB: GOOGLE APPS SCRIPT (GAS) WEBHOOK INTEGRATION */}
              {activePreviewPage === 'gas' && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 via-white to-emerald-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/20 border border-emerald-300/60 dark:border-emerald-900/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm">
                          <i className="fa-brands fa-google"></i>
                        </span>
                        <div>
                          <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                            Google Apps Script (GAS) Webhook Engine
                          </h3>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Otomasi serverless gratis: Buat Draft Gmail atau Kirim Email + PDF &amp; CSV Attachment
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        Google Web App URL Endpoint:
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={gasWebhookUrl}
                          onChange={(e) => handleSaveGasUrl(e.target.value)}
                          placeholder="https://script.google.com/macros/s/.../exec"
                          className="input-elegant flex-1 px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-100"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-4 pt-1">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Mode Aksi GAS:</label>
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
                        <input
                          type="radio"
                          name="gasAction"
                          value="draft"
                          checked={gasAction === 'draft'}
                          onChange={() => setGasAction('draft')}
                          className="text-emerald-600"
                        />
                        <span>Buat Draft di Gmail</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
                        <input
                          type="radio"
                          name="gasAction"
                          value="send"
                          checked={gasAction === 'send'}
                          onChange={() => setGasAction('send')}
                          className="text-emerald-600"
                        />
                        <span>Kirim Langsung</span>
                      </label>
                    </div>
                  </div>

                  {/* Code Template Box */}
                  <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <i className="fa-solid fa-code text-indigo-500"></i> Skrip Google Apps Script (Code.gs)
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyGasCode}
                        className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <i className={`fa-solid ${copiedGasCode ? 'fa-check text-emerald-600' : 'fa-copy'}`}></i>
                        <span>{copiedGasCode ? 'Tersalin!' : 'Salin Kode Code.gs'}</span>
                      </button>
                    </div>
                    <pre className="p-3 rounded-xl bg-slate-950 text-slate-300 font-mono text-[10px] leading-relaxed max-h-[220px] overflow-y-auto border border-slate-800">
                      {GAS_SCRIPT_CODE_TEMPLATE}
                    </pre>
                  </div>
                </div>
              )}

              {/* TAB: JADWAL LAPORAN OTOMATIS */}
              {activePreviewPage === 'schedule' && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-900/50 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-sm">
                          <i className="fa-solid fa-calendar-check"></i>
                        </span>
                        <div>
                          <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                            Konfigurasi Jadwal Laporan Berkala
                          </h3>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Otomasi penjadwalan ekspor laporan dan pengiriman ke jajaran manajemen
                          </p>
                        </div>
                      </div>

                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={scheduleConfig.enabled}
                          onChange={(e) => setScheduleConfig({ ...scheduleConfig, enabled: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                      </label>
                    </div>

                    <form onSubmit={handleSaveSchedule} className="space-y-3.5 text-xs">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            Frekuensi Pengiriman:
                          </label>
                          <select
                            value={scheduleConfig.frequency}
                            onChange={(e) => setScheduleConfig({ ...scheduleConfig, frequency: e.target.value as any })}
                            className="input-elegant w-full px-3 py-2 text-xs"
                          >
                            <option value="end_of_month">Akhir Bulan (End of Month)</option>
                            <option value="weekly">Mingguan (Weekly - Setiap Senin)</option>
                            <option value="biweekly">Dua Mingguan (Bi-weekly)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            Format Lampiran:
                          </label>
                          <select
                            value={scheduleConfig.format}
                            onChange={(e) => setScheduleConfig({ ...scheduleConfig, format: e.target.value as any })}
                            className="input-elegant w-full px-3 py-2 text-xs"
                          >
                            <option value="both">PDF Resmi + CSV Spreadsheet (Keduanya)</option>
                            <option value="pdf">Hanya PDF Resmi (3 Halaman)</option>
                            <option value="excel">Hanya CSV / Data Excel</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Daftar Email Penerima (Pisahkan dengan koma):
                        </label>
                        <input
                          type="text"
                          value={scheduleConfig.recipients}
                          onChange={(e) => setScheduleConfig({ ...scheduleConfig, recipients: e.target.value })}
                          placeholder="pimpinan@ajinomoto.co.id, hr.management@ajinomoto.co.id"
                          className="input-elegant w-full px-3 py-2 text-xs font-mono"
                        />
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <span className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold">
                          {scheduleSavedToast && '✓ Pengaturan jadwal berhasil disimpan!'}
                        </span>
                        <button
                          type="submit"
                          className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                        >
                          <i className="fa-solid fa-floppy-disk"></i>
                          <span>Simpan Jadwal</span>
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* TAB: RIWAYAT PENGIRIMAN EMAIL */}
              {activePreviewPage === 'history' && (
                <div className="space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                      Riwayat Pengiriman Email ({dispatchHistory.length})
                    </span>
                    {dispatchHistory.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          clearEmailHistory();
                          setDispatchHistory([]);
                        }}
                        className="text-[11px] font-semibold text-rose-500 hover:underline cursor-pointer"
                      >
                        Bersihkan Riwayat
                      </button>
                    )}
                  </div>

                  <div className="space-y-2 max-h-[360px] overflow-y-auto">
                    {dispatchHistory.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-8">Belum ada riwayat pengiriman email.</p>
                    ) : (
                      dispatchHistory.map((item) => (
                        <div
                          key={item.id}
                          className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800 dark:text-slate-200">{item.to}</span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                item.status === 'SUCCESS'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              }`}
                            >
                              {item.status} &bull; {item.method}
                            </span>
                          </div>
                          <p className="text-slate-600 dark:text-slate-400 text-[11px]">{item.subject}</p>
                          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                            <span>{new Date(item.timestamp).toLocaleString('id-ID')}</span>
                            <span>{item.hasPdfAttachment ? '📎 Lampiran PDF' : 'Tanpa Lampiran'}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* 3-PAGE PDF VISUAL PREVIEWS */}
              {['page1', 'page2', 'page3'].includes(activePreviewPage) && (
                <div className="w-[340px] sm:w-[440px] mx-auto min-h-[580px] bg-white text-slate-800 rounded-2xl shadow-xl border border-slate-300 flex flex-col justify-between overflow-hidden">
                  {/* PDF Top Official Header Banner */}
                  <div className="relative">
                    <div className="p-3 text-white flex items-center justify-between" style={{ backgroundColor: '#0E2340' }}>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded bg-white p-0.5 flex items-center justify-center shrink-0">
                          <img
                            src="https://upload.wikimedia.org/wikipedia/commons/0/01/Ajinomoto_Group_Global_Brand_logo.png"
                            alt="Logo Ajinomoto"
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                        <div>
                          <p className="text-[7.5px] tracking-wider text-slate-300 uppercase font-semibold leading-tight">
                            Eat Well, Live Well.
                          </p>
                          <p className="text-[12px] font-extrabold text-white leading-tight">AJINOMOTO MOJOKERTO FACTORY</p>
                          <p className="text-[8px] text-slate-300 leading-tight">
                            Laporan Monitoring Multi-Skill Karyawan &amp; Manajer
                          </p>
                        </div>
                      </div>
                    </div>
                    {/* Gold stripe */}
                    <div className="h-1 w-full" style={{ backgroundColor: '#B8874B' }}></div>
                  </div>

                  {/* PDF Content Area */}
                  <div className="p-3.5 space-y-3 flex-1 flex flex-col justify-between">
                    {activePreviewPage === 'page1' && (
                      <div className="space-y-2.5 animate-fadeIn">
                        {/* 4 KPI Cards */}
                        <div className="grid grid-cols-4 gap-1.5 text-center">
                          <div className="p-1.5 rounded bg-white border border-slate-200 relative overflow-hidden text-left pl-2.5">
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#0E2340]"></div>
                            <p className="font-bold text-slate-800 text-[11px] leading-tight">{totalManpower}</p>
                            <span className="text-[6.5px] text-slate-500 block mt-0.5">Total Karyawan</span>
                          </div>
                          <div className="p-1.5 rounded bg-white border border-slate-200 relative overflow-hidden text-left pl-2.5">
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#0FA968]"></div>
                            <p className="font-bold text-slate-800 text-[11px] leading-tight">{totalMS}</p>
                            <span className="text-[6.5px] text-slate-500 block mt-0.5">Standar (MS)</span>
                          </div>
                          <div className="p-1.5 rounded bg-white border border-slate-200 relative overflow-hidden text-left pl-2.5">
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#E10600]"></div>
                            <p className="font-bold text-slate-800 text-[11px] leading-tight">{totalUS}</p>
                            <span className="text-[6.5px] text-slate-500 block mt-0.5">Belum Standar</span>
                          </div>
                          <div className="p-1.5 rounded bg-white border border-slate-200 relative overflow-hidden text-left pl-2.5">
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#B8874B]"></div>
                            <p className="font-bold text-slate-800 text-[11px] leading-tight">{pctFormatted}</p>
                            <span className="text-[6.5px] text-slate-500 block mt-0.5">Pencapaian</span>
                          </div>
                        </div>

                        <div className="text-[7.5px] space-y-0.5 pt-0.5">
                          <p className="font-bold text-[#B8874B] uppercase tracking-wide text-[7px]">PARAMETER MONITORING</p>
                          <p className="text-slate-600">
                            Tahun: {thnStr} | Bulan: {blnStr} | Divisi: {divStr || 'Semua'} | Dept: {deptStr || 'Semua'}
                          </p>
                        </div>

                        {/* Rekap Divisi Table */}
                        <div className="space-y-1">
                          <p className="font-bold text-[8px] text-[#0E2340] uppercase">REKAPITULASI DIVISI</p>
                          <div className="border border-slate-200 rounded overflow-hidden">
                            <table className="w-full text-[7px] text-left">
                              <thead className="bg-[#0E2340] text-white">
                                <tr>
                                  <th className="p-1">Divisi</th>
                                  <th className="p-1 text-center">Total</th>
                                  <th className="p-1 text-center">MS</th>
                                  <th className="p-1 text-center">US</th>
                                  <th className="p-1 text-right">% MS</th>
                                </tr>
                              </thead>
                              <tbody>
                                {byDivisi.slice(0, 4).map((d, i) => {
                                  const total = d.ms + d.us;
                                  const pct = total > 0 ? (d.ms / total) * 100 : 0;
                                  return (
                                    <tr key={i} className={i % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                                      <td className="p-1 font-semibold">{d.label}</td>
                                      <td className="p-1 text-center">{total}</td>
                                      <td className="p-1 text-center text-emerald-600 font-bold">{d.ms}</td>
                                      <td className="p-1 text-center text-rose-600 font-bold">{d.us}</td>
                                      <td className="p-1 text-right font-bold">{pct.toFixed(1)}%</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}

                    {activePreviewPage === 'page2' && (
                      <div className="space-y-2.5 animate-fadeIn">
                        <p className="font-bold text-[8px] text-[#0E2340] uppercase">REKAPITULASI GRADE &amp; DEPARTMENT</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="border border-slate-200 rounded p-1.5">
                            <p className="font-bold text-[7.5px] mb-1 text-slate-700">Persebaran Grade</p>
                            {byGrade.slice(0, 4).map((g, i) => {
                              const total = g.ms + g.us;
                              const pct = total > 0 ? (g.ms / total) * 100 : 0;
                              return (
                                <div key={i} className="flex justify-between text-[7px] py-0.5 border-b border-slate-100">
                                  <span>{g.label}</span>
                                  <span className="font-bold">{pct.toFixed(1)}%</span>
                                </div>
                              );
                            })}
                          </div>
                          <div className="border border-slate-200 rounded p-1.5">
                            <p className="font-bold text-[7.5px] mb-1 text-slate-700">Top Departments</p>
                            {byDepartment.slice(0, 4).map((dp, i) => (
                              <div key={i} className="flex justify-between text-[7px] py-0.5 border-b border-slate-100">
                                <span className="truncate max-w-[90px]">{dp.label}</span>
                                <span className="font-bold text-emerald-600">{dp.ms} MS</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {activePreviewPage === 'page3' && (
                      <div className="space-y-2.5 animate-fadeIn">
                        <p className="font-bold text-[8px] text-[#0E2340] uppercase">LEMBAR PENGESAHAN &amp; E-SIGNATURE</p>
                        <div className="p-3 border border-slate-200 rounded-xl bg-slate-50 text-center space-y-2">
                          <p className="text-[7.5px] text-slate-500">Mojokerto Factory, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                          <div className="w-16 h-16 mx-auto rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-[8px]">
                            [E-SIGN HR]
                          </div>
                          <p className="font-bold text-[8.5px] text-slate-900">{signerName}</p>
                          <p className="text-[7px] text-slate-500">{signerRole}</p>
                        </div>
                      </div>
                    )}

                    {/* PDF Footer */}
                    <div className="pt-2 border-t border-slate-200 flex justify-between text-[6.5px] text-slate-400">
                      <span>Multi-Skill Monitoring System &bull; Ajinomoto Mojokerto Factory</span>
                      <span>
                        {activePreviewPage === 'page1' && 'Halaman 1 / 3'}
                        {activePreviewPage === 'page2' && 'Halaman 2 / 3'}
                        {activePreviewPage === 'page3' && 'Halaman 3 / 3'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer: Multi-Channel Dispatch Hub */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 shrink-0 space-y-3 bg-white dark:bg-slate-900">
          {/* Target Email Input Bar */}
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-bold">
                  <i className="fa-solid fa-paper-plane"></i>
                </span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  Pilih Saluran Pengiriman (MPC Hybrid Email Engine):
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <span>Pengirim:</span>
                <strong className="text-slate-700 dark:text-slate-200">{currentUser.email || 'mahmudnurdiansyah4@gmail.com'}</strong>
              </div>
            </div>

            <div className="flex gap-2 items-center flex-wrap">
              <div className="relative flex-1 min-w-[240px]">
                <i className="fa-solid fa-at absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                <input
                  type="email"
                  value={emailContent.toEmail}
                  onChange={(e) => setEmailContent({ ...emailContent, toEmail: e.target.value })}
                  placeholder="Masukkan alamat email penerima (contoh: pimpinan@ajinomoto.co.id)..."
                  className="input-elegant w-full pl-8 pr-3 py-2 outline-none text-xs sm:text-sm text-slate-800 dark:text-slate-100 font-semibold"
                />
              </div>

              {/* 1. Direct System Dispatch */}
              <button
                type="button"
                onClick={handleSendEmailDirect}
                disabled={isSendingEmail}
                className="px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-60 shadow-sm bg-gradient-to-r from-[#0E2340] to-[#1E4976] text-amber-300 border border-amber-400/30 hover:opacity-95"
                title="Kirim email langsung dari server sistem beserta lampiran PDF"
              >
                {isSendingEmail ? (
                  <>
                    <span className="w-3 h-3 border-2 border-amber-300/30 border-t-amber-300 rounded-full animate-spin"></span>
                    <span>{emailSendingStep || 'Mengirim...'}</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-bolt text-amber-400"></i>
                    <span>Kirim Server Langsung</span>
                  </>
                )}
              </button>

              {/* 2. Gmail Webmail Composer Deep-Link */}
              <button
                type="button"
                onClick={handleOpenGmailWeb}
                className="px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer bg-red-50 dark:bg-red-950/50 hover:bg-red-100 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 transition"
                title="Buka Gmail Web Composer (Tabel Rich HTML tersalin otomatis)"
              >
                <i className="fa-brands fa-google text-red-600"></i>
                <span>Gmail Web</span>
              </button>

              {/* 3. Outlook Web Deep-Link */}
              <button
                type="button"
                onClick={handleOpenOutlookWeb}
                className="px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 transition"
                title="Buka Outlook 365 Webmail (Tabel Rich HTML tersalin otomatis)"
              >
                <i className="fa-brands fa-microsoft text-blue-600"></i>
                <span>Outlook 365</span>
              </button>

              {/* 4. GAS Webhook */}
              <button
                type="button"
                onClick={handleSendViaGas}
                disabled={isSendingEmail}
                className="px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition"
                title="Kirim / Buat Draft via Google Apps Script Webhook"
              >
                <i className="fa-solid fa-code-branch text-emerald-600"></i>
                <span>GAS Webhook</span>
              </button>

              {/* 5. Desktop Mailto */}
              <button
                type="button"
                onClick={handleOpenMailto}
                className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 transition"
                title="Buka aplikasi email desktop default (mailto:)"
              >
                <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                <span>Mailto</span>
              </button>
            </div>
          </div>

          {emailAlert && (
            <div
              className={`rounded-xl px-3.5 py-2.5 text-xs font-semibold flex items-center justify-between gap-2 animate-fadeIn ${
                emailAlert.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                  : 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <i className={`fa-solid ${emailAlert.type === 'success' ? 'fa-circle-check text-emerald-600 text-sm' : 'fa-circle-exclamation text-rose-600 text-sm'}`}></i>
                <span>{emailAlert.message}</span>
              </div>
              {emailAlert.previewUrl && (
                <a
                  href={emailAlert.previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-blue-600 dark:text-blue-400 font-bold shrink-0 ml-2"
                >
                  Lihat Pratinjau Server
                </a>
              )}
            </div>
          )}

          {/* Bottom Action Controls: Download PDF / Close */}
          <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <i className="fa-solid fa-shield-halved text-emerald-600"></i>
              <span>Dokumen tervalidasi digital &bull; Mojokerto Factory</span>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Tutup
              </button>

              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isGenerating}
                className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-md cursor-pointer transition-all bg-red-600 hover:bg-red-700 text-white active:scale-95 disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    <span>Menyiapkan PDF...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-file-arrow-down text-sm"></i>
                    <span>Download Laporan PDF</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error Alert Modal */}
      <ConfirmationModal
        isOpen={Boolean(errorModalMsg)}
        title="Gagal Menghasilkan Dokumen PDF"
        description={errorModalMsg || ''}
        confirmLabel="Tutup"
        variant="danger"
        icon="fa-solid fa-triangle-exclamation"
        singleAction={true}
        onConfirm={() => setErrorModalMsg(null)}
        onCancel={() => setErrorModalMsg(null)}
      />
    </div>
  );
};
