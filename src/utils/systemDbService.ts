import { UserAccount, UserSession, SystemConfig, ActivityLog, EmailLog } from '../types';
import {
  getSupabaseConfig,
  fetchSupabaseUsers,
  pushUserToSupabase,
  deleteUserFromSupabase
} from './syncService';

export interface SystemInitData {
  users: UserAccount[];
  config: SystemConfig;
  recentLogs: ActivityLog[];
  emailLogs: EmailLog[];
}

/**
 * Safely parse JSON from response, preventing "Unexpected token ... is not valid JSON" errors
 */
async function safeParseJson<T = any>(res: Response, fallbackMessage: string): Promise<{ ok: boolean; data: T | null; message: string }> {
  try {
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const parsed = await res.json();
      return {
        ok: res.ok,
        data: parsed,
        message: parsed?.message || (res.ok ? 'Sukses' : fallbackMessage)
      };
    }
    // If server returned text/html (e.g. 404 or Vite proxying during startup)
    const text = await res.text();
    console.warn(`Non-JSON response (${res.status}):`, text.slice(0, 120));
    return {
      ok: false,
      data: null,
      message: res.ok ? 'Format data respons tidak valid.' : (fallbackMessage || `Server merespons status ${res.status}`)
    };
  } catch (err: any) {
    return {
      ok: false,
      data: null,
      message: err?.message || fallbackMessage
    };
  }
}

/**
 * Fetch all initial persistent system database data from server.
 * This guarantees that when a user opens Incognito mode, another tab, or another device,
 * the latest profiles, avatars, settings, and users are completely synced.
 */
export async function fetchSystemInit(): Promise<SystemInitData | null> {
  try {
    const res = await fetch('/api/system/init');
    const { ok, data } = await safeParseJson<{ success: boolean; users?: UserAccount[]; config: SystemConfig; recentLogs?: ActivityLog[]; emailLogs?: EmailLog[] }>(
      res,
      'Gagal memuat data sistem'
    );
    if (ok && data?.success) {
      return {
        users: data.users || [],
        config: data.config,
        recentLogs: data.recentLogs || [],
        emailLogs: data.emailLogs || []
      };
    }
    return null;
  } catch (err) {
    console.warn('Could not fetch system init data from backend:', err);
    return null;
  }
}

/**
 * Update user profile and photo on server database
 */
export async function updateServerUserProfile(
  username: string,
  updatedData: Partial<UserAccount>
): Promise<{ success: boolean; message: string; user?: UserAccount; session?: UserSession }> {
  try {
    const res = await fetch(`/api/users/${encodeURIComponent(username)}/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedData)
    });
    const { ok, data, message } = await safeParseJson<{
      success: boolean;
      message: string;
      user?: UserAccount;
      session?: UserSession;
    }>(res, 'Gagal memperbarui profil di server database.');

    if (data && typeof data.success === 'boolean') {
      return data;
    }

    return {
      success: ok,
      message: message || (ok ? 'Profil berhasil disimpan.' : 'Gagal menyimpan profil ke server.')
    };
  } catch (err: any) {
    console.error('Error updating profile on server:', err);
    return {
      success: false,
      message: err?.message || 'Gagal terhubung ke server database.'
    };
  }
}

/**
 * Update user photo avatar on server database
 */
export async function updateServerUserPhoto(
  username: string,
  avatarUrl: string
): Promise<{ success: boolean; message: string; user?: UserAccount }> {
  try {
    const res = await fetch(`/api/users/${encodeURIComponent(username)}/avatar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatarUrl })
    });
    const { ok, data, message } = await safeParseJson<{ success: boolean; message: string; user?: UserAccount }>(
      res,
      'Gagal menyimpan foto ke server database.'
    );

    if (data && typeof data.success === 'boolean') {
      return data;
    }

    return {
      success: ok,
      message: message || (ok ? 'Foto profil berhasil disimpan.' : 'Gagal menyimpan foto ke server.')
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Gagal menyimpan foto ke server database.'
    };
  }
}

