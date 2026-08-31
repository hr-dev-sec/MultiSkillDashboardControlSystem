import React, { useState, useEffect, useMemo } from 'react';
import { UserAccount, UserSession, UserScopeType } from '../types';
import ConfirmationModal, { ConfirmationVariant } from './ConfirmationModal';
import {
  fetchAllMasterUsers,
  createMasterUserAccount,
  adminUpdateMasterUser,
  adminResetUserPasswordApi,
  deleteMasterUserAccount,
  getUsersDatabaseBackupText,
  exportUsersDatabase,
  importUsersDatabase,
  resetUsersDatabase
} from '../utils/systemDbService';
import { saveStoredUsers, getStoredUsers } from '../utils/storage';
import {
  getSupabaseConfig,
  saveSupabaseConfig,
  fetchSupabaseUsers,
  pushAllUsersToSupabase,
  generateSupabaseSqlForUsersTable,
  generateGoogleAppsScriptForUsersManagement,
  downloadSampleUsersCsv,
  fetchGoogleSheetUsers,
  getSavedGoogleSheetUrl,
  saveGoogleSheetUrl,
  SupabaseConfig
} from '../utils/syncService';

interface MasterUsersManagementProps {
  currentUser: UserSession;
  onRefreshSession?: (updatedUser: UserAccount) => void;
  onShowToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
  isDarkMode?: boolean;
}

const PRESET_ROLES = [
  'HR Development Admin',
  'PIC Departemen Fermentasi',
  'PIC Packaging & Filling',
  'Quality Assurance PIC',
  'Section Supervisor Maintenance',
  'Executive Management Auditor',
  'Supervisor Produksi',
  'Safety & Environment Officer',
  'Admin Departemen'
];

const PRESET_DIVISIONS = [
  'Human Resources & Corporate Service',
  'Production FI (MSG)',
  'Production FP (Food Products)',
  'Technical & QA',
  'Engineering & Utility',
  'Factory Management',
  'Supply Chain & Logistic'
];

const PRESET_DEPARTMENTS = [
  'Human Resources Development',
  'Fermentation Department',
  'Packaging Department',
  'Quality Assurance',
  'Engineering & Maintenance',
  'Factory Executive Office',
  'Safety, Health & Environment (SHE)',
  'Production Planning & Inventory Control (PPIC)'
];

