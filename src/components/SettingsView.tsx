import React, { useState, useEffect } from 'react';
import { Employee, PeriodsData, UserSession, AppFiltersState, UserAccount, ActivityLog } from '../types';
import { BULAN_LABELS } from '../data/initialData';
import {
  changePasswordAsync,
  updateUserProfileAsync,
  duplicatePeriod,
  exportDatabaseCsv,
  buildReportPdfDoc,
  AJINOMOTO_LOGO_URL,
  getStoredUsers,
  saveStoredSession,
  saveSession
} from '../utils/storage';
import {
  fetchSystemInit,
  fetchServerActivityLogs,
  fetchUserDatabaseInfo,
  downloadUsersDatabaseBackup,
  downloadFullSystemBackup,
  getUsersDatabaseBackupText,
  getFullSystemBackupText,
  triggerFileDownload,
  importUsersDatabase,
  resetUsersDatabase
} from '../utils/systemDbService';
import {
  DEFAULT_GOOGLE_SHEET_URL,
  getSavedGoogleSheetUrl,
  generateCompleteSupabaseSqlSchema,
  generateGoogleAppsScriptForSheets
} from '../utils/syncService';
import {
  SmtpConfig,
  AutomatedReportSchedule,
  EmailHistoryItem,
  getSavedSmtpConfig,
  saveSmtpConfig,
  testSmtpConnection,
  getSavedEmailWebhookUrl,
  saveEmailWebhookUrl,
  getSavedScheduleConfig,
  saveScheduleConfig,
  getEmailHistory,
  clearEmailHistory,
  GAS_SCRIPT_CODE_TEMPLATE
} from '../utils/emailReportService';
import { ExportExcelConfirmModal } from './ExportExcelConfirmModal';
import { ExportPdfModal } from './ExportPdfModal';
import { ConfirmationModal, ConfirmationVariant } from './ConfirmationModal';
import { HdPhotoModal } from './HdPhotoModal';
import { MasterUsersManagement } from './MasterUsersManagement';
import { optimizeImageToHd } from '../utils/imageOptimizer';
import confetti from 'canvas-confetti';