/**
 * Remove user avatar photo on server database
 */
export async function removeServerUserPhoto(
  username: string
): Promise<{ success: boolean; message: string; user?: UserAccount }> {
  try {
    const res = await fetch(`/api/users/${encodeURIComponent(username)}/avatar`, {
      method: 'DELETE'
    });
    const { ok, data, message } = await safeParseJson<{ success: boolean; message: string; user?: UserAccount }>(
      res,
      'Gagal menghapus foto di server database.'
    );

    if (data && typeof data.success === 'boolean') {
      return data;
    }

    return {
      success: ok,
      message: message || (ok ? 'Foto profil berhasil dihapus.' : 'Gagal menghapus foto di server.')
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Gagal menghapus foto di server database.'
    };
  }
}

/**
 * Authenticate login against server database
 */
export async function serverLogin(
  username: string,
  password: string
): Promise<{ success: boolean; message?: string; session?: UserSession; user?: UserAccount; isNetworkError?: boolean }> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim(), password })
    });
    const { ok, data, message } = await safeParseJson<{
      success: boolean;
      message?: string;
      session?: UserSession;
      user?: UserAccount;
    }>(res, 'Gagal menghubungi server otentikasi.');

    if (data && typeof data.success === 'boolean') {
      return {
        success: data.success,
        message: data.message || (data.success ? 'Login berhasil.' : 'Username atau password salah. Silakan coba lagi.'),
        session: data.session,
        user: data.user
      };
    }

    return {
      success: false,
      isNetworkError: true,
      message: message || 'Gagal menghubungi server otentikasi.'
    };
  } catch (err: any) {
    console.warn('Server login network error:', err);
    return {
      success: false,
      isNetworkError: true,
      message: 'Gagal menghubungi server otentikasi.'
    };
  }
}

/**
 * Change password on server database
 */
export async function serverChangePassword(
  username: string,
  oldPassword: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, oldPassword, newPassword })
    });
    const { ok, data, message } = await safeParseJson<{ success: boolean; message: string }>(
      res,
      'Gagal memperbarui password di server database.'
    );

    const isSuccess = data?.success || (ok && !data);
    if (isSuccess) {
      // Sync to Supabase if configured
      try {
        const sbConfig = getSupabaseConfig();
        if (sbConfig && sbConfig.url && sbConfig.anonKey) {
          const userPayload: UserAccount = {
            username: username.trim().toLowerCase(),
            password: newPassword,
            name: username,
            role: 'User',
            department: '',
            updatedAt: new Date().toISOString()
          };
          pushUserToSupabase(sbConfig, userPayload).catch(() => {});
        }
      } catch (sbErr) {
        console.warn('Supabase password sync note:', sbErr);
      }
    }

    if (data && typeof data.success === 'boolean') {
      return data;
    }

    return {
      success: ok,
      message: message || (ok ? 'Password berhasil diperbarui.' : 'Gagal memperbarui password di server.')
    };
  } catch (err: any) {
    return {
      success: false,
      message: 'Gagal memperbarui password di server database.'
    };
  }
}

/**
 * Create new user account on server database
 */
export async function createServerUser(
  userData: {
    username: string;
    password: string;
    name: string;
    role: string;
    department: string;
    email?: string;
    phone?: string;
    nik?: string;
    bio?: string;
    avatarUrl?: string;
  }
): Promise<{ success: boolean; message: string; user?: UserAccount }> {
  try {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    const { ok, data, message } = await safeParseJson<{ success: boolean; message: string; user?: UserAccount }>(
      res,
      'Gagal membuat pengguna baru di server.'
    );

    if (data && typeof data.success === 'boolean') {
      return data;
    }

    return {
      success: ok,
      message: message || (ok ? 'Pengguna berhasil dibuat.' : 'Gagal membuat pengguna di server.')
    };
  } catch (err: any) {
    return {
      success: false,
      message: 'Gagal membuat pengguna baru di server.'
    };
  }
}