export const MasterUsersManagement: React.FC<MasterUsersManagementProps> = ({
  currentUser,
  onRefreshSession,
  onShowToast,
  isDarkMode = false
}) => {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterRole, setFilterRole] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Confirmation Modal State (replaces all window.confirm / native dialogs)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string | React.ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: ConfirmationVariant;
    icon?: string;
    isLoading?: boolean;
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: '',
    description: '',
    confirmLabel: 'Konfirmasi',
    cancelLabel: 'Batal',
    variant: 'danger',
    isLoading: false,
    onConfirm: () => {}
  });

  // Modal States
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [showResetPwModal, setShowResetPwModal] = useState<boolean>(false);
  const [showCredsModal, setShowCredsModal] = useState<boolean>(false);
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);

  // Form States for Add / Edit
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formName, setFormName] = useState('');
  const [formNik, setFormNik] = useState('');
  const [formRole, setFormRole] = useState(PRESET_ROLES[0]);
  const [formDivisi, setFormDivisi] = useState(PRESET_DIVISIONS[0]);
  const [formDepartment, setFormDepartment] = useState(PRESET_DEPARTMENTS[0]);
  const [formScopeType, setFormScopeType] = useState<UserScopeType>('DEPARTMENT');
  const [formScopeValue, setFormScopeValue] = useState(PRESET_DEPARTMENTS[0]);
  const [formStatus, setFormStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formBio, setFormBio] = useState('');
  const [formCanEditCompetency, setFormCanEditCompetency] = useState(true);
  const [formCanManageUsers, setFormCanManageUsers] = useState(false);
  const [formActionLoading, setFormActionLoading] = useState(false);

  // Quick reset password state
  const [newResetPassword, setNewResetPassword] = useState('');

  // Cloud & Supabase & GAS Sync States
  const [showSqlModal, setShowSqlModal] = useState<boolean>(false);
  const [showGasModal, setShowGasModal] = useState<boolean>(false);
  const [showCloudConfigModal, setShowCloudConfigModal] = useState<boolean>(false);
  const [isCloudSyncing, setIsCloudSyncing] = useState<boolean>(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<{ type: 'idle' | 'success' | 'error'; message: string }>({
    type: 'idle',
    message: ''
  });

  // Supabase Config state
  const [sbConfig, setSbConfig] = useState<SupabaseConfig>(getSupabaseConfig());
  const [gsUrl, setGsUrl] = useState<string>(getSavedGoogleSheetUrl());

  // Toast Helper
  const toast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    if (onShowToast) {
      onShowToast(msg, type);
    }
  };

  // Push all users directly to Supabase
  const handlePushAllToSupabase = async () => {
    if (!sbConfig.url || !sbConfig.anonKey) {
      setShowCloudConfigModal(true);
      toast('Silakan konfigurasikan URL dan Anon Key Supabase terlebih dahulu.', 'info');
      return;
    }

    setIsCloudSyncing(true);
    setCloudSyncStatus({ type: 'idle', message: 'Mengunggah seluruh data master user ke Supabase cloud...' });

    try {
      const currentUsers = users.length > 0 ? users : getStoredUsers();
      const res = await pushAllUsersToSupabase(sbConfig, currentUsers);
      setIsCloudSyncing(false);
      if (res.success) {
        setCloudSyncStatus({ type: 'success', message: res.message });
        toast(res.message, 'success');
      } else {
        setCloudSyncStatus({ type: 'error', message: res.message });
        toast(res.message, 'error');
      }
    } catch (err: any) {
      setIsCloudSyncing(false);
      setCloudSyncStatus({ type: 'error', message: err?.message || 'Gagal sinkronisasi ke Supabase.' });
      toast(err?.message || 'Gagal sinkronisasi ke Supabase.', 'error');
    }
  };

  // Pull users from Supabase
  const handlePullFromSupabase = async () => {
    if (!sbConfig.url || !sbConfig.anonKey) {
      setShowCloudConfigModal(true);
      toast('Silakan konfigurasikan URL dan Anon Key Supabase terlebih dahulu.', 'info');
      return;
    }

    setIsCloudSyncing(true);
    setCloudSyncStatus({ type: 'idle', message: 'Mengambil akun master user dari Supabase cloud...' });

    try {
      const res = await fetchSupabaseUsers(sbConfig);
      setIsCloudSyncing(false);
      if (res.success && res.users && res.users.length > 0) {
        setUsers(res.users);
        saveStoredUsers(res.users);
        setCloudSyncStatus({ type: 'success', message: res.message });
        toast(res.message, 'success');
      } else {
        setCloudSyncStatus({ type: 'error', message: res.message || 'Tidak ada user ditemukan di Supabase.' });
        toast(res.message || 'Tidak ada user ditemukan di Supabase.', 'error');
      }
    } catch (err: any) {
      setIsCloudSyncing(false);
      setCloudSyncStatus({ type: 'error', message: err?.message || 'Gagal mengambil data dari Supabase.' });
      toast(err?.message || 'Gagal mengambil data dari Supabase.', 'error');
    }
  };

  // Pull users from Google Sheet USER_ACCOUNTS tab
  const handlePullFromGoogleSheet = async () => {
    if (!gsUrl) {
      setShowCloudConfigModal(true);
      toast('Silakan masukkan Link Google Sheets terlebih dahulu.', 'info');
      return;
    }

    setIsCloudSyncing(true);
    setCloudSyncStatus({ type: 'idle', message: 'Menghubungkan ke Google Sheets tab USER_ACCOUNTS...' });

    try {
      const res = await fetchGoogleSheetUsers(gsUrl);
      setIsCloudSyncing(false);
      if (res.success && res.users && res.users.length > 0) {
        setUsers(res.users);
        saveStoredUsers(res.users);
        setCloudSyncStatus({ type: 'success', message: res.message });
        toast(res.message, 'success');
      } else {
        setCloudSyncStatus({ type: 'error', message: res.message || 'Gagal membaca tab USER_ACCOUNTS dari Google Sheets.' });
        toast(res.message || 'Gagal membaca tab USER_ACCOUNTS.', 'error');
      }
    } catch (err: any) {
      setIsCloudSyncing(false);
      setCloudSyncStatus({ type: 'error', message: err?.message || 'Gagal membaca Google Sheets.' });
      toast(err?.message || 'Gagal membaca Google Sheets.', 'error');
    }
  };

  // Download Google Apps Script (Code.gs)
  const handleDownloadGasScript = () => {
    try {
      const scriptCode = generateGoogleAppsScriptForUsersManagement();
      const blob = new Blob([scriptCode], { type: 'text/javascript' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Ajinomoto_GoogleAppsScript_UserAccounts_Setup_${new Date().toISOString().slice(0, 10)}.js`;
      a.click();
      URL.revokeObjectURL(url);
      toast('File script Google Apps Script (Code.js) berhasil diunduh.');
    } catch (err: any) {
      toast('Gagal mengunduh script: ' + err?.message, 'error');
    }
  };

  // Download CSV template
  const handleDownloadCsvTemplate = () => {
    try {
      downloadSampleUsersCsv();
      toast('Template master akun CSV berhasil diunduh.');
    } catch (err: any) {
      toast('Gagal mengunduh template CSV.', 'error');
    }
  };

  // Save Cloud Configuration
  const handleSaveCloudConfig = (e: React.FormEvent) => {
    e.preventDefault();
    saveSupabaseConfig(sbConfig);
    saveGoogleSheetUrl(gsUrl);
    setShowCloudConfigModal(false);
    toast('Konfigurasi Cloud Supabase & Google Sheets berhasil disimpan.');
  };

  // Load Users from Server Database (with local fallback)
  const loadUsersList = async () => {
    setLoading(true);
    try {
      const serverUsers = await fetchAllMasterUsers();
      if (serverUsers && serverUsers.length > 0) {
        setUsers(serverUsers);
        saveStoredUsers(serverUsers);
      } else {
        const local = getStoredUsers();
        setUsers(local);
      }
    } catch (err) {
      const local = getStoredUsers();
      setUsers(local);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsersList();
  }, []);

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const search = searchTerm.toLowerCase().trim();
      const matchSearch =
        !search ||
        u.name.toLowerCase().includes(search) ||
        u.username.toLowerCase().includes(search) ||
        (u.nik && u.nik.toLowerCase().includes(search)) ||
        u.role.toLowerCase().includes(search) ||
        u.department.toLowerCase().includes(search) ||
        (u.divisi && u.divisi.toLowerCase().includes(search));

      const matchRole = filterRole === 'ALL' || u.role === filterRole;
      const matchStatus =
        filterStatus === 'ALL' ||
        (filterStatus === 'ACTIVE' && (u.status === 'ACTIVE' || !u.status)) ||
        (filterStatus === 'INACTIVE' && u.status === 'INACTIVE');

      return matchSearch && matchRole && matchStatus;
    });
  }, [users, searchTerm, filterRole, filterStatus]);

  // Statistics
  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.status !== 'INACTIVE').length;
  const adminUsers = users.filter((u) => u.role.toLowerCase().includes('admin') || u.canManageUsers).length;
  const picUsers = users.filter((u) => u.scopeType === 'DEPARTMENT' || u.role.toLowerCase().includes('pic')).length;

  // Open Add Modal
  const handleOpenAddModal = () => {
    setFormUsername('');
    setFormPassword(generateRandomPassword());
    setFormName('');
    setFormNik('');
    setFormRole(PRESET_ROLES[1]);
    setFormDivisi(PRESET_DIVISIONS[1]);
    setFormDepartment(PRESET_DEPARTMENTS[1]);
    setFormScopeType('DEPARTMENT');
    setFormScopeValue(PRESET_DEPARTMENTS[1]);
    setFormStatus('ACTIVE');
    setFormEmail('');
    setFormPhone('');
    setFormBio('');
    setFormCanEditCompetency(true);
    setFormCanManageUsers(false);
    setShowAddModal(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (user: UserAccount) => {
    setSelectedUser(user);
    setFormUsername(user.username);
    setFormPassword(''); // blank means keep current
    setFormName(user.name);
    setFormNik(user.nik || '');
    setFormRole(user.role);
    setFormDivisi(user.divisi || PRESET_DIVISIONS[0]);
    setFormDepartment(user.department);
    setFormScopeType(user.scopeType || (user.username === 'hr_admin' ? 'ALL' : 'DEPARTMENT'));
    setFormScopeValue(user.scopeValue || user.department);
    setFormStatus(user.status || 'ACTIVE');
    setFormEmail(user.email || '');
    setFormPhone(user.phone || '');
    setFormBio(user.bio || '');
    setFormCanEditCompetency(user.canEditCompetency !== undefined ? user.canEditCompetency : true);
    setFormCanManageUsers(user.canManageUsers !== undefined ? user.canManageUsers : user.username === 'hr_admin');
    setShowEditModal(true);
  };

  // Open Reset Password Modal
  const handleOpenResetPw = (user: UserAccount) => {
    setSelectedUser(user);
    setNewResetPassword(generateRandomPassword());
    setShowResetPwModal(true);
  };

  // Open Credentials Modal
  const handleOpenCredsModal = (user: UserAccount) => {
    setSelectedUser(user);
    setShowCredsModal(true);
  };

  // Generate random strong password
  const generateRandomPassword = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // Submit Add User
  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUsername.trim() || !formPassword.trim() || !formName.trim()) {
      toast('Username, kata sandi, dan nama lengkap wajib diisi.', 'error');
      return;
    }

    setFormActionLoading(true);
    try {
      const payload = {
        username: formUsername.trim().toLowerCase(),
        password: formPassword.trim(),
        name: formName.trim(),
        nik: formNik.trim(),
        role: formRole.trim(),
        divisi: formDivisi.trim(),
        department: formDepartment.trim(),
        scopeType: formScopeType,
        scopeValue: formScopeType === 'ALL' ? 'Semua Departemen' : (formScopeValue || formDepartment),
        status: formStatus,
        email: formEmail.trim(),
        phone: formPhone.trim(),
        bio: formBio.trim(),
        canEditCompetency: formCanEditCompetency,
        canManageUsers: formCanManageUsers
      };

      const res = await createMasterUserAccount(payload, currentUser.username);
      if (res.success && res.user) {
        toast(`Akun master "${res.user.name}" (@${res.user.username}) berhasil disimpan ke database.`);
        setShowAddModal(false);
        await loadUsersList();
      } else {
        toast(res.message || 'Gagal menambahkan akun ke database.', 'error');
      }
    } catch (err: any) {
      toast(err?.message || 'Terjadi kesalahan sistem saat membuat akun.', 'error');
    } finally {
      setFormActionLoading(false);
    }
  };

  // Submit Edit User
  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setFormActionLoading(true);
    try {
      const updates: Partial<UserAccount> & { newPassword?: string } = {
        name: formName.trim(),
        nik: formNik.trim(),
        role: formRole.trim(),
        divisi: formDivisi.trim(),
        department: formDepartment.trim(),
        scopeType: formScopeType,
        scopeValue: formScopeType === 'ALL' ? 'Semua Departemen' : (formScopeValue || formDepartment),
        status: formStatus,
        email: formEmail.trim(),
        phone: formPhone.trim(),
        bio: formBio.trim(),
        canEditCompetency: formCanEditCompetency,
        canManageUsers: formCanManageUsers
      };

      if (formPassword.trim().length >= 6) {
        updates.newPassword = formPassword.trim();
      }

      const res = await adminUpdateMasterUser(selectedUser.username, updates, currentUser.username);
      if (res.success && res.user) {
        toast(`Data akun "${res.user.name}" berhasil diperbarui di database master.`);
        setShowEditModal(false);
        await loadUsersList();

        // If editing current logged in user, notify parent
        if (currentUser.username.toLowerCase() === selectedUser.username.toLowerCase() && onRefreshSession) {
          onRefreshSession(res.user);
        }
      } else {
        toast(res.message || 'Gagal memperbarui data akun.', 'error');
      }
    } catch (err: any) {
      toast(err?.message || 'Terjadi kesalahan saat menyimpan perubahan akun.', 'error');
    } finally {
      setFormActionLoading(false);
    }
  };

  // Submit Quick Reset Password
  const handleSubmitResetPw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !newResetPassword.trim()) return;

    if (newResetPassword.trim().length < 6) {
      toast('Kata sandi baru minimal 6 karakter.', 'error');
      return;
    }

    setFormActionLoading(true);
    try {
      const res = await adminResetUserPasswordApi(selectedUser.username, newResetPassword.trim(), currentUser.username);
      if (res.success) {
        toast(`Kata sandi akun @${selectedUser.username} (${selectedUser.name}) berhasil direset.`);
        setShowResetPwModal(false);
        await loadUsersList();
      } else {
        toast(res.message || 'Gagal mereset kata sandi.', 'error');
      }
    } catch (err: any) {
      toast(err?.message || 'Gagal mereset kata sandi pengguna.', 'error');
    } finally {
      setFormActionLoading(false);
    }
  };

  // Toggle Active/Inactive status directly
  const handleToggleStatus = async (user: UserAccount) => {
    if (user.username.toLowerCase() === 'hr_admin') {
      toast('Akun Super Administrator Utama tidak dapat dinonaktifkan.', 'error');
      return;
    }

    const nextStatus = user.status === 'INACTIVE' ? 'ACTIVE' : 'INACTIVE';
    try {
      const res = await adminUpdateMasterUser(user.username, { status: nextStatus }, currentUser.username);
      if (res.success) {
        toast(`Status akun @${user.username} diubah menjadi ${nextStatus === 'ACTIVE' ? 'AKTIF' : 'NON-AKTIF'}.`);
        await loadUsersList();
      } else {
        toast(res.message || 'Gagal mengubah status akun.', 'error');
      }
    } catch (err: any) {
      toast(err?.message || 'Gagal mengubah status akun.', 'error');
    }
  };

  // Delete User with Custom UI Confirmation Modal
  const handleDeleteUser = (user: UserAccount) => {
    if (user.username.toLowerCase() === 'hr_admin') {
      toast('Akun Super Administrator Utama (hr_admin) dilindungi dan tidak dapat dihapus.', 'error');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Hapus Akun Pengguna',
      description: (
        <div className="space-y-2.5">
          <p className="text-slate-700 dark:text-slate-300">
            Apakah Anda yakin ingin menghapus akun master pengguna berikut secara permanen?
          </p>
          <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
            <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <i className="fa-solid fa-user-circle text-amber-500"></i>
              <span>{user.name}</span>
              <span className="font-mono text-slate-500 dark:text-slate-400">(@{user.username})</span>
            </div>
            <div className="text-slate-600 dark:text-slate-400">
              {user.role} &bull; {user.department}
            </div>
          </div>
          <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1">
            <i className="fa-solid fa-triangle-exclamation"></i>
            <span>Tindakan ini akan menghapus akun dari Cloud Supabase &amp; database server.</span>
          </p>
        </div>
      ),
      confirmLabel: 'Hapus Akun',
      cancelLabel: 'Batal',
      variant: 'danger',
      icon: 'fa-solid fa-trash-can',
      isLoading: false,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isLoading: true }));
        try {
          // Instantly filter out from UI state to guarantee immediate removal
          setUsers((prev) => prev.filter((u) => u.username.toLowerCase() !== user.username.toLowerCase()));

          const res = await deleteMasterUserAccount(user.username, currentUser.username);
          if (res.success) {
            toast(`Akun @${user.username} (${user.name}) berhasil dihapus.`);
            await loadUsersList();
          } else {
            toast(res.message || 'Gagal menghapus akun pengguna.', 'error');
            await loadUsersList();
          }
        } catch (err: any) {
          toast(err?.message || 'Gagal menghapus akun pengguna.', 'error');
          await loadUsersList();
        } finally {
          setConfirmModal((prev) => ({ ...prev, isOpen: false, isLoading: false }));
        }
      }
    });
  };

  // Export JSON Master
  const handleExportJson = async () => {
    try {
      const json = await getUsersDatabaseBackupText();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Ajinomoto_Master_Users_DB_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast('File master data akun berhasil diexport dalam format JSON.');
    } catch (err: any) {
      toast('Gagal mengexport master user: ' + err?.message, 'error');
    }
  };

  // Copy Credential to Clipboard
  const handleCopyCredentials = (user: UserAccount) => {
    const text = `KREDENSIAL AKSES MULTI-SKILL SYSTEM - PT AJINOMOTO INDONESIA\n--------------------------------------------------\nNama Pengguna: ${user.name}\nUsername: ${user.username}\nRole: ${user.role}\nDepartemen: ${user.department}\nCakupan Akses: ${user.scopeType || 'DEPARTMENT'} (${user.scopeValue || user.department})\nStatus: ${user.status || 'ACTIVE'}\n\nSilakan login melalui halaman portal resmi pabrik Mojokerto.`;
    navigator.clipboard.writeText(text);
    toast('Informasi kredensial login berhasil disalin ke clipboard!');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Stats */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-6 border border-slate-700/80 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-md text-[11px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                <i className="fa-solid fa-users-gear text-xs"></i>
                Database Master Akun Pengguna & Kredensial
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Multi-User Scoped Isolation
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-3">
              <span>Master Akun & Hak Akses Pengguna</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Setiap user memiliki username, password, departemen, dan cakupan data tersendiri yang tersimpan aman di database server. Data tampilan akan otomatis menyesuaikan akun yang sedang login.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="h-10 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all active:scale-95 cursor-pointer"
            >
              <i className="fa-solid fa-user-plus"></i>
              <span>+ Tambah Akun Master</span>
            </button>
            <button
              type="button"
              onClick={loadUsersList}
              className="h-10 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
              title="Sinkronkan ulang daftar akun dari database server"
            >
              <i className={`fa-solid fa-rotate ${loading ? 'animate-spin text-amber-400' : ''}`}></i>
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              type="button"
              onClick={handleExportJson}
              className="h-10 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
              title="Export data akun pengguna ke file JSON"
            >
              <i className="fa-solid fa-file-export text-amber-400"></i>
              <span className="hidden sm:inline">Export JSON</span>
            </button>
          </div>
        </div>

        {/* 4 Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mt-6 pt-6 border-t border-slate-700/60">
          <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0 text-base">
              <i className="fa-solid fa-users"></i>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400 leading-none">Total Akun Master</p>
              <p className="text-lg font-black text-white mt-1 leading-none">{totalUsers} <span className="text-xs font-normal text-slate-400">User</span></p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0 text-base">
              <i className="fa-solid fa-user-check"></i>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400 leading-none">Akun Aktif</p>
              <p className="text-lg font-black text-emerald-400 mt-1 leading-none">{activeUsers} <span className="text-xs font-normal text-slate-400">Aktif</span></p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center shrink-0 text-base">
              <i className="fa-solid fa-user-shield"></i>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400 leading-none">Super Administrator</p>
              <p className="text-lg font-black text-purple-400 mt-1 leading-none">{adminUsers} <span className="text-xs font-normal text-slate-400">Admin</span></p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0 text-base">
              <i className="fa-solid fa-sitemap"></i>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400 leading-none">PIC Departemen</p>
              <p className="text-lg font-black text-blue-400 mt-1 leading-none">{picUsers} <span className="text-xs font-normal text-slate-400">Scoped</span></p>
            </div>
          </div>
        </div>
      </div>

      {/* Cloud Supabase & Google Sheets Multi-Database Synchronization Hub */}
      <div className="rounded-2xl p-5 bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-500/30 text-white shadow-lg space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded text-[10.5px] font-extrabold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center gap-1.5">
                <i className="fa-solid fa-cloud-arrow-up text-indigo-400"></i>
                Cloud Multi-Browser & Incognito Synchronization
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Supabase &amp; Google Sheets Ready
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <span>Sinkronisasi Cloud Akun Pengguna</span>
            </h3>
            <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
              Jadikan akun master persisten di seluruh browser dan mode incognito dengan sinkronisasi ke cloud <strong>Supabase</strong> (PostgreSQL) serta lembar kerja <strong>Google Sheets</strong> (tab <code className="text-amber-300 font-mono">USER_ACCOUNTS</code>).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Push to Supabase */}
            <button
              type="button"
              onClick={handlePushAllToSupabase}
              disabled={isCloudSyncing}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-2 shadow-md transition active:scale-95 cursor-pointer disabled:opacity-50"
              title="Unggah dan timpa seluruh daftar user master ke database Supabase Cloud"
            >
              <i className={`fa-solid ${isCloudSyncing ? 'fa-spinner animate-spin' : 'fa-cloud-arrow-up text-emerald-200'}`}></i>
              <span>Unggah ke Supabase</span>
            </button>

            {/* Pull from Supabase */}
            <button
              type="button"
              onClick={handlePullFromSupabase}
              disabled={isCloudSyncing}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-indigo-400/40 font-bold text-xs flex items-center gap-2 shadow-xs transition cursor-pointer disabled:opacity-50"
              title="Ambil dan sinkronkan daftar user dari Supabase Cloud"
            >
              <i className="fa-solid fa-cloud-arrow-down text-indigo-400"></i>
              <span>Tarik dari Supabase</span>
            </button>

            {/* Pull from Google Sheet */}
            <button
              type="button"
              onClick={handlePullFromGoogleSheet}
              disabled={isCloudSyncing}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-emerald-500/40 font-bold text-xs flex items-center gap-2 shadow-xs transition cursor-pointer disabled:opacity-50"
              title="Tarik akun pengguna dari Google Sheets tab USER_ACCOUNTS"
            >
              <i className="fa-solid fa-file-excel text-emerald-400"></i>
              <span>Tarik Google Sheet</span>
            </button>

            {/* Settings & Config */}
            <button
              type="button"
              onClick={() => setShowCloudConfigModal(true)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-bold transition cursor-pointer"
              title="Pengaturan API Supabase & Link Google Sheets"
            >
              <i className="fa-solid fa-gear text-slate-300"></i>
            </button>
          </div>
        </div>

        {/* Secondary Tool Shortcuts */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-slate-400 font-semibold">Skrip &amp; Generator:</span>
            
            {/* View SQL Schema */}
            <button
              type="button"
              onClick={() => setShowSqlModal(true)}
              className="px-2.5 py-1 rounded-lg bg-indigo-900/50 hover:bg-indigo-800/60 text-indigo-300 border border-indigo-700/60 text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <i className="fa-solid fa-database text-[10px]"></i>
              <span>Skema SQL Supabase (DDL)</span>
            </button>

            {/* View Google Apps Script */}
            <button
              type="button"
              onClick={() => setShowGasModal(true)}
              className="px-2.5 py-1 rounded-lg bg-emerald-900/50 hover:bg-emerald-800/60 text-emerald-300 border border-emerald-700/60 text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <i className="fa-solid fa-code text-[10px]"></i>
              <span>Skrip Google Apps Script (Code.gs)</span>
            </button>

            {/* Download CSV Template */}
            <button
              type="button"
              onClick={handleDownloadCsvTemplate}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <i className="fa-solid fa-file-csv text-amber-400 text-[10px]"></i>
              <span>Template CSV User</span>
            </button>
          </div>

          {/* Connection status indicator */}
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-slate-400">Status Cloud:</span>
            {sbConfig.url && sbConfig.anonKey ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[10.5px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Supabase Terhubung
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[10.5px]">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                Konfigurasi Lokal/Server
              </span>
            )}
          </div>
        </div>

        {/* Sync Status Banner */}
        {cloudSyncStatus.message && (
          <div className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-between gap-3 animate-fadeIn ${
            cloudSyncStatus.type === 'success'
              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800'
              : cloudSyncStatus.type === 'error'
              ? 'bg-rose-950/60 text-rose-300 border border-rose-800'
              : 'bg-indigo-950/60 text-indigo-300 border border-indigo-800'
          }`}>
            <div className="flex items-center gap-2">
              <i className={`fa-solid ${
                cloudSyncStatus.type === 'success'
                  ? 'fa-circle-check text-emerald-400'
                  : cloudSyncStatus.type === 'error'
                  ? 'fa-circle-exclamation text-rose-400'
                  : 'fa-spinner animate-spin text-indigo-400'
              }`}></i>
              <span>{cloudSyncStatus.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setCloudSyncStatus({ type: 'idle', message: '' })}
              className="text-slate-400 hover:text-white text-xs cursor-pointer"
            >
              &times;
            </button>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari nama pengguna, @username, NIK, peran, atau departemen..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-white"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
            >
              <i className="fa-solid fa-circle-xmark"></i>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Role Filter */}
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="h-10 px-3 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-amber-500"
          >
            <option value="ALL">Semua Peran / Role</option>
            {PRESET_ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="h-10 px-3 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-amber-500"
          >
            <option value="ALL">Semua Status</option>
            <option value="ACTIVE">Aktif Saja</option>
            <option value="INACTIVE">Non-Aktif Saja</option>
          </select>
        </div>
      </div>

      {/* Master Users Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">Pengguna & Akun</th>
                <th className="py-3.5 px-4">Peran / Role</th>
                <th className="py-3.5 px-4">Divisi & Departemen</th>
                <th className="py-3.5 px-4">Cakupan Data (Scope)</th>
                <th className="py-3.5 px-4">Kontak & NIK</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Aksi Manajemen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs text-slate-700 dark:text-slate-300">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <i className="fa-solid fa-user-slash text-3xl mb-2 text-slate-300 dark:text-slate-600 block"></i>
                    Tidak ada akun pengguna yang sesuai dengan kriteria pencarian.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isCurrent = currentUser.username.toLowerCase() === user.username.toLowerCase();
                  const isSuperAdmin = user.username.toLowerCase() === 'hr_admin';
                  const isActive = user.status !== 'INACTIVE';

                  return (
                    <tr
                      key={user.username}
                      className={`hover:bg-amber-50/40 dark:hover:bg-slate-800/40 transition-colors ${
                        isCurrent ? 'bg-amber-50/20 dark:bg-amber-500/5' : ''
                      }`}
                    >
                      {/* User Info & Avatar */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          {user.avatarUrl ? (
                            <img
                              src={user.avatarUrl}
                              alt={user.name}
                              className="w-10 h-10 rounded-xl object-cover ring-2 ring-amber-400/30"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950 font-black flex items-center justify-center text-sm shadow-xs">
                              {user.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900 dark:text-white text-sm">
                                {user.name}
                              </span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-amber-500 text-slate-950">
                                  Anda
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                              <span>@{user.username}</span>
                              {user.nik && <span className="text-slate-400">&bull; NIK: {user.nik}</span>}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                          isSuperAdmin
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-300 dark:border-purple-800'
                            : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                        }`}>
                          <i className={`fa-solid ${isSuperAdmin ? 'fa-shield-halved text-purple-600 dark:text-purple-400' : 'fa-user-tag text-slate-500'} text-[10px]`}></i>
                          {user.role}
                        </span>
                      </td>

                      {/* Divisi & Departemen */}
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-slate-800 dark:text-slate-200">{user.department}</p>
                        <p className="text-[10.5px] text-slate-500 dark:text-slate-400">{user.divisi || 'Produksi Pabrik'}</p>
                      </td>

                      {/* Scope Data */}
                      <td className="py-3.5 px-4">
                        {user.scopeType === 'ALL' || isSuperAdmin ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                            <i className="fa-solid fa-globe text-[9px]"></i>
                            Seluruh Pabrik (All Data)
                          </span>
                        ) : user.scopeType === 'DIVISI' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
                            <i className="fa-solid fa-layer-group text-[9px]"></i>
                            Divisi: {user.scopeValue || user.divisi}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                            <i className="fa-solid fa-building-user text-[9px]"></i>
                            Dept: {user.scopeValue || user.department}
                          </span>
                        )}
                      </td>

                      {/* Contact & NIK */}
                      <td className="py-3.5 px-4">
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate max-w-[160px]" title={user.email}>
                          <i className="fa-regular fa-envelope text-slate-400 mr-1"></i>
                          {user.email || '-'}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          <i className="fa-solid fa-phone text-slate-400 mr-1"></i>
                          {user.phone || '-'}
                        </p>
                      </td>

                      {/* Status Toggle */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(user)}
                          disabled={isSuperAdmin}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold transition-all cursor-pointer ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
                              : 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300 border border-red-200 dark:border-red-800 hover:bg-red-100'
                          } ${isSuperAdmin ? 'opacity-75 cursor-not-allowed' : ''}`}
                          title={isSuperAdmin ? 'Akun Super Admin selalu aktif' : 'Klik untuk mengubah status aktif/non-aktif'}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
                          {isActive ? 'Aktif' : 'Non-Aktif'}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Quick Credential Card */}
                          <button
                            type="button"
                            onClick={() => handleOpenCredsModal(user)}
                            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                            title="Lihat Kredensial & Salin Data Login"
                          >
                            <i className="fa-solid fa-id-card text-xs text-amber-600 dark:text-amber-400"></i>
                          </button>

                          {/* Reset Password */}
                          <button
                            type="button"
                            onClick={() => handleOpenResetPw(user)}
                            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                            title="Reset Kata Sandi Akun Ini"
                          >
                            <i className="fa-solid fa-key text-xs text-blue-600 dark:text-blue-400"></i>
                          </button>

                          {/* Edit Full Account */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(user)}
                            className="p-2 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 transition-colors"
                            title="Edit Data Lengkap Akun & Hak Akses"
                          >
                            <i className="fa-solid fa-pen-to-square text-xs"></i>
                          </button>

                          {/* Delete Account */}
                          {!isSuperAdmin && (
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(user)}
                              className="p-2 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/60 text-red-700 dark:text-red-300 transition-colors"
                              title="Hapus Akun Pengguna dari Database"
                            >
                              <i className="fa-solid fa-trash-can text-xs"></i>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: TAMBAH AKUN MASTER BARU */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-8">
            <div className="p-5 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-slate-950/20 flex items-center justify-center text-slate-950 font-bold">
                  <i className="fa-solid fa-user-plus text-base"></i>
                </div>
                <div>
                  <h3 className="font-black text-base sm:text-lg text-slate-950 leading-tight">
                    Tambah Akun Master Pengguna Baru
                  </h3>
                  <p className="text-[11px] font-semibold text-slate-900/80">
                    Kredensial dan cakupan data akan tersimpan langsung di database server
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-950/10 hover:bg-slate-950/20 text-slate-950 flex items-center justify-center text-sm font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmitAdd} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Username */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Username Login <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="contoh: fermentasi_pic"
                    className="w-full px-3.5 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Hanya huruf kecil, angka, dan underscore (_)</p>
                </div>

                {/* Initial Password */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Kata Sandi Login <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setFormPassword(generateRandomPassword())}
                      className="text-[10.5px] font-bold text-amber-600 dark:text-amber-400 hover:underline"
                    >
                      <i className="fa-solid fa-dice mr-1"></i>Acak
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    className="w-full px-3.5 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {/* Full Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Nama Lengkap & Gelar <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="contoh: Budi Santoso, S.T."
                    className="w-full px-3.5 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {/* NIK */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Nomor Induk Karyawan (NIK)
                  </label>
                  <input
                    type="text"
                    value={formNik}
                    onChange={(e) => setFormNik(e.target.value)}
                    placeholder="contoh: 121904102"
                    className="w-full px-3.5 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {/* Role */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Peran / Jabatan Sistem <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    list="preset-roles-list"
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    placeholder="Pilih atau ketik peran"
                    className="w-full px-3.5 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                  />
                  <datalist id="preset-roles-list">
                    {PRESET_ROLES.map((r) => (
                      <option key={r} value={r} />
                    ))}
                  </datalist>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Status Akun
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
                    className="w-full px-3.5 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="ACTIVE">Aktif (Dapat Login)</option>
                    <option value="INACTIVE">Non-Aktif (Login Diblokir)</option>
                  </select>
                </div>

                {/* Divisi */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Divisi Pabrik
                  </label>
                  <select
                    value={formDivisi}
                    onChange={(e) => setFormDivisi(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                  >
                    {PRESET_DIVISIONS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                {/* Department */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Departemen
                  </label>
                  <select
                    value={formDepartment}
                    onChange={(e) => {
                      setFormDepartment(e.target.value);
                      if (formScopeType === 'DEPARTMENT') {
                        setFormScopeValue(e.target.value);
                      }
                    }}
                    className="w-full px-3.5 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                  >
                    {PRESET_DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                {/* Scope Type */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Cakupan Akses Data (Scope)
                  </label>
                  <select
                    value={formScopeType}
                    onChange={(e) => {
                      const st = e.target.value as UserScopeType;
                      setFormScopeType(st);
                      if (st === 'ALL') setFormScopeValue('Semua Data Pabrik');
                      else if (st === 'DIVISI') setFormScopeValue(formDivisi);
                      else setFormScopeValue(formDepartment);
                    }}
                    className="w-full px-3.5 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="DEPARTMENT">Departemen Tertentu Saja (Default PIC)</option>
                    <option value="DIVISI">Satu Divisi Penuh</option>
                    <option value="ALL">Seluruh Data Pabrik (Full Factory Access)</option>
                  </select>
                </div>

                {/* Scope Value */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Nama Target Cakupan
                  </label>
                  <input
                    type="text"
                    value={formScopeValue}
                    onChange={(e) => setFormScopeValue(e.target.value)}
                    disabled={formScopeType === 'ALL'}
                    className="w-full px-3.5 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 disabled:opacity-60"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Alamat Email Perusahaan
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="nama@ajinomoto.co.id"
                    className="w-full px-3.5 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    No. Telepon / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="0812-xxxx-xxxx"
                    className="w-full px-3.5 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Bio / Responsibility Note */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Deskripsi Tanggung Jawab / Catatan User
                </label>
                <textarea
                  rows={2}
                  value={formBio}
                  onChange={(e) => setFormBio(e.target.value)}
                  placeholder="Catatan penugasan atau wewenang monitoring..."
                  className="w-full px-3.5 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Permissions Checkboxes */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-2">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Hak Akses & Otoritas Khusus:</p>
                <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formCanEditCompetency}
                    onChange={(e) => setFormCanEditCompetency(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500"
                  />
                  <span>Dapat Mengubah & Menilai Matriks Multi-Skill Karyawan</span>
                </label>
                <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formCanManageUsers}
                    onChange={(e) => setFormCanManageUsers(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500"
                  />
                  <span>Dapat Mengelola Master Akun User & Konfigurasi Sistem (Hak Administrator)</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={formActionLoading}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold text-xs sm:text-sm hover:from-amber-600 hover:to-amber-700 shadow-md flex items-center gap-2 cursor-pointer"
                >
                  {formActionLoading ? (
                    <>
                      <i className="fa-solid fa-spinner animate-spin"></i>
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-floppy-disk"></i>
                      <span>Simpan Akun ke Database</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIT AKUN MASTER */}
      {/* ========================================================================= */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-8">
            <div className="p-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between border-b border-slate-700">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold">
                  <i className="fa-solid fa-user-pen text-base"></i>
                </div>
                <div>
                  <h3 className="font-black text-base sm:text-lg text-white leading-tight">
                    Edit Akun Master: {selectedUser.name}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    @{selectedUser.username}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-sm font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmitEdit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Username (Read-Only) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    disabled
                    value={formUsername}
                    className="w-full px-3.5 py-2 rounded-xl text-xs sm:text-sm bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-mono cursor-not-allowed"
                  />
                </div>

                {/* Optional Change Password */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Ganti Kata Sandi (Kosongkan jika tetap)
                  </label>
                  <input
                    type="text"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="Kosongkan jika tidak diganti"
                    className="w-full px-3.5 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {/* Full Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Nama Lengkap & Gelar <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {/* NIK */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Nomor Induk Karyawan (NIK)
                  </label>
                  <input
                    type="text"
                    value={formNik}
                    onChange={(e) => setFormNik(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {/* Role */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Peran / Jabatan Sistem <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    list="preset-roles-edit-list"
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                  />
                  <datalist id="preset-roles-edit-list">
                    {PRESET_ROLES.map((r) => (
                      <option key={r} value={r} />
                    ))}
                  </datalist>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Status Akun
                  </label>
                  <select
                    value={formStatus}
                    disabled={selectedUser.username.toLowerCase() === 'hr_admin'}
                    onChange={(e) => setFormStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
                    className="w-full px-3.5 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 disabled:opacity-60"
                  >
                    <option value="ACTIVE">Aktif (Dapat Login)</option>
                    <option value="INACTIVE">Non-Aktif (Login Diblokir)</option>
                  </select>
                </div>

                {/* Divisi */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Divisi Pabrik
                  </label>
                  <select
                    value={formDivisi}
                    onChange={(e) => setFormDivisi(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                  >
                    {PRESET_DIVISIONS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                {/* Department */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Departemen
                  </label>
                  <select
                    value={formDepartment}
                    onChange={(e) => {
                      setFormDepartment(e.target.value);
                      if (formScopeType === 'DEPARTMENT') {
                        setFormScopeValue(e.target.value);
                      }
                    }}
                    className="w-full px-3.5 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                  >
                    {PRESET_DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                {/* Scope Type */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Cakupan Akses Data (Scope)
                  </label>
                  <select
                    value={formScopeType}
                    onChange={(e) => {
                      const st = e.target.value as UserScopeType;
                      setFormScopeType(st);
                      if (st === 'ALL') setFormScopeValue('Semua Data Pabrik');
                      else if (st === 'DIVISI') setFormScopeValue(formDivisi);
                      else setFormScopeValue(formDepartment);
                    }}
                    className="w-full px-3.5 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="DEPARTMENT">Departemen Tertentu Saja (Default PIC)</option>
                    <option value="DIVISI">Satu Divisi Penuh</option>
                    <option value="ALL">Seluruh Data Pabrik (Full Factory Access)</option>
                  </select>
                </div>

                {/* Scope Value */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Nama Target Cakupan
                  </label>
                  <input
                    type="text"
                    value={formScopeValue}
                    onChange={(e) => setFormScopeValue(e.target.value)}
                    disabled={formScopeType === 'ALL'}
                    className="w-full px-3.5 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 disabled:opacity-60"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Alamat Email Perusahaan
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    No. Telepon / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Bio / Responsibility */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Deskripsi Tanggung Jawab / Catatan User
                </label>
                <textarea
                  rows={2}
                  value={formBio}
                  onChange={(e) => setFormBio(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Permissions Checkboxes */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-2">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Hak Akses & Otoritas Khusus:</p>
                <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formCanEditCompetency}
                    onChange={(e) => setFormCanEditCompetency(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500"
                  />
                  <span>Dapat Mengubah & Menilai Matriks Multi-Skill Karyawan</span>
                </label>
                <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formCanManageUsers}
                    disabled={selectedUser.username.toLowerCase() === 'hr_admin'}
                    onChange={(e) => setFormCanManageUsers(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 disabled:opacity-60"
                  />
                  <span>Dapat Mengelola Master Akun User & Konfigurasi Sistem (Hak Administrator)</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={formActionLoading}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs sm:text-sm shadow-md flex items-center gap-2 cursor-pointer"
                >
                  {formActionLoading ? (
                    <>
                      <i className="fa-solid fa-spinner animate-spin"></i>
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-floppy-disk"></i>
                      <span>Simpan Perubahan ke Database</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: RESET PASSWORD CEPAT */}
      {/* ========================================================================= */}
      {showResetPwModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-700">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-key text-amber-400"></i>
                <h3 className="font-bold text-sm text-white">Reset Kata Sandi Akun</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowResetPwModal(false)}
                className="text-slate-400 hover:text-white"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmitResetPw} className="p-5 space-y-4">
              <div>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Mereset kata sandi untuk akun <span className="font-bold text-slate-900 dark:text-white">{selectedUser.name}</span> (<span className="font-mono text-amber-600 dark:text-amber-400">@{selectedUser.username}</span>).
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Kata Sandi Baru
                  </label>
                  <button
                    type="button"
                    onClick={() => setNewResetPassword(generateRandomPassword())}
                    className="text-[10.5px] font-bold text-amber-600 dark:text-amber-400 hover:underline"
                  >
                    <i className="fa-solid fa-dice mr-1"></i>Acak Baru
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={newResetPassword}
                  onChange={(e) => setNewResetPassword(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowResetPwModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={formActionLoading}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs cursor-pointer"
                >
                  {formActionLoading ? 'Mereset...' : 'Terapkan Password Baru'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: KARTU KREDENSIAL PENGGUNA */}
      {/* ========================================================================= */}
      {showCredsModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between border-b border-slate-700">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-id-card text-amber-400"></i>
                <h3 className="font-bold text-sm text-white">Kartu Kredensial Akun</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCredsModal(false)}
                className="text-slate-400 hover:text-white text-lg"
              >
                &times;
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-xs space-y-2">
                <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-1.5">
                  <span className="text-slate-400">Nama:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{selectedUser.name}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-1.5">
                  <span className="text-slate-400">Username:</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">@{selectedUser.username}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-1.5">
                  <span className="text-slate-400">Peran:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{selectedUser.role}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-1.5">
                  <span className="text-slate-400">Departemen:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{selectedUser.department}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-1.5">
                  <span className="text-slate-400">Cakupan Data:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {selectedUser.scopeType || 'DEPARTMENT'} ({selectedUser.scopeValue || selectedUser.department})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span className={`font-bold ${selectedUser.status !== 'INACTIVE' ? 'text-emerald-500' : 'text-red-500'}`}>
                    {selectedUser.status !== 'INACTIVE' ? 'Aktif' : 'Non-Aktif'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCredsModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={() => handleCopyCredentials(selectedUser)}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 cursor-pointer"
                >
                  <i className="fa-solid fa-copy"></i>
                  <span>Salin Info Login</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SUPABASE SQL DDL SCHEMA */}
      {/* ========================================================================= */}
      {showSqlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-700 shrink-0">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-database text-indigo-400"></i>
                <h3 className="font-bold text-sm text-white">Skema SQL Database Supabase (`system_users`)</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSqlModal(false)}
                className="text-slate-400 hover:text-white text-lg"
              >
                &times;
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Salin dan jalankan skrip SQL di bawah ini pada <strong>Supabase SQL Editor</strong> di project Supabase Anda. Skrip ini akan membuat tabel <code className="text-indigo-600 dark:text-indigo-400 font-mono font-bold">system_users</code> dengan kolom lengkap beserta hak akses publik (RLS).
              </p>

              <div className="relative">
                <pre className="p-4 rounded-xl bg-slate-950 text-slate-200 font-mono text-[11px] overflow-x-auto max-h-72 border border-slate-800 leading-relaxed selection:bg-indigo-500 selection:text-white">
                  {generateSupabaseSqlForUsersTable()}
                </pre>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(generateSupabaseSqlForUsersTable());
                    toast('Script SQL Supabase disalin ke clipboard!');
                  }}
                  className="absolute top-2.5 right-2.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10.5px] flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <i className="fa-solid fa-copy"></i>
                  <span>Salin SQL</span>
                </button>
              </div>

              <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-xs text-indigo-900 dark:text-indigo-300 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <i className="fa-solid fa-circle-info"></i> Petunjuk Penggunaan:
                </p>
                <ol className="list-decimal list-inside space-y-0.5 text-[11.5px] text-slate-600 dark:text-slate-300 pl-1">
                  <li>Buka dashboard Supabase project Anda di browser.</li>
                  <li>Pilih menu <strong>SQL Editor</strong> di sidebar kiri, lalu klik <strong>New query</strong>.</li>
                  <li>Tempelkan (Paste) skrip SQL di atas lalu tekan tombol <strong>RUN</strong>.</li>
                  <li>Setelah selesai, akun master akan tersinkronisasi secara otomatis antar browser &amp; perangkat!</li>
                </ol>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowSqlModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(generateSupabaseSqlForUsersTable());
                  toast('Script SQL Supabase disalin ke clipboard!');
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <i className="fa-solid fa-copy"></i>
                <span>Salin Script SQL</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: GOOGLE APPS SCRIPT (Code.gs) */}
      {/* ========================================================================= */}
      {showGasModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-700 shrink-0">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-code text-emerald-400"></i>
                <h3 className="font-bold text-sm text-white">Google Apps Script Automator (`Code.gs`)</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGasModal(false)}
                className="text-slate-400 hover:text-white text-lg"
              >
                &times;
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Skrip ini berjalan langsung di Google Sheets untuk membuat tab <code className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">USER_ACCOUNTS</code> secara otomatis, mengisikan header, memformat tabel, dan menyediakan REST Web App endpoint untuk aplikasi web ini.
              </p>

              <div className="relative">
                <pre className="p-4 rounded-xl bg-slate-950 text-slate-200 font-mono text-[11px] overflow-x-auto max-h-72 border border-slate-800 leading-relaxed selection:bg-emerald-500 selection:text-white">
                  {generateGoogleAppsScriptForUsersManagement()}
                </pre>
                <div className="absolute top-2.5 right-2.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(generateGoogleAppsScriptForUsersManagement());
                      toast('Script Google Apps Script disalin ke clipboard!');
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-[10.5px] flex items-center gap-1 shadow-md cursor-pointer"
                  >
                    <i className="fa-solid fa-copy"></i>
                    <span>Salin</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadGasScript}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10.5px] flex items-center gap-1 shadow-md cursor-pointer"
                  >
                    <i className="fa-solid fa-download"></i>
                    <span>Unduh .js</span>
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-900 dark:text-emerald-300 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <i className="fa-solid fa-circle-check"></i> 3 Langkah Mudah di Google Sheets:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-[11.5px] text-slate-600 dark:text-slate-300 pl-1">
                  <li>Buka spreadsheet Google Sheets Anda &rarr; Klik menu <strong>Extensions (Ekstensi)</strong> &rarr; <strong>Apps Script</strong>.</li>
                  <li>Hapus kode bawaan, tempelkan skrip di atas ke file <code>Code.gs</code>, lalu klik tombol <strong>Save</strong>.</li>
                  <li>Pilih fungsi <code>setupUserAccountsSheet</code> pada dropdown menu lalu klik <strong>Run</strong> untuk membuat sheet <code>USER_ACCOUNTS</code> secara instan!</li>
                </ol>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowGasModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={handleDownloadGasScript}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <i className="fa-solid fa-download"></i>
                <span>Unduh File Skrip (.js)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: KONFIGURASI SUPABASE & GOOGLE SHEETS */}
      {/* ========================================================================= */}
      {showCloudConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-slate-700">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-sliders text-indigo-400"></i>
                <h3 className="font-bold text-sm text-white">Pengaturan Sinkronisasi Supabase &amp; Sheets</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCloudConfigModal(false)}
                className="text-slate-400 hover:text-white text-lg"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveCloudConfig} className="p-5 space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Supabase Project URL
                  </label>
                  <input
                    type="url"
                    value={sbConfig.url}
                    onChange={(e) => setSbConfig({ ...sbConfig, url: e.target.value })}
                    placeholder="https://xxxxxxxxxxxx.supabase.co"
                    className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-[10.5px] text-slate-400 mt-1">Ditemukan di Supabase Dashboard &rarr; Project Settings &rarr; API &rarr; Project URL</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Supabase Anon Public API Key
                  </label>
                  <input
                    type="password"
                    value={sbConfig.anonKey}
                    onChange={(e) => setSbConfig({ ...sbConfig, anonKey: e.target.value })}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-[10.5px] text-slate-400 mt-1">Anon key aman digunakan di sisi client untuk sinkronisasi database.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Nama Tabel Supabase Users
                  </label>
                  <input
                    type="text"
                    value={sbConfig.tableName || 'system_users'}
                    onChange={(e) => setSbConfig({ ...sbConfig, tableName: e.target.value })}
                    placeholder="system_users"
                    className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Link Spreadsheet Google Sheets
                  </label>
                  <input
                    type="url"
                    value={gsUrl}
                    onChange={(e) => setGsUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                    className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  />
                  <p className="text-[10.5px] text-slate-400 mt-1">Digunakan untuk mengambil data akun dari tab <code>USER_ACCOUNTS</code>.</p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCloudConfigModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <i className="fa-solid fa-floppy-disk"></i>
                  <span>Simpan Konfigurasi</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom UI Confirmation Modal (Replaces all native alerts/confirms) */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        description={confirmModal.description}
        confirmLabel={confirmModal.confirmLabel}
        cancelLabel={confirmModal.cancelLabel}
        variant={confirmModal.variant}
        icon={confirmModal.icon}
        isLoading={confirmModal.isLoading}
        isDarkMode={isDarkMode}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