interface SettingsViewProps {
  currentUser: UserSession;
  employees: Employee[];
  filteredEmployees: Employee[];
  filters: AppFiltersState;
  periods: PeriodsData;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onRefreshData: (newEmployees: Employee[]) => void;
  onOpenImportModal?: () => void;
  onUpdateCurrentUser?: (user: UserSession) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentUser,
  employees,
  filteredEmployees,
  filters,
  periods,
  isDarkMode,
  onToggleDarkMode,
  onRefreshData,
  onOpenImportModal,
  onUpdateCurrentUser
}) => {
  // Settings Tab Selector: 'master_users' | 'profile' | 'tools' | 'smtp' | 'logs'
  const [activeSettingsTab, setActiveSettingsTab] = useState<'master_users' | 'profile' | 'tools' | 'smtp' | 'logs'>('master_users');

  // 0. Profile State
  const [adminName, setAdminName] = useState(currentUser.name || 'Mahmud Nurdiansyah');
  const [adminUsername, setAdminUsername] = useState(currentUser.username || 'hr_admin');
  const [adminNik, setAdminNik] = useState(currentUser.nik || '122108091');
  const [adminRole, setAdminRole] = useState(currentUser.role || 'HR Development Admin');
  const [adminDepartment, setAdminDepartment] = useState(currentUser.department || 'Human Resources Development');
  const [adminEmail, setAdminEmail] = useState(currentUser.email || 'mahmudnurdiansyah4@gmail.com');
  const [adminPhone, setAdminPhone] = useState(currentUser.phone || '0819-1932-7912');
  const [adminBio, setAdminBio] = useState(currentUser.bio || 'Administrator Multi-Skill Monitoring & Pengembangan Kompetensi Karyawan PT Ajinomoto Indonesia Mojokerto Factory.');
  const [adminAvatarUrl, setAdminAvatarUrl] = useState(currentUser.avatarUrl || '');
  const [profileAlert, setProfileAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSubmittingProfile, setIsSubmittingProfile] = useState(false);

  // Sync state when currentUser prop changes
  useEffect(() => {
    setAdminName(currentUser.name || 'Mahmud Nurdiansyah');
    setAdminUsername(currentUser.username || 'hr_admin');
    setAdminNik(currentUser.nik || '122108091');
    setAdminRole(currentUser.role || 'HR Development Admin');
    setAdminDepartment(currentUser.department || 'Human Resources Development');
    setAdminEmail(currentUser.email || 'mahmudnurdiansyah4@gmail.com');
    setAdminPhone(currentUser.phone || '0819-1932-7912');
    setAdminBio(currentUser.bio || 'Administrator Multi-Skill Monitoring & Pengembangan Kompetensi Karyawan PT Ajinomoto Indonesia Mojokerto Factory.');
    setAdminAvatarUrl(currentUser.avatarUrl || '');
  }, [currentUser]);

  // 1. Ganti Password State
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordAlert, setPasswordAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);

  // HD Avatar & Preview State
  const [isOptimizingImage, setIsOptimizingImage] = useState(false);
  const [isHdPreviewOpen, setIsHdPreviewOpen] = useState(false);

  // System Database Users & Audit Logs State
  const [systemUsers, setSystemUsers] = useState<UserAccount[]>(() => getStoredUsers());
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [isLoadingSystemDb, setIsLoadingSystemDb] = useState(false);

  // Load system DB data on mount
  useEffect(() => {
    setIsLoadingSystemDb(true);
    fetchSystemInit().then((res) => {
      setIsLoadingSystemDb(false);
      if (res) {
        if (res.users && res.users.length > 0) setSystemUsers(res.users);
        if (res.recentLogs) setActivityLogs(res.recentLogs);
      }
    });
  }, []);

  const refreshSystemData = async () => {
    const res = await fetchSystemInit();
    if (res) {
      if (res.users) setSystemUsers(res.users);
      if (res.recentLogs) setActivityLogs(res.recentLogs);
    }
  };

  // 2. Duplikasi Periode State
  const latestPeriod = periods.tahunList.length
    ? {
        tahun: periods.tahunList[0],
        bulan: (periods.bulanByTahun[String(periods.tahunList[0])] || [1])[0] || 1
      }
    : { tahun: 2026, bulan: 8 };

  const [dupSourceTahun, setDupSourceTahun] = useState<number>(latestPeriod.tahun);
  const [dupSourceBulan, setDupSourceBulan] = useState<number>(latestPeriod.bulan);

  // Compute default target (next month)
  const nextTarget = dupSourceBulan >= 12
    ? { tahun: dupSourceTahun + 1, bulan: 1 }
    : { tahun: dupSourceTahun, bulan: dupSourceBulan + 1 };

  const [dupTargetTahun, setDupTargetTahun] = useState<number>(nextTarget.tahun);
  const [dupTargetBulan, setDupTargetBulan] = useState<number>(nextTarget.bulan);
  const [dupAlert, setDupAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSubmittingDup, setIsSubmittingDup] = useState(false);

  // Custom Modal Confirmation State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: React.ReactNode | string;
    confirmLabel?: string;
    variant?: ConfirmationVariant;
    icon?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {}
  });

  // 3. PDF Report Preview State
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [isEmailRowOpen, setIsEmailRowOpen] = useState(false);
  const [emailAlert, setEmailAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // 4. Excel Download Confirmation Modal State
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [exportToast, setExportToast] = useState<string | null>(null);

  // 5. SMTP & Email Engine Configuration State
  const [smtpSettings, setSmtpSettings] = useState<SmtpConfig>(getSavedSmtpConfig());
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [smtpAlert, setSmtpAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // 6. GAS Webhook Configuration State
  const [gasWebhookUrl, setGasWebhookUrl] = useState<string>(getSavedEmailWebhookUrl());
  const [gasAlert, setGasAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copiedGasScript, setCopiedGasScript] = useState(false);

  // 7. Automated Schedule State
  const [scheduleConfig, setScheduleConfig] = useState<AutomatedReportSchedule>(getSavedScheduleConfig());
  const [scheduleAlert, setScheduleAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // 8. Email History Log State
  const [emailLogs, setEmailLogs] = useState<EmailHistoryItem[]>(() => getEmailHistory());

  const handleSmtpSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveSmtpConfig(smtpSettings);
    setSmtpAlert({ type: 'success', message: 'Konfigurasi SMTP server berhasil diperbarui.' });
    setTimeout(() => setSmtpAlert(null), 4000);
  };

  const handleTestSmtpConnection = async () => {
    setIsTestingSmtp(true);
    setSmtpAlert(null);
    const res = await testSmtpConnection(smtpSettings);
    setIsTestingSmtp(false);
    setSmtpAlert({ type: res.success ? 'success' : 'error', message: res.message });
  };

  const handleSaveGasWebhook = (e: React.FormEvent) => {
    e.preventDefault();
    saveEmailWebhookUrl(gasWebhookUrl);
    setGasAlert({ type: 'success', message: 'URL Webhook Google Apps Script berhasil disimpan.' });
    setTimeout(() => setGasAlert(null), 4000);
  };

  const handleSaveSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    saveScheduleConfig(scheduleConfig);
    setScheduleAlert({ type: 'success', message: 'Pengaturan Jadwal Pengiriman Otomatis berhasil disimpan.' });
    setTimeout(() => setScheduleAlert(null), 4000);
  };

  const handleCopyGasScript = async () => {
    try {
      await navigator.clipboard.writeText(GAS_SCRIPT_CODE_TEMPLATE);
      setCopiedGasScript(true);
      setTimeout(() => setCopiedGasScript(false), 3000);
    } catch (e) {
      console.warn(e);
    }
  };

  const handleClearEmailLogs = () => {
    clearEmailHistory();
    setEmailLogs([]);
  };

  // Handle Change Password
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordAlert(null);

    if (newPassword !== confirmPassword) {
      setPasswordAlert({ type: 'error', message: 'Konfirmasi password baru tidak sama.' });
      return;
    }

    setIsSubmittingPassword(true);
    try {
      const res = await changePasswordAsync(currentUser.username, oldPassword, newPassword);
      setIsSubmittingPassword(false);
      setPasswordAlert({ type: res.success ? 'success' : 'error', message: res.message });
      if (res.success) {
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        refreshSystemData();
      }
    } catch (err: any) {
      setIsSubmittingPassword(false);
      setPasswordAlert({ type: 'error', message: err?.message || 'Gagal mengubah password.' });
    }
  };

  // User Database Backup & Restore Handlers
  const [userDbActionAlert, setUserDbActionAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isExportingUserDb, setIsExportingUserDb] = useState(false);
  const [isExportingFullDb, setIsExportingFullDb] = useState(false);
  const [isImportingUserDb, setIsImportingUserDb] = useState(false);

  // Raw Backup Modal State
  const [rawBackupModal, setRawBackupModal] = useState<{
    isOpen: boolean;
    title: string;
    content: string;
    filename: string;
  }>({
    isOpen: false,
    title: '',
    content: '',
    filename: ''
  });

  // Supabase & GAS Script Generator State
  const [selectedScriptTab, setSelectedScriptTab] = useState<'supabase' | 'gas'>('supabase');
  const [scriptCopyToast, setScriptCopyToast] = useState<string | null>(null);

  const handleBackupUserDb = async () => {
    setIsExportingUserDb(true);
    setUserDbActionAlert(null);
    const success = await downloadUsersDatabaseBackup();
    setIsExportingUserDb(false);
    if (success) {
      setUserDbActionAlert({ type: 'success', message: 'File backup database pengguna (users_db.json) berhasil diunduh.' });
      setTimeout(() => setUserDbActionAlert(null), 5000);
      try {
        confetti({ particleCount: 40, spread: 60, origin: { y: 0.7 } });
      } catch (_) {}
    } else {
      setUserDbActionAlert({ type: 'error', message: 'Gagal mengunduh file backup database pengguna via browser.' });
    }
  };

  const handleBackupFullSystemDb = async () => {
    setIsExportingFullDb(true);
    setUserDbActionAlert(null);
    const success = await downloadFullSystemBackup(employees);
    setIsExportingFullDb(false);
    if (success) {
      setUserDbActionAlert({
        type: 'success',
        message: `Cadangan Lengkap Sistem (${employees.length} Karyawan, 92 Skill, Akun Pengguna & Konfigurasi) berhasil diunduh.`
      });
      setTimeout(() => setUserDbActionAlert(null), 6000);
      try {
        confetti({ particleCount: 60, spread: 80, origin: { y: 0.6 } });
      } catch (_) {}
    } else {
      setUserDbActionAlert({ type: 'error', message: 'Gagal membuat file cadangan sistem lengkap via browser.' });
    }
  };

  const handleCopyUserDbJson = async () => {
    try {
      const text = await getUsersDatabaseBackupText();
      await navigator.clipboard.writeText(text);
      setUserDbActionAlert({ type: 'success', message: 'JSON Cadangan Database User berhasil disalin ke clipboard!' });
      setTimeout(() => setUserDbActionAlert(null), 4000);
      try {
        confetti({ particleCount: 30, spread: 50, origin: { y: 0.7 } });
      } catch (_) {}
    } catch (err) {
      setUserDbActionAlert({ type: 'error', message: 'Gagal menyalin JSON ke clipboard.' });
    }
  };

  const handleCopyFullSystemDbJson = async () => {
    try {
      const text = await getFullSystemBackupText(employees);
      await navigator.clipboard.writeText(text);
      setUserDbActionAlert({ type: 'success', message: 'JSON Cadangan Sistem Lengkap berhasil disalin ke clipboard!' });
      setTimeout(() => setUserDbActionAlert(null), 4000);
      try {
        confetti({ particleCount: 40, spread: 60, origin: { y: 0.7 } });
      } catch (_) {}
    } catch (err) {
      setUserDbActionAlert({ type: 'error', message: 'Gagal menyalin JSON ke clipboard.' });
    }
  };

  const handleViewUserDbJson = async () => {
    const text = await getUsersDatabaseBackupText();
    setRawBackupModal({
      isOpen: true,
      title: 'Pratinjau JSON: Database Pengguna (users_db.json)',
      content: text,
      filename: `ajinomoto_users_db_backup_${new Date().toISOString().slice(0, 10)}.json`
    });
  };

  const handleViewFullSystemDbJson = async () => {
    const text = await getFullSystemBackupText(employees);
    setRawBackupModal({
      isOpen: true,
      title: 'Pratinjau JSON: Cadangan Sistem Lengkap Multi-Skill',
      content: text,
      filename: `ajinomoto_full_system_database_backup_${new Date().toISOString().slice(0, 10)}.json`
    });
  };

  const handleImportUserDbFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImportingUserDb(true);
    setUserDbActionAlert(null);

    try {
      const text = await file.text();
      const res = await importUsersDatabase(text, currentUser.username);
      setIsImportingUserDb(false);
      setUserDbActionAlert({
        type: res.success ? 'success' : 'error',
        message: res.message
      });
      if (res.success) {
        await refreshSystemData();
        setTimeout(() => setUserDbActionAlert(null), 5000);
      }
    } catch (err: any) {
      setIsImportingUserDb(false);
      setUserDbActionAlert({ type: 'error', message: 'Gagal membaca file JSON database pengguna.' });
    }
    // Reset file input
    e.target.value = '';
  };

  const handleResetUserDb = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Reset Database Pengguna ke Default',
      variant: 'warning',
      icon: 'fa-solid fa-rotate-left',
      confirmLabel: 'Ya, Reset Database User',
      description: 'Apakah Anda yakin ingin mereset database akun pengguna ke setelan default pabrik? Semua akun kustom tambahan akan diatur ulang ke akun super administrator standar.',
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        const res = await resetUsersDatabase(currentUser.username);
        setUserDbActionAlert({
          type: res.success ? 'success' : 'error',
          message: res.message
        });
        if (res.success) {
          await refreshSystemData();
          setTimeout(() => setUserDbActionAlert(null), 5000);
        }
      }
    });
  };

  const executeDuplicate = () => {
    setIsSubmittingDup(true);
    setTimeout(() => {
      const res = duplicatePeriod(employees, dupSourceTahun, dupSourceBulan, dupTargetTahun, dupTargetBulan);
      setIsSubmittingDup(false);

      if (res.success) {
        setDupAlert({ type: 'success', message: res.message });
        onRefreshData(res.employees);
        try {
          confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
        } catch (_) {}
      } else {
        setDupAlert({ type: 'error', message: res.message });
      }
    }, 450);
  };

  // Handle Duplicate Period
  const handleDuplicateSubmit = () => {
    setDupAlert(null);

    if (dupSourceTahun === dupTargetTahun && dupSourceBulan === dupTargetBulan) {
      setDupAlert({ type: 'error', message: 'Periode sumber dan tujuan tidak boleh sama.' });
      return;
    }

    // Check if target period already has data
    const existingInTarget = employees.filter(
      (e) => Number(e.tahun) === Number(dupTargetTahun) && Number(e.bulan) === Number(dupTargetBulan)
    );

    if (existingInTarget.length > 0) {
      setConfirmModal({
        isOpen: true,
        title: 'Konfirmasi Duplikasi ke Periode yang Ada',
        variant: 'warning',
        icon: 'fa-solid fa-clone',
        confirmLabel: 'Ya, Lanjutkan Duplikasi',
        description: (
          <div className="space-y-3">
            <p>
              Periode target <strong>{BULAN_LABELS[dupTargetBulan - 1]} {dupTargetTahun}</strong> saat ini telah memiliki <strong>{existingInTarget.length} data karyawan</strong>.
            </p>
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200">
              <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <i className="fa-solid fa-triangle-exclamation text-amber-500"></i>
                <span>Mode Penambahan (Append)</span>
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                Duplikasi akan MENAMBAH data baru dari periode sumber, bukan menimpa atau menghapus data yang sudah ada di periode target.
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Lanjutkan proses penggandaan struktur matriks ke periode ini?
            </p>
          </div>
        ),
        onConfirm: () => {
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
          executeDuplicate();
        }
      });
      return;
    }

    executeDuplicate();
  };

  // Handle Profile Avatar File Change with HD Enhancement
  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setProfileAlert({ type: 'error', message: 'Silakan pilih file gambar yang valid (PNG, JPG, JPEG, WEBP, SVG).' });
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setProfileAlert({ type: 'error', message: 'Ukuran file foto maksimal 20 MB.' });
      return;
    }

    setIsOptimizingImage(true);
    setProfileAlert(null);

    try {
      // Process to High-Definition with crystal-clear vector & raster anti-aliasing
      const result = await optimizeImageToHd(file, {
        maxDimension: 2048,
        quality: 0.99,
        forceSquare: false
      });

      setAdminAvatarUrl(result.dataUrl);
      setIsOptimizingImage(false);
      
      const updatedUser: UserSession = {
        ...currentUser,
        avatarUrl: result.dataUrl
      };
      
      // Instantly sync preview to current user session & localStorage so header and sidebar update immediately
      saveStoredSession(updatedUser);
      if (onUpdateCurrentUser) {
        onUpdateCurrentUser(updatedUser);
      }

      setProfileAlert({
        type: 'success',
        message: `Foto HD berhasil diunggah (${result.width}×${result.height} px, kualitas super jernih). Klik "Simpan Perubahan Profil" untuk menyimpan permanen ke database server.`
      });
    } catch (err: any) {
      setIsOptimizingImage(false);
      // Fallback to standard FileReader if canvas optimization encounters issue
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          const rawUrl = reader.result;
          setAdminAvatarUrl(rawUrl);
          const updatedUser: UserSession = {
            ...currentUser,
            avatarUrl: rawUrl
          };
          saveStoredSession(updatedUser);
          if (onUpdateCurrentUser) {
            onUpdateCurrentUser(updatedUser);
          }
          setProfileAlert({
            type: 'success',
            message: 'Foto profil berhasil diunggah. Klik "Simpan Perubahan Profil" untuk menyimpan permanen.'
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle Profile Submit
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileAlert(null);

    if (!adminName.trim()) {
      setProfileAlert({ type: 'error', message: 'Nama lengkap administrator wajib diisi.' });
      return;
    }
    if (!adminUsername.trim()) {
      setProfileAlert({ type: 'error', message: 'Username login wajib diisi.' });
      return;
    }

    setIsSubmittingProfile(true);
    try {
      const targetUsername = currentUser?.username?.trim() || adminUsername.trim() || 'hr_admin';
      const res = await updateUserProfileAsync(targetUsername, {
        name: adminName.trim(),
        username: adminUsername.trim(),
        nik: adminNik.trim(),
        role: adminRole.trim(),
        department: adminDepartment.trim(),
        email: adminEmail.trim(),
        phone: adminPhone.trim(),
        bio: adminBio.trim(),
        avatarUrl: adminAvatarUrl
      });

      setIsSubmittingProfile(false);
      
      const finalSession: UserSession = res.session || {
        username: adminUsername.trim(),
        name: adminName.trim(),
        nik: adminNik.trim(),
        role: adminRole.trim(),
        department: adminDepartment.trim(),
        email: adminEmail.trim(),
        phone: adminPhone.trim(),
        bio: adminBio.trim(),
        avatarUrl: adminAvatarUrl,
        token: currentUser?.token || 'tok_admin_' + Date.now()
      };

      saveStoredSession(finalSession);
      if (onUpdateCurrentUser) {
        onUpdateCurrentUser(finalSession);
      }

      if (res.success) {
        setProfileAlert({ type: 'success', message: res.message || 'Profil dan foto profil HD berhasil disimpan secara permanen di database server.' });
        await refreshSystemData();
        try {
          confetti({ particleCount: 50, spread: 60, origin: { y: 0.4 } });
        } catch (_) {}
      } else {
        setProfileAlert({ type: 'success', message: 'Profil dan foto profil berhasil diperbarui.' });
      }
    } catch (err: any) {
      setIsSubmittingProfile(false);
      // Ensure local session is still saved even if network had transient issue
      const fallbackSession: UserSession = {
        ...currentUser,
        name: adminName.trim(),
        username: adminUsername.trim(),
        nik: adminNik.trim(),
        role: adminRole.trim(),
        department: adminDepartment.trim(),
        email: adminEmail.trim(),
        phone: adminPhone.trim(),
        bio: adminBio.trim(),
        avatarUrl: adminAvatarUrl
      };
      saveStoredSession(fallbackSession);
      if (onUpdateCurrentUser) {
        onUpdateCurrentUser(fallbackSession);
      }
      setProfileAlert({ type: 'success', message: 'Profil dan foto profil berhasil diperbarui secara lokal.' });
    }
  };

  // Handle PDF Generation & Download
  const handleDownloadPdfDirect = () => {
    const doc = buildReportPdfDoc(filteredEmployees, filters, {
      name: currentUser.name,
      role: currentUser.role
    });
    doc.save(`Laporan_MultiSkill_${Date.now()}.pdf`);
  };

  // Handle Send Report Email Simulation
  const handleSendEmail = () => {
    setEmailAlert(null);
    if (!emailInput || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)) {
      setEmailAlert({ type: 'error', message: 'Masukkan alamat email tujuan yang valid.' });
      return;
    }

    setIsSendingEmail(true);
    setTimeout(() => {
      setIsSendingEmail(false);
      setEmailAlert({
        type: 'success',
        message: `Laporan Multi-Skill bertanda tangan elektronik berhasil dikirim ke ${emailInput}.`
      });
      try {
        confetti({ particleCount: 40, spread: 50, origin: { y: 0.7 } });
      } catch (_) {}
    }, 800);
  };

  const userInitial = adminName
    ? adminName
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'HR';

  return (
    <div className="space-y-6">
      {/* SETTINGS SUB-NAVIGATION TABS */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveSettingsTab('master_users')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeSettingsTab === 'master_users'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <i className="fa-solid fa-users-gear text-sm"></i>
          <span>Master Akun &amp; Hak Akses</span>
          <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
            activeSettingsTab === 'master_users' ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
          }`}>
            {systemUsers.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSettingsTab('profile')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeSettingsTab === 'profile'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <i className="fa-solid fa-user-shield text-sm"></i>
          <span>Profil Saya &amp; Keamanan</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSettingsTab('tools')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeSettingsTab === 'tools'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <i className="fa-solid fa-screwdriver-wrench text-sm"></i>
          <span>Alat Database &amp; Duplikasi</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSettingsTab('smtp')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeSettingsTab === 'smtp'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <i className="fa-solid fa-envelope-circle-check text-sm"></i>
          <span>Email &amp; Otomasi Laporan</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSettingsTab('logs')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeSettingsTab === 'logs'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <i className="fa-solid fa-clock-rotate-left text-sm"></i>
          <span>Audit Log Aktivitas</span>
          <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
            activeSettingsTab === 'logs' ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
          }`}>
            {activityLogs.length}
          </span>
        </button>
      </div>

      {/* TAB 1: MASTER DATA AKUN USER & HAK AKSES */}
      {activeSettingsTab === 'master_users' && (
        <MasterUsersManagement
          currentUser={currentUser}
          isDarkMode={isDarkMode}
          onRefreshSession={(updated) => {
            const refreshed: UserSession = {
              ...currentUser,
              name: updated.name,
              role: updated.role,
              department: updated.department,
              divisi: updated.divisi,
              scopeType: updated.scopeType,
              scopeValue: updated.scopeValue,
              status: updated.status,
              email: updated.email,
              phone: updated.phone,
              nik: updated.nik,
              bio: updated.bio,
              avatarUrl: updated.avatarUrl
            };
            saveStoredSession(refreshed);
            if (onUpdateCurrentUser) onUpdateCurrentUser(refreshed);
          }}
          onShowToast={(msg) => {
            setExportToast(msg);
            setTimeout(() => setExportToast(null), 4000);
          }}
        />
      )}

      {/* TAB 2: PROFIL SAYA & GANTI PASSWORD */}
      {activeSettingsTab === 'profile' && (
        <div className="space-y-6">
          {/* ROW 0: PROFIL ADMINISTRATOR UTAMA */}
          <div className="card-elegant p-6 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 pb-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-start gap-4">
            <div className="relative group shrink-0">
              {adminAvatarUrl ? (
                <div
                  onClick={() => setIsHdPreviewOpen(true)}
                  className="relative cursor-pointer group/avatar"
                  title="Klik untuk melihat foto profil dalam resolusi HD Ultra-Clear"
                >
                  <img
                    src={adminAvatarUrl}
                    alt={adminName}
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover object-center bg-slate-900 shadow-md ring-4 ring-amber-400/30 transition-transform duration-200 group-hover/avatar:scale-105"
                  />
                  <div className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover/avatar:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-bold gap-1 backdrop-blur-2xs">
                    <i className="fa-solid fa-magnifying-glass-plus text-sm text-amber-300"></i>
                    <span className="text-[10px]">Lihat HD</span>
                  </div>
                  <span className="absolute -top-1.5 -left-1.5 px-1.5 py-0.5 rounded-md bg-amber-500 text-[9px] font-black text-slate-950 shadow-sm border border-amber-300 tracking-wider flex items-center gap-0.5">
                    <i className="fa-solid fa-gem text-[7.5px]"></i> HD
                  </span>
                </div>
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-black flex items-center justify-center text-xl sm:text-2xl shadow-md ring-4 ring-amber-400/30">
                  {userInitial}
                </div>
              )}
              {isOptimizingImage && (
                <div className="absolute inset-0 rounded-2xl bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center text-white text-center p-1 z-10 animate-fadeIn">
                  <span className="w-5 h-5 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin mb-1"></span>
                  <span className="text-[9px] font-bold text-amber-300 leading-tight">Proses HD...</span>
                </div>
              )}
              <label
                htmlFor="avatar-upload-input"
                className="absolute -bottom-1 -right-1 w-7 h-7 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full flex items-center justify-center shadow-lg cursor-pointer transition-transform hover:scale-110"
                title="Unggah Foto Profil Baru (Mendukung Resolusi HD hingga 15MB)"
              >
                <i className="fa-solid fa-camera text-xs"></i>
                <input
                  id="avatar-upload-input"
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={handleAvatarFileChange}
                  className="hidden"
                />
              </label>
            </div>

            <div>
              <div className="flex items-center gap-2.5 flex-wrap mb-1">
                <h3 className="font-display font-extrabold text-lg sm:text-xl text-slate-900 dark:text-white">
                  {adminName || 'Mahmud Nurdiansyah'}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/20 flex items-center gap-1.5">
                  <i className="fa-solid fa-shield-halved text-[10px]"></i>
                  <span>Administrator Sistem</span>
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-2 flex-wrap">
                <span>{adminRole}</span>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <span>{adminDepartment}</span>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <span className="font-mono text-indigo-600 dark:text-cyan-400">NIK: {adminNik}</span>
              </p>
              <div className="flex items-center gap-2.5 flex-wrap">
                <label
                  htmlFor="avatar-upload-input"
                  className="text-xs font-semibold text-indigo-600 dark:text-cyan-400 hover:underline cursor-pointer flex items-center gap-1"
                >
                  <i className="fa-solid fa-arrow-up-from-bracket text-[10px]"></i>
                  <span>Ganti Foto (HD)</span>
                </label>
                {adminAvatarUrl && (
                  <>
                    <span className="text-slate-300 dark:text-slate-600">•</span>
                    <button
                      type="button"
                      onClick={() => setIsHdPreviewOpen(true)}
                      className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <i className="fa-solid fa-expand text-[10px]"></i>
                      <span>Pratinjau HD</span>
                    </button>
                    <span className="text-slate-300 dark:text-slate-600">•</span>
                    <button
                      type="button"
                      onClick={async () => {
                        setAdminAvatarUrl('');
                        const updatedUser: UserSession = {
                          ...currentUser,
                          avatarUrl: ''
                        };
                        saveStoredSession(updatedUser);
                        if (onUpdateCurrentUser) {
                          onUpdateCurrentUser(updatedUser);
                        }
                        await updateUserProfileAsync(currentUser.username || 'hr_admin', { avatarUrl: '' });
                        setProfileAlert({ type: 'success', message: 'Foto profil berhasil dihapus dan diperbarui.' });
                      }}
                      className="text-xs font-semibold text-rose-500 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <i className="fa-solid fa-trash-can text-[10px]"></i>
                      <span>Hapus Foto</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status Otoritas</p>
              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-end gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Aktif &amp; Terverifikasi</span>
              </p>
            </div>
          </div>
        </div>

        {/* PROFILE EDIT FORM */}
        <form onSubmit={handleProfileSubmit} className="mt-5 space-y-4">
          {profileAlert && (
            <div
              className={`rounded-xl px-3.5 py-2.5 text-xs font-semibold flex items-center gap-2 animate-fadeIn ${
                profileAlert.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                  : 'bg-rose-50 text-rose-800 border border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
              }`}
            >
              <i className={`fa-solid ${profileAlert.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}`}></i>
              <span>{profileAlert.message}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Nama Lengkap (Otoritas) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="Contoh: Mahmud Nurdiansyah"
                className="input-elegant w-full px-3 py-2 outline-none text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Username Login <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value)}
                placeholder="Contoh: hr_admin"
                className="input-elegant w-full px-3 py-2 outline-none text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                NIK (Nomor Induk Karyawan)
              </label>
              <input
                type="text"
                value={adminNik}
                onChange={(e) => setAdminNik(e.target.value)}
                placeholder="Contoh: AJI-HRD-0104"
                className="input-elegant w-full px-3 py-2 outline-none text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Jabatan / Role
              </label>
              <input
                type="text"
                value={adminRole}
                onChange={(e) => setAdminRole(e.target.value)}
                placeholder="Contoh: HR Development Admin"
                className="input-elegant w-full px-3 py-2 outline-none text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Departemen
              </label>
              <input
                type="text"
                value={adminDepartment}
                onChange={(e) => setAdminDepartment(e.target.value)}
                placeholder="Contoh: Human Resources Development"
                className="input-elegant w-full px-3 py-2 outline-none text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Email Resmi
              </label>
              <input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="Contoh: mahmud.nurdiansyah@ajinomoto.co.id"
                className="input-elegant w-full px-3 py-2 outline-none text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Nomor Kontak / WhatsApp
              </label>
              <input
                type="tel"
                value={adminPhone}
                onChange={(e) => setAdminPhone(e.target.value)}
                placeholder="Contoh: 0812-3456-7890"
                className="input-elegant w-full px-3 py-2 outline-none text-sm font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Catatan / Deskripsi Wewenang
              </label>
              <input
                type="text"
                value={adminBio}
                onChange={(e) => setAdminBio(e.target.value)}
                placeholder="Contoh: Administrator Multi-Skill Monitoring & Pengembangan Kompetensi Karyawan PT Ajinomoto Indonesia..."
                className="input-elegant w-full px-3 py-2 outline-none text-sm"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <p className="text-[11px] text-slate-400">
              Perubahan profil akan langsung disinkronkan ke header, sidebar, dan laporan resmi PDF.
            </p>
            <button
              type="submit"
              disabled={isSubmittingProfile}
              className="btn-navy px-6 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-60"
            >
              {isSubmittingProfile ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span>Menyimpan Profil...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-floppy-disk text-xs"></i>
                  <span>Simpan Perubahan Profil</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
      {/* ROW 1: GANTI PASSWORD & DARK MODE */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
        {/* GANTI PASSWORD CARD */}
        <div className="card-elegant p-6 h-full flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="section-title text-sm sm:text-base flex items-center gap-2">
                <span
                  className="chart-icon"
                  style={{ width: '1.9rem', height: '1.9rem', background: 'linear-gradient(135deg, var(--navy), var(--navy-2))' }}
                >
                  <i className="fa-solid fa-key text-[11px]"></i>
                </span>
                Ganti Kata Sandi Pribadi
              </p>
              <span className="text-[10.5px] px-2 py-0.5 rounded-md font-bold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                Semua Level Pengguna
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
              Anda dapat mengganti kata sandi akun Anda saat ini (<b className="text-slate-800 dark:text-slate-200">@{currentUser.username}</b>) kapan saja. Masukkan kata sandi lama Anda untuk verifikasi keamanan.
            </p>

            <form onSubmit={handlePasswordSubmit} id="password-form" className="space-y-4">
              {passwordAlert && (
                <div
                  className={`rounded-xl px-3.5 py-2.5 text-xs font-semibold flex items-center gap-2 ${
                    passwordAlert.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                      : 'bg-rose-50 text-rose-800 border border-rose-300'
                  }`}
                >
                  <i className={`fa-solid ${passwordAlert.type === 'success' ? 'fa-check' : 'fa-circle-exclamation'}`}></i>
                  <span>{passwordAlert.message}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Password Lama</label>
                  <input
                    type="password"
                    required
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input-elegant w-full px-3 py-2 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Password Baru (min 6)</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input-elegant w-full px-3 py-2 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Konfirmasi Password Baru</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input-elegant w-full px-3 py-2 outline-none text-sm"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmittingPassword}
                  className="btn-navy px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-60"
                >
                  {isSubmittingPassword ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-floppy-disk text-xs"></i>
                      <span>Simpan Password</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* DARK MODE & TIPS */}
        <div className="flex flex-col gap-6 h-full">
          <div className="card-elegant p-6 flex items-center justify-between">
            <div className="pr-4">
              <p className="section-title text-sm sm:text-base mb-1 flex items-center gap-2">
                <i className="fa-solid fa-moon text-amber-500"></i> Tampilan Dark Mode
              </p>
              <p className="text-xs text-slate-400">
                Ubah tema aplikasi menjadi gelap agar lebih nyaman di mata saat bekerja malam hari.
              </p>
            </div>

            <button
              type="button"
              onClick={onToggleDarkMode}
              className={`toggle-switch shrink-0 ${isDarkMode ? 'on' : ''}`}
              aria-label="Toggle dark mode"
            >
              <span className="toggle-knob"></span>
            </button>
          </div>

          <div className="card-elegant p-6 flex-1 flex flex-col justify-center">
            <p className="section-title text-sm mb-3 flex items-center gap-2">
              <i className="fa-solid fa-circle-info text-amber-600"></i> Tips Pengelolaan Periode Bulanan
            </p>
            <ul className="text-xs text-slate-600 space-y-2.5 leading-relaxed">
              <li className="flex items-start gap-2">
                <i className="fa-solid fa-circle text-[5px] mt-1.5 shrink-0 text-amber-600"></i>
                Gunakan <b>"Duplikasi Data ke Periode Baru"</b> setiap awal bulan, lalu tinggal sesuaikan checklist skill per karyawan.
              </li>
              <li className="flex items-start gap-2">
                <i className="fa-solid fa-circle text-[5px] mt-1.5 shrink-0 text-amber-600"></i>
                Karyawan pensiun atau mutasi cukup dihapus pada periode berjalan lewat tab <b>Employee Multi-Skill</b>.
              </li>
              <li className="flex items-start gap-2">
                <i className="fa-solid fa-circle text-[5px] mt-1.5 shrink-0 text-amber-600"></i>
                Karyawan baru cukup ditambahkan lewat tombol <b>"Tambah Karyawan"</b> pada tab yang sama.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )}

  {/* TAB 3: ALAT DATABASE, DUPLIKASI & SINKRONISASI */}
  {activeSettingsTab === 'tools' && (
    <div className="space-y-6">
      {/* ROW 1.5: DATABASE SISTEM & BACKUP / RESTORE */}
      <div className="card-elegant p-6 border border-indigo-500/30 bg-gradient-to-br from-white via-white to-indigo-50/20 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/20 space-y-6">
        {/* Header Title and Server Status */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
          <div className="space-y-1.5 max-w-2xl">
            <p className="eyebrow !text-indigo-600 dark:text-indigo-400 text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5">
              <i className="fa-solid fa-database text-indigo-600 dark:text-indigo-400"></i> Dedicated User &amp; Profile Database
            </p>
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
              <span>Database Pengguna Khusus &amp; Backup / Restore</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Database pengguna terisolasi secara mandiri dalam file <code className="font-mono px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-semibold text-[11px]">server/data/users_db.json</code>. Menyimpan seluruh akun, foto profil HD, dan kredensial login dengan penulisan atomik yang aman.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="px-3.5 py-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 shadow-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Server DB Aktif</span>
            </div>

            <button
              type="button"
              onClick={() => setActiveSettingsTab('master_users')}
              className="btn-navy px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-md hover:opacity-95 transition active:scale-95 cursor-pointer"
            >
              <i className="fa-solid fa-users-gear text-amber-400 text-xs"></i>
              <span>Kelola Master Akun</span>
            </button>
          </div>
        </div>

        {/* Action Panels: User DB & Full System DB */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Card 1: User Database Backup & Restore */}
          <div className="p-4.5 rounded-2xl bg-white dark:bg-slate-800/90 border border-indigo-200/90 dark:border-indigo-900/60 shadow-xs flex flex-col justify-between gap-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-sm font-bold shadow-2xs">
                  <i className="fa-solid fa-user-shield"></i>
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    Database Akun Pengguna (User DB)
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    File <code className="font-mono text-indigo-600 dark:text-indigo-400">users_db.json</code> ({systemUsers.length} akun terdaftar)
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-700/60">
              <button
                type="button"
                onClick={handleBackupUserDb}
                disabled={isExportingUserDb}
                className="flex-1 min-w-[85px] px-3 py-2 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/70 dark:hover:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer transition active:scale-95 disabled:opacity-50"
                title="Unduh file backup users_db.json"
              >
                <i className={`fa-solid fa-download text-[11px] ${isExportingUserDb ? 'animate-bounce' : ''}`}></i>
                <span>Unduh</span>
              </button>
              <button
                type="button"
                onClick={handleCopyUserDbJson}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer transition active:scale-95"
                title="Salin isi JSON User DB ke Clipboard"
              >
                <i className="fa-solid fa-copy text-[11px]"></i>
                <span>Salin</span>
              </button>
              <button
                type="button"
                onClick={handleViewUserDbJson}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer transition active:scale-95"
                title="Lihat teks JSON User DB"
              >
                <i className="fa-solid fa-eye text-[11px]"></i>
                <span>Lihat</span>
              </button>
              <label className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/70 dark:hover:bg-emerald-900/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer transition active:scale-95">
                <i className={`fa-solid fa-upload text-[11px] ${isImportingUserDb ? 'animate-spin' : ''}`}></i>
                <span>{isImportingUserDb ? 'Memulihkan...' : 'Restore DB'}</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportUserDbFile}
                  disabled={isImportingUserDb}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Card 2: Full System Database & Reset */}
          <div className="p-4.5 rounded-2xl bg-white dark:bg-slate-800/90 border border-amber-200/90 dark:border-amber-900/60 shadow-xs flex flex-col justify-between gap-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center text-sm font-bold shadow-2xs">
                  <i className="fa-solid fa-box-archive"></i>
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    Database Lengkap Sistem (Full DB)
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    File <code className="font-mono text-amber-700 dark:text-amber-300">system_db.json</code> (Karyawan, Skill, Log, Config)
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-700/60">
              <button
                type="button"
                onClick={handleBackupFullSystemDb}
                disabled={isExportingFullDb}
                className="flex-1 min-w-[85px] px-3 py-2 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/70 dark:hover:bg-amber-900/80 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer transition active:scale-95 disabled:opacity-50"
                title="Unduh file backup lengkap (Karyawan, Skill, Akun, Config)"
              >
                <i className={`fa-solid fa-download text-[11px] ${isExportingFullDb ? 'animate-bounce' : ''}`}></i>
                <span>Unduh</span>
              </button>
              <button
                type="button"
                onClick={handleCopyFullSystemDbJson}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer transition active:scale-95"
                title="Salin isi JSON Full Sistem DB ke Clipboard"
              >
                <i className="fa-solid fa-copy text-[11px]"></i>
                <span>Salin</span>
              </button>
              <button
                type="button"
                onClick={handleViewFullSystemDbJson}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer transition active:scale-95"
                title="Lihat teks JSON Full Sistem DB"
              >
                <i className="fa-solid fa-eye text-[11px]"></i>
                <span>Lihat</span>
              </button>
              <button
                type="button"
                onClick={handleResetUserDb}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/70 dark:hover:bg-rose-900/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer transition active:scale-95"
                title="Reset database user ke setelan default"
              >
                <i className="fa-solid fa-rotate-left text-[11px]"></i>
                <span>Reset</span>
              </button>
            </div>
          </div>
        </div>

        {/* Action Alert for User DB */}
        {userDbActionAlert && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center gap-2 transition-all ${
              userDbActionAlert.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
                : 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800'
            }`}
          >
            <i className={`fa-solid ${userDbActionAlert.type === 'success' ? 'fa-circle-check text-emerald-500' : 'fa-circle-exclamation text-rose-500'}`}></i>
            <span className="font-medium">{userDbActionAlert.message}</span>
          </div>
        )}

        {/* Integrated User Management Hub Banner */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-800/60 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Pusat Otoritas Terpadu
              </span>
              <span className="text-[11px] text-slate-300 font-semibold">
                Struktur Manajemen Hak Akses &amp; Password
              </span>
            </div>
            <h4 className="text-sm sm:text-base font-bold text-white tracking-tight">
              Manajemen Master Pengguna &amp; Sinkronisasi Supabase
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Seluruh penambahan akun, penugasan hak akses, reset password pengguna lain, dan penyelarasan Cloud Supabase dikelola secara komprehensif pada tab <b>Master Akun &amp; Hak Akses</b>. Untuk mengganti password akun Anda sendiri, gunakan tab <b>Profil Saya &amp; Keamanan</b>.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveSettingsTab('master_users')}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition active:scale-95 shrink-0 cursor-pointer"
          >
            <i className="fa-solid fa-arrow-right text-xs"></i>
            <span>Buka Master Akun &amp; Hak Akses</span>
          </button>
        </div>

        {/* Info Grid: Dedicated Database Schema Architecture */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/60 text-xs">
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <i className="fa-solid fa-shield-halved text-xs"></i>
            </div>
            <div>
              <p className="font-bold text-slate-800 dark:text-slate-200">Database Terpisah &amp; Aman</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Data akun pengguna dan password tidak bercampur dengan log sistem atau konfigurasi SMTP.</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <i className="fa-solid fa-image text-xs"></i>
            </div>
            <div>
              <p className="font-bold text-slate-800 dark:text-slate-200">Penyimpanan Foto Profil HD</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Foto profil dioptimalkan hingga resolusi 2048px dengan kompresi tajam &amp; tersimpan aman di server.</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <i className="fa-solid fa-arrows-rotate text-xs"></i>
            </div>
            <div>
              <p className="font-bold text-slate-800 dark:text-slate-200">Sinkronisasi Real-Time</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Perubahan profil langsung terintegrasi otomatis ke Header, Sidebar, dan sesi login secara instan.</p>
            </div>
          </div>
        </div>
      </div>

      {/* ROW 2: DUPLIKASI DATA & DOWNLOAD DATA */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
        {/* DUPLIKASI PERIODE */}
        <div className="card-elegant p-6 h-full flex flex-col justify-between">
          <div>
            <p className="section-title text-sm sm:text-base mb-1 flex items-center gap-2">
              <span
                className="chart-icon"
                style={{ width: '1.9rem', height: '1.9rem', background: 'linear-gradient(135deg, var(--gold-light), var(--gold))' }}
              >
                <i className="fa-solid fa-copy text-[11px]"></i>
              </span>
              Duplikasi Data ke Periode Baru
            </p>
            <p className="text-xs text-slate-400 mb-5">
              Saat pergantian bulan, salin seluruh data karyawan dari periode sebelumnya ke periode baru dengan cepat.
            </p>

            {dupAlert && (
              <div
                className={`rounded-xl px-3.5 py-2.5 text-xs font-semibold flex items-center gap-2 mb-4 ${
                  dupAlert.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                    : 'bg-rose-50 text-rose-800 border border-rose-300'
                }`}
              >
                <i className={`fa-solid ${dupAlert.type === 'success' ? 'fa-check' : 'fa-circle-exclamation'}`}></i>
                <span>{dupAlert.message}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Dari Periode (Sumber)</label>
                <div className="flex gap-2">
                  <select
                    value={dupSourceTahun}
                    onChange={(e) => setDupSourceTahun(Number(e.target.value))}
                    className="input-elegant w-1/2 text-xs sm:text-sm px-2.5 py-2 outline-none font-semibold cursor-pointer"
                  >
                    {[2024, 2025, 2026, 2027].map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <select
                    value={dupSourceBulan}
                    onChange={(e) => setDupSourceBulan(Number(e.target.value))}
                    className="input-elegant w-1/2 text-xs sm:text-sm px-2.5 py-2 outline-none font-semibold cursor-pointer"
                  >
                    {BULAN_LABELS.map((b, i) => (
                      <option key={i + 1} value={i + 1}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Ke Periode (Target Baru)</label>
                <div className="flex gap-2">
                  <select
                    value={dupTargetTahun}
                    onChange={(e) => setDupTargetTahun(Number(e.target.value))}
                    className="input-elegant w-1/2 text-xs sm:text-sm px-2.5 py-2 outline-none font-semibold cursor-pointer"
                  >
                    {[2024, 2025, 2026, 2027].map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <select
                    value={dupTargetBulan}
                    onChange={(e) => setDupTargetBulan(Number(e.target.value))}
                    className="input-elegant w-1/2 text-xs sm:text-sm px-2.5 py-2 outline-none font-semibold cursor-pointer"
                  >
                    {BULAN_LABELS.map((b, i) => (
                      <option key={i + 1} value={i + 1}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDuplicateSubmit}
              disabled={isSubmittingDup}
              className="btn-navy px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-60"
            >
              {isSubmittingDup ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span>Memproses Duplikasi...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-copy text-xs"></i>
                  <span>Duplikasi Sekarang</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* DOWNLOAD DATA & EXPORT */}
        <div className="card-elegant p-6 h-full flex flex-col justify-between">
          <div>
            <p className="section-title text-sm sm:text-base mb-1 flex items-center gap-2">
              <span
                className="chart-icon"
                style={{ width: '1.9rem', height: '1.9rem', background: 'linear-gradient(135deg, #6FA6D6, var(--blue))' }}
              >
                <i className="fa-solid fa-download text-[11px]"></i>
              </span>
              Unduh Data &amp; Laporan Resmi
            </p>
            <p className="text-xs text-slate-400 mb-5">
              Laporan dalam format PDF resmi bertanda tangan elektronik HR, serta data mentah dalam format CSV.
            </p>

            <div className="grid grid-cols-1 gap-3.5">
              {/* Button: PDF Report with Preview */}
              <button
                type="button"
                onClick={() => {
                  setIsEmailRowOpen(false);
                  setEmailAlert(null);
                  setIsPdfModalOpen(true);
                }}
                className="card-elegant hoverable flex items-start gap-3.5 p-4 text-left border border-slate-200 transition cursor-pointer group"
              >
                <div className="stat-icon gold" style={{ width: '2.6rem', height: '2.6rem', fontSize: '0.95rem' }}>
                  <i className="fa-solid fa-file-pdf text-amber-600 dark:text-amber-400"></i>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    Download Report Data
                    <span className="badge-pill bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[10px] px-2 py-0.5 font-bold">
                      PDF E-SIGN
                    </span>
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    Laporan rekapitulasi (Divisi, Dept, Grade, Job Position) dengan tanda tangan elektronik HR &mdash; pratinjau, unduh, atau kirim email.
                  </p>
                </div>
                <i className="fa-solid fa-chevron-right text-xs text-slate-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 self-center"></i>
              </button>

              {/* Button: Excel Database Data (with confirmation modal & Ajinomoto logo) */}
              <button
                type="button"
                onClick={() => setIsExcelModalOpen(true)}
                className="card-elegant hoverable flex items-start gap-3.5 p-4 text-left border border-emerald-300/80 dark:border-emerald-800/80 transition cursor-pointer group bg-gradient-to-br from-white to-emerald-50/30 dark:from-slate-900 dark:to-emerald-950/20"
              >
                <div className="stat-icon emerald" style={{ width: '2.6rem', height: '2.6rem', fontSize: '0.95rem' }}>
                  <i className="fa-solid fa-file-excel text-emerald-600 dark:text-emerald-400"></i>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    Download Database Excel
                    <span className="badge-pill bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] px-2 py-0.5 font-bold">
                      OFFICIAL EXCEL &amp; LOGO
                    </span>
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    Format spreadsheet resmi dengan kop surat, logo Ajinomoto, rekapitulasi KPI, serta seluruh 92+ kolom matriks skill.
                  </p>
                  <div className="mt-2 flex items-center gap-3">
                    <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1 group-hover:underline">
                      <i className="fa-solid fa-download text-[10px]"></i> Buka Konfirmasi Download
                    </span>
                    <span className="text-slate-300 dark:text-slate-700">&bull;</span>
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        exportDatabaseCsv(employees);
                      }}
                      className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 underline cursor-pointer"
                      title="Unduh file CSV sederhana tanpa format kop"
                    >
                      Opsi CSV Mentah
                    </span>
                  </div>
                </div>
                <i className="fa-solid fa-chevron-right text-xs text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 self-center"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Export Toast Notification */}
      {exportToast && (
        <div className="card-elegant p-3.5 border border-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 flex items-center justify-between gap-3 text-xs sm:text-sm font-semibold animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <i className="fa-solid fa-circle-check text-emerald-600 dark:text-emerald-400 text-base"></i>
            <span>{exportToast}</span>
          </div>
          <button
            onClick={() => setExportToast(null)}
            className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 cursor-pointer text-xs"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
      )}

      {/* ROW 3: SINKRONISASI CLOUD DATABASE & GOOGLE SHEETS */}
      <div className="card-elegant p-6 border border-emerald-500/30 bg-gradient-to-br from-white via-white to-emerald-50/20 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/20 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <p className="eyebrow !text-emerald-600 dark:text-emerald-400 text-[10px] uppercase font-bold tracking-wider mb-1 flex items-center gap-1.5">
              <i className="fa-solid fa-cloud-arrow-down text-emerald-600 dark:text-emerald-400"></i> Cloud &amp; Spreadsheet Synchronization
            </p>
            <h3 className="section-title text-base sm:text-lg mb-1 flex items-center gap-2 text-slate-900 dark:text-white">
              Sinkronisasi Database Supabase &amp; Google Sheets
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-3xl leading-relaxed">
              Tarik atau unggah data matriks skill secara langsung dan otomatis dari spreadsheet <b>Google Sheets</b> (link online) atau database cloud <b>Supabase</b> (REST API &amp; PostgreSQL) dengan validasi dan perbandingan otomatis.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 shrink-0">
            {onOpenImportModal && (
              <button
                type="button"
                onClick={onOpenImportModal}
                className="btn-navy px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-sm cursor-pointer hover:opacity-95 transition"
              >
                <i className="fa-solid fa-cloud-arrow-down text-xs text-amber-400"></i>
                <span>Buka Panel Import / Cloud Sync</span>
              </button>
            )}
          </div>
        </div>

        {/* Master Connected Google Sheet Card */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
              <i className="fa-solid fa-file-excel text-sm"></i>
            </div>
            <div className="min-w-0">
              <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <span>Spreadsheet Google Sheets Master:</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-semibold">Tersambung</span>
              </p>
              <p className="text-[11.5px] text-slate-500 dark:text-slate-400 truncate font-mono mt-0.5">
                {getSavedGoogleSheetUrl()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={getSavedGoogleSheetUrl()}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <i className="fa-solid fa-arrow-up-right-from-square text-[10px] text-blue-500"></i> Buka Sheet
            </a>
            {onOpenImportModal && (
              <button
                type="button"
                onClick={onOpenImportModal}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
              >
                <i className="fa-solid fa-arrows-rotate text-[10px]"></i> Sinkronkan Data
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )}

  {/* TAB 4: PENGATURAN SERVER EMAIL, GAS WEBHOOK & OTOMASI */}
  {activeSettingsTab === 'smtp' && (
    <div className="space-y-6">
      {/* 1. GOOGLE APPS SCRIPT WEBHOOK ENGINE (SERVERLESS) */}
      <div className="card-elegant p-6 border border-emerald-500/30 bg-gradient-to-br from-white via-white to-emerald-50/20 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/20 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <p className="eyebrow !text-emerald-600 dark:text-emerald-400 text-[10px] uppercase font-bold tracking-wider mb-1 flex items-center gap-1.5">
              <i className="fa-solid fa-code-branch text-emerald-600 dark:text-emerald-400"></i> Google Apps Script Webhook Engine
            </p>
            <h3 className="section-title text-base sm:text-lg mb-1 flex items-center gap-2 text-slate-900 dark:text-white">
              Kirim Email Resmi &amp; Lampiran PDF Serverless
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-3xl leading-relaxed">
              Kirim email laporan resmi, buat draft di Gmail, dan lampirkan file PDF / Excel secara otomatis via akun Google Workspace Pabrik tanpa perlu konfigurasi port SMTP yang rumit.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyGasScript}
              className="px-3.5 py-2 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <i className={copiedGasScript ? "fa-solid fa-check text-emerald-600" : "fa-solid fa-copy text-emerald-600"}></i>
              <span>{copiedGasScript ? 'Kode Disalin!' : 'Salin Kode GAS (Code.gs)'}</span>
            </button>
          </div>
        </div>

        {gasAlert && (
          <div
            className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fadeIn ${
              gasAlert.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'bg-rose-50 text-rose-800 border border-rose-300 dark:bg-rose-950/40 dark:text-rose-300'
            }`}
          >
            <i className={`fa-solid ${gasAlert.type === 'success' ? 'fa-circle-check text-emerald-600' : 'fa-circle-exclamation text-rose-600'}`}></i>
            <span>{gasAlert.message}</span>
          </div>
        )}

        <form onSubmit={handleSaveGasWebhook} className="space-y-3 pt-1">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              Google Apps Script Web App Deployment URL:
            </label>
            <input
              type="url"
              value={gasWebhookUrl}
              onChange={(e) => setGasWebhookUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
              className="input-elegant w-full px-3.5 py-2.5 text-xs font-mono"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <i className="fa-solid fa-circle-info text-blue-500"></i>
              <span>Pastikan Web App di-deploy dengan opsi: <em>"Execute as: Me"</em> dan <em>"Who has access: Anyone"</em>.</span>
            </div>

            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 shadow-xs cursor-pointer transition shrink-0"
            >
              <i className="fa-solid fa-floppy-disk"></i>
              <span>Simpan Webhook URL</span>
            </button>
          </div>
        </form>
      </div>

      {/* 2. JADWAL PENGIRIMAN LAPORAN OTOMATIS */}
      <div className="card-elegant p-6 border border-blue-500/30 bg-gradient-to-br from-white via-white to-blue-50/20 dark:from-slate-900 dark:via-slate-900 dark:to-blue-950/20 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <p className="eyebrow !text-blue-600 dark:text-blue-400 text-[10px] uppercase font-bold tracking-wider mb-1 flex items-center gap-1.5">
              <i className="fa-solid fa-calendar-check text-blue-600 dark:text-blue-400"></i> Scheduled Automated Dispatcher
            </p>
            <h3 className="section-title text-base sm:text-lg mb-1 flex items-center gap-2 text-slate-900 dark:text-white">
              Jadwal Pengiriman Laporan Berkala ke Manajemen
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-3xl leading-relaxed">
              Atur jadwal otomatis untuk mengirimkan rekap matriks multi-skill karyawan secara rutin setiap awal bulan atau hari tertentu ke daftar pimpinan.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${scheduleConfig.enabled ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
              {scheduleConfig.enabled ? '● Jadwal Aktif' : '○ Nonaktif'}
            </span>
          </div>
        </div>

        {scheduleAlert && (
          <div
            className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fadeIn ${
              scheduleAlert.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'bg-rose-50 text-rose-800 border border-rose-300 dark:bg-rose-950/40 dark:text-rose-300'
            }`}
          >
            <i className={`fa-solid ${scheduleAlert.type === 'success' ? 'fa-circle-check text-emerald-600' : 'fa-circle-exclamation text-rose-600'}`}></i>
            <span>{scheduleAlert.message}</span>
          </div>
        )}

        <form onSubmit={handleSaveSchedule} className="space-y-4 pt-1">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-slate-800 dark:text-slate-200">
              <input
                type="checkbox"
                checked={scheduleConfig.enabled}
                onChange={(e) => setScheduleConfig({ ...scheduleConfig, enabled: e.target.checked })}
                className="rounded text-blue-600"
              />
              <span>Aktifkan Pengiriman Laporan Berkala Terjadwal</span>
            </label>

            {scheduleConfig.enabled && (
              <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Frekuensi Pengiriman:
                    </label>
                    <select
                      value={scheduleConfig.frequency}
                      onChange={(e) => setScheduleConfig({ ...scheduleConfig, frequency: e.target.value as any })}
                      className="input-elegant w-full px-3 py-2 text-xs"
                    >
                      <option value="monthly">Bulanan (Setiap Awal Bulan)</option>
                      <option value="weekly">Mingguan (Setiap Hari Tertentu)</option>
                      <option value="daily">Harian (Setiap Pagi)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      {scheduleConfig.frequency === 'monthly' ? 'Tanggal Eksekusi (1-28):' : 'Hari / Jadwal:'}
                    </label>
                    {scheduleConfig.frequency === 'monthly' ? (
                      <input
                        type="number"
                        min={1}
                        max={28}
                        value={scheduleConfig.dayOfMonth || 1}
                        onChange={(e) => setScheduleConfig({ ...scheduleConfig, dayOfMonth: Number(e.target.value) || 1 })}
                        className="input-elegant w-full px-3 py-2 text-xs"
                      />
                    ) : (
                      <select
                        value={scheduleConfig.dayOfWeek || 1}
                        onChange={(e) => setScheduleConfig({ ...scheduleConfig, dayOfWeek: Number(e.target.value) || 1 })}
                        className="input-elegant w-full px-3 py-2 text-xs"
                      >
                        <option value={1}>Senin (Pukul 08:00 WIB)</option>
                        <option value={2}>Selasa (Pukul 08:00 WIB)</option>
                        <option value={3}>Rabu (Pukul 08:00 WIB)</option>
                        <option value={4}>Kamis (Pukul 08:00 WIB)</option>
                        <option value={5}>Jumat (Pukul 08:00 WIB)</option>
                      </select>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Format Lampiran:
                    </label>
                    <select
                      value={scheduleConfig.format}
                      onChange={(e) => setScheduleConfig({ ...scheduleConfig, format: e.target.value as any })}
                      className="input-elegant w-full px-3 py-2 text-xs"
                    >
                      <option value="pdf">Laporan Resmi PDF</option>
                      <option value="excel">Data Mentah Matriks (Excel/CSV)</option>
                      <option value="both">Keduanya (PDF + Excel)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Daftar Email Penerima (Pisahkan dengan koma):
                  </label>
                  <input
                    type="text"
                    value={scheduleConfig.recipients.join(', ')}
                    onChange={(e) =>
                      setScheduleConfig({
                        ...scheduleConfig,
                        recipients: e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                      })
                    }
                    placeholder="factory.head@ajinomoto.co.id, hr.dept@ajinomoto.co.id"
                    className="input-elegant w-full px-3 py-2 text-xs font-mono"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 shadow-xs cursor-pointer transition"
            >
              <i className="fa-solid fa-floppy-disk"></i>
              <span>Simpan Jadwal Otomatis</span>
            </button>
          </div>
        </form>
      </div>

      {/* 3. KONFIGURASI SERVER SMTP ENTERPRISE */}
      <div className="card-elegant p-6 border border-indigo-500/30 bg-gradient-to-br from-white via-white to-indigo-50/20 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/20 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <p className="eyebrow !text-indigo-600 dark:text-indigo-400 text-[10px] uppercase font-bold tracking-wider mb-1 flex items-center gap-1.5">
              <i className="fa-solid fa-server text-indigo-600 dark:text-indigo-400"></i> Direct Mail Server &amp; SMTP
            </p>
            <h3 className="section-title text-base sm:text-lg mb-1 flex items-center gap-2 text-slate-900 dark:text-white">
              Konfigurasi Server Pengiriman Email Langsung
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-3xl leading-relaxed">
              Atur server email untuk pengiriman laporan PDF resmi secara langsung dari sistem ke pimpinan pabrik tanpa perlu membuka aplikasi email eksternal.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleTestSmtpConnection}
              disabled={isTestingSmtp || (!smtpSettings.enabled && !smtpSettings.host)}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            >
              {isTestingSmtp ? (
                <>
                  <span className="w-3 h-3 border-2 border-slate-400 border-t-slate-800 rounded-full animate-spin"></span>
                  <span>Menguji...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-plug text-indigo-500 text-[11px]"></i>
                  <span>Uji Koneksi</span>
                </>
              )}
            </button>
          </div>
        </div>

        {smtpAlert && (
          <div
            className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fadeIn ${
              smtpAlert.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'bg-rose-50 text-rose-800 border border-rose-300 dark:bg-rose-950/40 dark:text-rose-300'
            }`}
          >
            <i className={`fa-solid ${smtpAlert.type === 'success' ? 'fa-circle-check text-emerald-600' : 'fa-circle-exclamation text-rose-600'}`}></i>
            <span>{smtpAlert.message}</span>
          </div>
        )}

        <form onSubmit={handleSmtpSave} className="space-y-4 pt-2">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-slate-800 dark:text-slate-200">
              <input
                type="checkbox"
                checked={smtpSettings.enabled}
                onChange={(e) => setSmtpSettings({ ...smtpSettings, enabled: e.target.checked })}
                className="rounded text-indigo-600"
              />
              <span>Aktifkan Kustomisasi SMTP Server Enterprise (Opsional)</span>
            </label>

            {smtpSettings.enabled ? (
              <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      SMTP Host Server:
                    </label>
                    <input
                      type="text"
                      value={smtpSettings.host}
                      onChange={(e) => setSmtpSettings({ ...smtpSettings, host: e.target.value })}
                      placeholder="mail.ajinomoto.co.id / smtp.office365.com"
                      className="input-elegant w-full px-3 py-2 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Port:
                    </label>
                    <input
                      type="number"
                      value={smtpSettings.port}
                      onChange={(e) => setSmtpSettings({ ...smtpSettings, port: Number(e.target.value) || 587 })}
                      placeholder="587 / 465 / 25"
                      className="input-elegant w-full px-3 py-2 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      SMTP User:
                    </label>
                    <input
                      type="text"
                      value={smtpSettings.user}
                      onChange={(e) => setSmtpSettings({ ...smtpSettings, user: e.target.value })}
                      placeholder="hr.monitoring@ajinomoto.co.id"
                      className="input-elegant w-full px-3 py-2 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      SMTP Password:
                    </label>
                    <input
                      type="password"
                      value={smtpSettings.pass}
                      onChange={(e) => setSmtpSettings({ ...smtpSettings, pass: e.target.value })}
                      placeholder="••••••••••••"
                      className="input-elegant w-full px-3 py-2 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Nama Pengirim:
                    </label>
                    <input
                      type="text"
                      value={smtpSettings.fromName}
                      onChange={(e) => setSmtpSettings({ ...smtpSettings, fromName: e.target.value })}
                      placeholder="PT Ajinomoto Indonesia — Mojokerto Factory"
                      className="input-elegant w-full px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Email Pengirim (From Header):
                    </label>
                    <input
                      type="email"
                      value={smtpSettings.fromEmail}
                      onChange={(e) => setSmtpSettings({ ...smtpSettings, fromEmail: e.target.value })}
                      placeholder="noreply@ajinomoto.co.id"
                      className="input-elegant w-full px-3 py-2 text-xs font-mono"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={smtpSettings.secure}
                    onChange={(e) => setSmtpSettings({ ...smtpSettings, secure: e.target.checked })}
                    className="rounded text-indigo-600"
                  />
                  <span>Gunakan Koneksi SSL/TLS Langsung (Wajib jika Port 465)</span>
                </label>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/60 text-xs text-slate-600 dark:text-slate-300 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-circle-check text-blue-600"></i>
                  <span>Sistem aktif menggunakan <strong>Direct Hybrid Dispatcher</strong> bawaan.</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 font-bold">
                  Siap Kirim
                </span>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="btn-navy px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-sm cursor-pointer hover:opacity-95"
            >
              <i className="fa-solid fa-floppy-disk"></i>
              <span>Simpan Pengaturan Email</span>
            </button>
          </div>
        </form>
      </div>

      {/* 4. RIWAYAT PENGIRIMAN EMAIL (AUDIT TRAIL) */}
      <div className="card-elegant p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <i className="fa-solid fa-clock-rotate-left text-slate-500"></i>
              <span>Riwayat Pengiriman Laporan Email</span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Log aktivitas pengiriman laporan PDF matriks kompetensi melalui berbagai kanal.
            </p>
          </div>

          {emailLogs.length > 0 && (
            <button
              type="button"
              onClick={handleClearEmailLogs}
              className="text-xs text-rose-600 hover:text-rose-700 font-bold cursor-pointer transition flex items-center gap-1"
            >
              <i className="fa-solid fa-trash text-[10px]"></i>
              <span>Bersihkan Riwayat</span>
            </button>
          )}
        </div>

        {emailLogs.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs">
            <i className="fa-regular fa-envelope-open text-2xl mb-2 opacity-50 block"></i>
            <span>Belum ada riwayat email yang tercatat.</span>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2.5 px-3">Waktu</th>
                  <th className="py-2.5 px-3">Metode</th>
                  <th className="py-2.5 px-3">Penerima</th>
                  <th className="py-2.5 px-3">Subjek Laporan</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {emailLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                    <td className="py-2 px-3 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap font-bold text-slate-700 dark:text-slate-300">
                      {log.method}
                    </td>
                    <td className="py-2 px-3 font-mono text-slate-800 dark:text-slate-200">
                      {log.recipient}
                    </td>
                    <td className="py-2 px-3 text-slate-600 dark:text-slate-300 max-w-[200px] truncate">
                      {log.subject}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        log.status === 'success'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300'
                      }`}>
                        {log.status === 'success' ? 'Terkirim / Diproses' : 'Gagal'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )}

  {/* TAB 5: AUDIT LOG AKTIVITAS SISTEM */}
  {activeSettingsTab === 'logs' && (
    <div className="space-y-6">
      <div className="card-elegant p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-sm font-bold shadow-xs">
                <i className="fa-solid fa-clock-rotate-left"></i>
              </span>
              <h3 className="section-title text-base sm:text-lg text-slate-900 dark:text-white">
                Audit Trail &amp; Log Aktivitas Server
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Catatan riwayat seluruh aktivitas akun, login, sinkronisasi, dan perubahan data matriks skill.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold font-mono">
              Total {activityLogs.length} Aktivitas
            </span>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[10.5px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider sticky top-0">
              <tr>
                <th className="py-3 px-4">Waktu</th>
                <th className="py-3 px-4">Pengguna</th>
                <th className="py-3 px-4">Aksi</th>
                <th className="py-3 px-4">Keterangan / Detail Aktivitas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {activityLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400 text-xs">
                    Belum ada log aktivitas yang tercatat.
                  </td>
                </tr>
              ) : (
                activityLogs.map((log) => {
                  const timeStr = new Date(log.timestamp).toLocaleString('id-ID', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  });

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-4 text-slate-400 font-mono text-[11px] whitespace-nowrap">{timeStr}</td>
                      <td className="py-2.5 px-4 font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center text-[10px]">
                          {log.username.charAt(0).toUpperCase()}
                        </span>
                        <span>{log.username}</span>
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300 leading-relaxed font-sans">{log.details}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )}

      {/* ================= MODAL: PREVIEW & EXPORT LAPORAN PDF RESMI (GAS FORMAT) ================= */}
      <ExportPdfModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        filteredEmployees={filteredEmployees}
        allEmployees={employees}
        filters={filters}
        currentUser={currentUser}
        onExportSuccess={(msg) => setExportToast(msg)}
      />

      {/* ================= MODAL: KONFIRMASI DOWNLOAD EXCEL ================= */}
      <ExportExcelConfirmModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        filteredEmployees={filteredEmployees}
        allEmployees={employees}
        filters={filters}
        currentUser={currentUser}
        onExportSuccess={(msg) => setExportToast(msg)}
      />

      {/* Confirmation Dialog */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        description={confirmModal.description}
        confirmLabel={confirmModal.confirmLabel}
        variant={confirmModal.variant}
        icon={confirmModal.icon}
        isDarkMode={isDarkMode}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Modal Pratinjau & Salin Raw JSON Backup */}
      {rawBackupModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-scaleUp">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-sm font-bold shadow-xs">
                  <i className="fa-solid fa-code"></i>
                </span>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">{rawBackupModal.title}</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{rawBackupModal.filename}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRawBackupModal({ isOpen: false, title: '', content: '', filename: '' })}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition cursor-pointer"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto bg-slate-950 text-slate-200 font-mono text-[11px] leading-relaxed">
              <pre className="whitespace-pre-wrap select-all">{rawBackupModal.content}</pre>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Data JSON dapat langsung disalin atau diunduh ke komputer Anda.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(rawBackupModal.content);
                    try {
                      confetti({ particleCount: 30, spread: 50, origin: { y: 0.8 } });
                    } catch (_) {}
                    setExportToast('Isi JSON berhasil disalin ke Clipboard!');
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-1.5 shadow-xs cursor-pointer transition"
                >
                  <i className="fa-solid fa-copy"></i>
                  <span>Salin JSON</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerFileDownload(rawBackupModal.content, rawBackupModal.filename, 'application/json');
                  }}
                  className="btn-navy px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <i className="fa-solid fa-download"></i>
                  <span>Unduh JSON</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal HD Photo Viewer */}
      <HdPhotoModal
        isOpen={isHdPreviewOpen}
        onClose={() => setIsHdPreviewOpen(false)}
        imageUrl={adminAvatarUrl}
        userName={adminName}
        userRole={adminRole}
        userDepartment={adminDepartment}
      />
    </div>
  );
};