/**
 * Delete user account on server database
 */
export async function deleteServerUser(
  username: string
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(`/api/users/${encodeURIComponent(username)}`, {
      method: 'DELETE'
    });
    const { ok, data, message } = await safeParseJson<{ success: boolean; message: string }>(
      res,
      'Gagal menghapus pengguna dari server.'
    );

    if (data && typeof data.success === 'boolean') {
      return data;
    }

    return {
      success: ok,
      message: message || (ok ? 'Pengguna berhasil dihapus.' : 'Gagal menghapus pengguna dari server.')
    };
  } catch (err: any) {
    return {
      success: false,
      message: 'Gagal menghapus pengguna dari server.'
    };
  }
}

/**
 * Save persistent system configuration on server database
 */
export async function saveServerSystemConfig(
  config: Partial<SystemConfig>
): Promise<{ success: boolean; message: string; config?: SystemConfig }> {
  try {
    const res = await fetch('/api/system/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    const { ok, data, message } = await safeParseJson<{ success: boolean; message: string; config?: SystemConfig }>(
      res,
      'Gagal menyimpan konfigurasi ke server.'
    );

    if (data && typeof data.success === 'boolean') {
      return data;
    }

    return {
      success: ok,
      message: message || (ok ? 'Konfigurasi berhasil disimpan.' : 'Gagal menyimpan konfigurasi ke server.')
    };
  } catch (err: any) {
    return {
      success: false,
      message: 'Gagal menyimpan konfigurasi ke server.'
    };
  }
}

/**
 * Fetch persistent activity audit logs from server database
 */
export async function fetchServerActivityLogs(limit: number = 50): Promise<ActivityLog[]> {
  try {
    const res = await fetch(`/api/system/activity-logs?limit=${limit}`);
    const { ok, data } = await safeParseJson<{ success: boolean; logs?: ActivityLog[] }>(res, '');
    if (ok && data?.logs) {
      return data.logs;
    }
    return [];
  } catch (err) {
    return [];
  }
}

/**
 * Fetch dedicated users database metadata and info
 */
export async function fetchUserDatabaseInfo(): Promise<{
  success: boolean;
  databaseName?: string;
  fileName?: string;
  storageType?: string;
  version?: string;
  totalUsers?: number;
  lastUpdated?: string;
  usersSummary?: Array<{
    username: string;
    name: string;
    role: string;
    department: string;
    hasAvatar: boolean;
    lastLogin: string | null;
  }>;
} | null> {
  try {
    const res = await fetch('/api/users/database/info');
    const { ok, data } = await safeParseJson<any>(res, '');
    if (ok && data?.success) {
      return data;
    }
    return null;
  } catch (err) {
    return null;
  }
}

/**
 * Helper to safely trigger file download across different browser contexts & iframes
 */
export function triggerFileDownload(content: string, fileName: string, mimeType: string = 'application/json'): boolean {
  try {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.setAttribute('download', fileName);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      try {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } catch (_) {}
    }, 3000);
    return true;
  } catch (blobErr) {
    console.warn('Blob URL download failed, falling back to data URI:', blobErr);
    try {
      const dataUri = `data:${mimeType};charset=utf-8,` + encodeURIComponent(content);
      const link = document.createElement('a');
      link.href = dataUri;
      link.download = fileName;
      link.setAttribute('download', fileName);
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        try {
          document.body.removeChild(link);
        } catch (_) {}
      }, 3000);
      return true;
    } catch (uriErr) {
      console.error('All automatic download methods failed:', uriErr);
      return false;
    }
  }
}

/**
 * Get dedicated users database JSON text for backup / clipboard
 */
export async function getUsersDatabaseBackupText(): Promise<string> {
  let jsonText = '';
  try {
    const res = await fetch('/api/users/database/export');
    if (res.ok) {
      jsonText = await res.text();
    }
  } catch (_) {}

  if (!jsonText || jsonText.trim().length === 0) {
    let localUsers = [];
    let localSession = null;
    try {
      localUsers = JSON.parse(localStorage.getItem('msm_users_v2') || '[]');
      localSession = JSON.parse(localStorage.getItem('msm_session_v2') || 'null');
    } catch (_) {}

    const exportPayload = {
      version: '2.0',
      databaseName: 'PT Ajinomoto Indonesia - User Accounts & Authentication Database (Backup)',
      description: 'Dedicated database backup of system accounts, administrators, and credentials.',
      lastUpdated: new Date().toISOString(),
      users: Array.isArray(localUsers) && localUsers.length > 0 ? localUsers : (localSession ? [localSession] : [])
    };
    jsonText = JSON.stringify(exportPayload, null, 2);
  }
  return jsonText;
}

/**
 * Trigger download of dedicated users database JSON backup file
 */
export async function downloadUsersDatabaseBackup(): Promise<boolean> {
  try {
    const jsonText = await getUsersDatabaseBackupText();
    const fileName = `ajinomoto_users_db_backup_${new Date().toISOString().slice(0, 10)}.json`;
    return triggerFileDownload(jsonText, fileName, 'application/json');
  } catch (err) {
    console.error('Failed to export users database:', err);
    return false;
  }
}

export const exportUsersDatabase = downloadUsersDatabaseBackup;

/**
 * Get complete full system backup JSON text
 */
export async function getFullSystemBackupText(employees: any[] = []): Promise<string> {
  let jsonText = '';
  try {
    let localUsers = [];
    let localSession = null;
    let localConfig = {};
    try {
      localUsers = JSON.parse(localStorage.getItem('msm_users_v2') || '[]');
      localSession = JSON.parse(localStorage.getItem('msm_session_v2') || 'null');
      localConfig = JSON.parse(localStorage.getItem('msm_system_config_v2') || '{}');
    } catch (_) {}

    const res = await fetch('/api/system/database/export-full', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientEmployees: employees,
        clientUsers: localUsers,
        clientConfig: localConfig
      })
    });
    if (res.ok) {
      jsonText = await res.text();
    }
  } catch (_) {}

  if (!jsonText || jsonText.trim().length === 0) {
    let localUsers = [];
    let localSession = null;
    let localConfig = {};
    let localSmtp = {};
    let localSupabase = {};
    try {
      localUsers = JSON.parse(localStorage.getItem('msm_users_v2') || '[]');
      localSession = JSON.parse(localStorage.getItem('msm_session_v2') || 'null');
      localConfig = JSON.parse(localStorage.getItem('msm_system_config_v2') || '{}');
      localSmtp = JSON.parse(localStorage.getItem('msm_smtp_config_v2') || '{}');
      localSupabase = JSON.parse(localStorage.getItem('msm_supabase_config_v1') || '{}');
    } catch (_) {}

    const fullDatabasePayload = {
      system: 'PT Ajinomoto Indonesia - Multi-Skill Monitoring System (Comprehensive Backup)',
      version: '2.5',
      exportDate: new Date().toISOString(),
      factory: 'Mojokerto Plant',
      stats: {
        totalEmployees: employees.length,
        totalUsers: Array.isArray(localUsers) ? localUsers.length : 1,
        activeExportUser: (localSession as any)?.username || 'hr_admin'
      },
      employees,
      users: Array.isArray(localUsers) && localUsers.length > 0 ? localUsers : (localSession ? [localSession] : []),
      config: localConfig,
      smtp: localSmtp,
      cloudSync: {
        googleSheetUrl: localStorage.getItem('msm_google_sheet_url_v2') || '',
        hasSupabase: Boolean((localSupabase as any)?.url)
      }
    };
    jsonText = JSON.stringify(fullDatabasePayload, null, 2);
  }
  return jsonText;
}

/**
 * Trigger download of complete Multi-Skill system database (Employees, Skills, Matrix, Config, and Users)
 */
export async function downloadFullSystemBackup(employees: any[]): Promise<boolean> {
  try {
    const jsonText = await getFullSystemBackupText(employees);
    const fileName = `ajinomoto_full_system_database_backup_${new Date().toISOString().slice(0, 10)}.json`;
    return triggerFileDownload(jsonText, fileName, 'application/json');
  } catch (err) {
    console.error('Failed to export full system database:', err);
    return false;
  }
}

/**
 * Persist current employee dataset to Server Database (for cross-incognito recovery)
 */
export async function saveEmployeesToServer(employees: any[]): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/employees', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employees })
    });
    const { ok, data } = await safeParseJson<{ success: boolean; message: string }>(res, 'Gagal menyimpan ke server.');
    if (ok && data) {
      return data;
    }
    return { success: false, message: 'Gagal menghubungi database karyawan server.' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Koneksi ke server gagal.' };
  }
}

/**
 * Fetch persistent employee dataset from Server Database
 */
export async function fetchEmployeesFromServer(): Promise<any[] | null> {
  try {
    const res = await fetch('/api/employees');
    const { ok, data } = await safeParseJson<{ success: boolean; employees: any[] }>(res, 'Gagal memuat dari server.');
    if (ok && data?.success && Array.isArray(data.employees) && data.employees.length > 0) {
      return data.employees;
    }
    return null;
  } catch (err) {
    return null;
  }
}

/**
 * Import and restore users database from JSON string
 */
export async function importUsersDatabase(
  jsonContent: string,
  operatorUsername?: string
): Promise<{ success: boolean; message: string; count?: number }> {
  try {
    const res = await fetch('/api/users/database/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonContent, operatorUsername: operatorUsername || 'admin' })
    });
    const { ok, data, message } = await safeParseJson<{ success: boolean; message: string; count?: number }>(
      res,
      'Gagal mengimpor database pengguna.'
    );

    if (data && typeof data.success === 'boolean') {
      return data;
    }
    return {
      success: ok,
      message: message || (ok ? 'Database pengguna berhasil dipulihkan.' : 'Gagal mengimpor database pengguna.')
    };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Gagal terhubung ke server database.' };
  }
}

/**
 * Fetch all master user accounts with Supabase priority and server database fallback
 */
export async function fetchAllMasterUsers(): Promise<UserAccount[]> {
  // 1. Try Supabase first if configured
  try {
    const sbConfig = getSupabaseConfig();
    if (sbConfig && sbConfig.url && sbConfig.anonKey) {
      const sbRes = await fetchSupabaseUsers(sbConfig);
      if (sbRes.success && Array.isArray(sbRes.users)) {
        try {
          localStorage.setItem('msm_users_v2', JSON.stringify(sbRes.users));
        } catch (_) {}
        return sbRes.users;
      }
    }
  } catch (err) {
    console.warn('Supabase users fetch skipped/failed:', err);
  }

  // 2. Try Server backend
  try {
    const res = await fetch('/api/users');
    const { ok, data } = await safeParseJson<{ success: boolean; users: UserAccount[] }>(res, 'Gagal memuat master user.');
    if (ok && data?.success && Array.isArray(data.users)) {
      try {
        localStorage.setItem('msm_users_v2', JSON.stringify(data.users));
      } catch (_) {}
      return data.users;
    }
  } catch (err) {
    console.error('Error fetching master users list from server:', err);
  }

  // 3. Fallback to localStorage
  try {
    const raw = localStorage.getItem('msm_users_v2');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (_) {}

  return [];
}

/**
 * Admin: Create new user account in Supabase and server database
 */
export async function createMasterUserAccount(
  userData: Partial<UserAccount> & { password: string },
  creatorUsername: string = 'hr_admin'
): Promise<{ success: boolean; message: string; user?: UserAccount }> {
  // 1. Sync to Supabase if configured
  try {
    const sbConfig = getSupabaseConfig();
    if (sbConfig && sbConfig.url && sbConfig.anonKey && userData.username) {
      const userPayload: UserAccount = {
        username: userData.username.trim().toLowerCase(),
        password: userData.password,
        name: userData.name || userData.username,
        role: userData.role || 'HR Development Admin',
        department: userData.department || 'Human Resources Development',
        divisi: userData.divisi || 'Human Resources & Corporate Service',
        scopeType: userData.scopeType || 'ALL',
        scopeValue: userData.scopeValue || 'Semua Departemen',
        status: userData.status || 'ACTIVE',
        email: userData.email || '',
        phone: userData.phone || '',
        nik: userData.nik || '',
        bio: userData.bio || '',
        avatarUrl: userData.avatarUrl || '',
        signatureImage: userData.signatureImage || '',
        canEditCompetency: userData.canEditCompetency !== undefined ? userData.canEditCompetency : true,
        canManageUsers: userData.canManageUsers !== undefined ? userData.canManageUsers : (userData.username.toLowerCase() === 'hr_admin'),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await pushUserToSupabase(sbConfig, userPayload);
    }
  } catch (sbErr) {
    console.warn('Supabase user create sync note:', sbErr);
  }

  // 2. Sync to Server backend
  try {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...userData, creatorUsername })
    });
    const { ok, data, message } = await safeParseJson<{ success: boolean; message: string; user?: UserAccount }>(
      res,
      'Gagal membuat akun master pengguna.'
    );
    if (data && typeof data.success === 'boolean') {
      return data;
    }
    return {
      success: ok,
      message: message || (ok ? 'Akun berhasil dibuat.' : 'Gagal membuat akun.')
    };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Gagal terhubung ke database server.' };
  }
}

/**
 * Admin: Update user account in Supabase and server database
 */
export async function adminUpdateMasterUser(
  username: string,
  updates: Partial<UserAccount> & { newPassword?: string },
  operatorUsername: string = 'hr_admin'
): Promise<{ success: boolean; message: string; user?: UserAccount }> {
  // 1. Sync to Supabase if configured
  try {
    const sbConfig = getSupabaseConfig();
    if (sbConfig && sbConfig.url && sbConfig.anonKey) {
      const userPayload: UserAccount = {
        username: username.trim().toLowerCase(),
        password: updates.newPassword || updates.password || 'password123',
        name: updates.name || username,
        role: updates.role || 'HR Development Admin',
        department: updates.department || 'Human Resources Development',
        divisi: updates.divisi || 'Human Resources & Corporate Service',
        scopeType: updates.scopeType || 'ALL',
        scopeValue: updates.scopeValue || 'Semua Departemen',
        status: updates.status || 'ACTIVE',
        email: updates.email || '',
        phone: updates.phone || '',
        nik: updates.nik || '',
        bio: updates.bio || '',
        avatarUrl: updates.avatarUrl || '',
        signatureImage: updates.signatureImage || '',
        canEditCompetency: updates.canEditCompetency !== undefined ? updates.canEditCompetency : true,
        canManageUsers: updates.canManageUsers !== undefined ? updates.canManageUsers : (username.toLowerCase() === 'hr_admin'),
        updatedAt: new Date().toISOString()
      };
      await pushUserToSupabase(sbConfig, userPayload);
    }
  } catch (sbErr) {
    console.warn('Supabase user update sync note:', sbErr);
  }

  // 2. Sync to Server backend
  try {
    const res = await fetch(`/api/users/${encodeURIComponent(username)}/admin-update`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...updates, operatorUsername })
    });
    const { ok, data, message } = await safeParseJson<{ success: boolean; message: string; user?: UserAccount }>(
      res,
      'Gagal memperbarui akun di server.'
    );
    if (data && typeof data.success === 'boolean') {
      return data;
    }
    return {
      success: ok,
      message: message || (ok ? 'Akun berhasil diperbarui.' : 'Gagal memperbarui akun.')
    };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Gagal terhubung ke database server.' };
  }
}

/**
 * Admin: Reset user password in Supabase and server database
 */
export async function adminResetUserPasswordApi(
  username: string,
  newPassword: string,
  operatorUsername: string = 'hr_admin'
): Promise<{ success: boolean; message: string }> {
  // 1. Sync to Supabase if configured
  try {
    const sbConfig = getSupabaseConfig();
    if (sbConfig && sbConfig.url && sbConfig.anonKey) {
      const userPayload: UserAccount = {
        username: username.trim().toLowerCase(),
        password: newPassword,
        name: username,
        role: 'User',
        department: '',
        updatedAt: new Date().toISOString()
      };
      await pushUserToSupabase(sbConfig, userPayload);
    }
  } catch (sbErr) {
    console.warn('Supabase password reset sync note:', sbErr);
  }

  // 2. Sync to Server backend
  try {
    const res = await fetch(`/api/users/${encodeURIComponent(username)}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword, operatorUsername })
    });
    const { ok, data, message } = await safeParseJson<{ success: boolean; message: string }>(
      res,
      'Gagal mereset kata sandi pengguna.'
    );
    if (data && typeof data.success === 'boolean') {
      return data;
    }
    return {
      success: ok,
      message: message || (ok ? 'Kata sandi berhasil direset.' : 'Gagal mereset kata sandi.')
    };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Gagal terhubung ke database server.' };
  }
}

/**
 * Admin: Delete user account from Supabase and server database
 */
export async function deleteMasterUserAccount(
  username: string,
  operatorUsername: string = 'hr_admin'
): Promise<{ success: boolean; message: string }> {
  // 1. Immediately purge from localStorage so UI and cache never resurrect deleted user
  try {
    const raw = localStorage.getItem('msm_users_v2');
    if (raw) {
      const parsed: UserAccount[] = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter(u => u.username.toLowerCase() !== username.toLowerCase());
        localStorage.setItem('msm_users_v2', JSON.stringify(filtered));
      }
    }
  } catch (_) {}

  // 2. Delete from Supabase if configured
  try {
    const sbConfig = getSupabaseConfig();
    if (sbConfig && sbConfig.url && sbConfig.anonKey) {
      await deleteUserFromSupabase(sbConfig, username);
    }
  } catch (sbErr) {
    console.warn('Supabase delete user sync note:', sbErr);
  }

  // 3. Delete from Server backend
  try {
    const res = await fetch(`/api/users/${encodeURIComponent(username)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operatorUsername })
    });
    const { ok, data, message } = await safeParseJson<{ success: boolean; message: string }>(
      res,
      'Gagal menghapus akun pengguna.'
    );
    if (data && typeof data.success === 'boolean') {
      return data;
    }
    return {
      success: ok,
      message: message || (ok ? 'Akun berhasil dihapus.' : 'Gagal menghapus akun.')
    };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Gagal terhubung ke database server.' };
  }
}

/**
 * Reset users database to default
 */
export async function resetUsersDatabase(
  operatorUsername?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/users/database/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operatorUsername: operatorUsername || 'admin' })
    });
    const { ok, data, message } = await safeParseJson<{ success: boolean; message: string }>(
      res,
      'Gagal mereset database pengguna.'
    );
    if (data && typeof data.success === 'boolean') {
      return data;
    }
    return {
      success: ok,
      message: message || (ok ? 'Database pengguna berhasil direset.' : 'Gagal mereset database pengguna.')
    };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Gagal mereset database pengguna.' };
  }
}

