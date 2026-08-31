import {
  Employee,
  SkillMeta,
  UserAccount,
  UserSession,
  PeriodsData,
  ConfigMeta,
  DashboardStats,
  PositionStat,
  GroupStat,
  AppFiltersState,
  JobPositionCategory,
  SystemConfig,
  ActivityLog,
  EmailLog
} from '../types';
import {
  INITIAL_USERS,
  INITIAL_SKILL_META,
  CONFIG_META,
  GRADE_ORDER,
  BULAN_LABELS,
  generateInitialEmployees,
  calculateEmployeeScore
} from '../data/initialData';
import {
  fetchSystemInit,
  serverLogin,
  updateServerUserProfile,
  serverChangePassword,
  saveEmployeesToServer,
  fetchEmployeesFromServer
} from './systemDbService';
import {
  getSupabaseConfig,
  fetchSupabaseUsers,
  authenticateUserSupabase
} from './syncService';

export { calculateEmployeeScore };
import { jsPDF } from 'jspdf';

const STORAGE_KEYS = {
  EMPLOYEES: 'msm_employees_v2',
  USERS: 'msm_users_v2',
  SESSION: 'msm_session_v2',
  DARK_MODE: 'msm.darkMode'
};

export const AJINOMOTO_LOGO_URL = 'https://upload.wikimedia.org/wikipedia/commons/0/01/Ajinomoto_Group_Global_Brand_logo.png';

// Storage helpers
export function getStoredEmployees(): Employee[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.EMPLOYEES);
    let employees: Employee[];
    if (!raw) {
      employees = generateInitialEmployees();
      saveStoredEmployees(employees);
      return employees;
    }
    employees = JSON.parse(raw);
    
    // Ensure all loaded employees have up-to-date score and result calculations
    let needsUpdate = false;
    const sanitized = employees.map((emp) => {
      const skills = emp.skills || {};
      const calc = calculateEmployeeScore(skills, emp.jabatan, emp.standard);
      if (
        emp.totalScore !== calc.totalScore ||
        emp.result !== calc.result ||
        emp.standard !== calc.standard ||
        emp.gap !== calc.gap ||
        emp.jobCategory !== calc.jobCategory
      ) {
        needsUpdate = true;
        return {
          ...emp,
          jobCategory: calc.jobCategory,
          totalScore: calc.totalScore,
          standard: calc.standard,
          result: calc.result,
          gap: calc.gap
        };
      }
      return emp;
    });

    if (needsUpdate) {
      saveStoredEmployees(sanitized);
      return sanitized;
    }

    return employees;
  } catch (err) {
    console.error('Error loading employees:', err);
    return generateInitialEmployees();
  }
}

export function saveStoredEmployees(employees: Employee[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(employees));
    // Asynchronously synchronize employees to persistent server disk
    saveEmployeesToServer(employees).catch(() => {});
  } catch (err) {
    console.error('Error saving employees:', err);
  }
}

export function getStoredUsers(): UserAccount[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USERS);
    if (!raw) {
      saveStoredUsers(INITIAL_USERS);
      return INITIAL_USERS;
    }
    const parsed: UserAccount[] = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      saveStoredUsers(INITIAL_USERS);
      return INITIAL_USERS;
    }
    return parsed;
  } catch (err) {
    console.error('Error loading users:', err);
    return INITIAL_USERS;
  }
}

export function saveStoredUsers(users: UserAccount[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  } catch (err) {
    console.error('Error saving users:', err);
  }
}

/**
 * Synchronize users and system settings from Supabase & Server Database.
 * Runs on boot and on demand to guarantee instant cross-incognito profile restoration.
 */
export async function syncSystemFromBackend(): Promise<{ users: UserAccount[]; config?: SystemConfig } | null> {
  let syncedUsers: UserAccount[] = [];
  let systemConfig: SystemConfig | undefined;

  // 1. Check Supabase first for absolute cloud persistence across browsers/sessions
  try {
    const sbConfig = getSupabaseConfig();
    if (sbConfig && sbConfig.url && sbConfig.anonKey) {
      const sbUsersRes = await fetchSupabaseUsers(sbConfig);
      if (sbUsersRes.success && sbUsersRes.users && sbUsersRes.users.length > 0) {
        syncedUsers = sbUsersRes.users;
        saveStoredUsers(syncedUsers);
      }
    }
  } catch (sbErr) {
    console.warn('Supabase initial user sync note:', sbErr);
  }

  // 2. Also fetch from Server Database (/api/system/init)
  try {
    const initData = await fetchSystemInit();
    if (initData) {
      systemConfig = initData.config;
      
      // Auto-propagate Supabase config from Server to any fresh/incognito browser
      if (initData.config?.supabaseConfig && initData.config.supabaseConfig.url && initData.config.supabaseConfig.anonKey) {
        const localSb = getSupabaseConfig();
        if (!localSb.url || !localSb.anonKey) {
          try {
            localStorage.setItem('msm_supabase_config_v1', JSON.stringify(initData.config.supabaseConfig));
          } catch (_) {}

          // Auto-fetch users directly from Supabase using server-persisted credentials
          const sbUsersRes = await fetchSupabaseUsers(initData.config.supabaseConfig);
          if (sbUsersRes.success && sbUsersRes.users && sbUsersRes.users.length > 0) {
            syncedUsers = sbUsersRes.users;
            saveStoredUsers(syncedUsers);
          }
        }
      }

      if (syncedUsers.length === 0 && initData.users && initData.users.length > 0) {
        syncedUsers = initData.users;
        saveStoredUsers(syncedUsers);
      }
    }
  } catch (err) {
    console.warn('System init from backend skipped:', err);
  }

  if (syncedUsers.length > 0) {
    // If active session exists, refresh with latest profile details
    const currentSession = getStoredSession();
    const targetUser = currentSession?.username
      ? syncedUsers.find((u) => u.username.trim().toLowerCase() === currentSession.username.trim().toLowerCase())
      : (syncedUsers.find((u) => u.username.trim().toLowerCase() === 'hr_admin') || syncedUsers[0]);

    if (targetUser) {
      const refreshedSession: UserSession = {
        username: targetUser.username,
        name: targetUser.name || 'Mahmud Nurdiansyah',
        role: targetUser.role || 'HR Development Admin',
        department: targetUser.department || 'Human Resources Development',
        divisi: targetUser.divisi || '',
        scopeType: targetUser.scopeType || 'ALL',
        scopeValue: targetUser.scopeValue || '',
        status: targetUser.status || 'ACTIVE',
        email: targetUser.email || 'mahmudnurdiansyah4@gmail.com',
        phone: targetUser.phone || '0819-1932-7912',
        nik: targetUser.nik || '122108091',
        avatarUrl: targetUser.avatarUrl || '',
        bio: targetUser.bio || 'Administrator Multi-Skill Monitoring & Pengembangan Kompetensi Karyawan PT Ajinomoto Indonesia Mojokerto Factory.',
        canEditCompetency: targetUser.canEditCompetency !== undefined ? targetUser.canEditCompetency : true,
        canManageUsers: targetUser.canManageUsers !== undefined ? targetUser.canManageUsers : (targetUser.username === 'hr_admin'),
        token: currentSession?.token || 'tok_admin_' + Date.now()
      };
      saveStoredSession(refreshedSession);
    }

    return { users: syncedUsers, config: systemConfig };
  }

  return null;
}

export function getStoredSession(): UserSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SESSION);
    if (!raw) return null;
    const session: UserSession = JSON.parse(raw);
    return session;
  } catch (err) {
    return null;
  }
}

export const getSession = getStoredSession;

export function saveStoredSession(session: UserSession | null): void {
  try {
    if (session) {
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
    } else {
      localStorage.removeItem(STORAGE_KEYS.SESSION);
    }
  } catch (err) {
    console.error('Error saving session:', err);
  }
}

export const saveSession = saveStoredSession;

export function clearSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.SESSION);
  } catch (err) {
    console.error('Error clearing session:', err);
  }
}

/**
 * Check Login with Supabase & Server Authentication first, seamless fallback to local cache
 */
export async function checkLoginAsync(
  username: string,
  password: string
): Promise<{ success: boolean; message?: string; session?: UserSession }> {
  const cleanUsername = username.trim();

  // 1. Try Supabase Authentication first if configured
  try {
    const sbConfig = getSupabaseConfig();
    if (sbConfig && sbConfig.url && sbConfig.anonKey) {
      const sbAuth = await authenticateUserSupabase(sbConfig, cleanUsername, password);
      if (sbAuth.success && sbAuth.user) {
        const u = sbAuth.user;
        const session: UserSession = {
          username: u.username,
          name: u.name || u.username,
          role: u.role || 'User',
          department: u.department || '',
          divisi: u.divisi || '',
          scopeType: u.scopeType || 'ALL',
          scopeValue: u.scopeValue || '',
          status: u.status || 'ACTIVE',
          email: u.email || '',
          phone: u.phone || '',
          nik: u.nik || '',
          avatarUrl: u.avatarUrl || '',
          bio: u.bio || '',
          signatureImage: u.signatureImage || '',
          canEditCompetency: u.canEditCompetency !== undefined ? u.canEditCompetency : true,
          canManageUsers: u.canManageUsers !== undefined ? u.canManageUsers : (u.username.toLowerCase() === 'hr_admin'),
          token: 'tok_sb_' + Date.now()
        };
        saveStoredSession(session);

        // Update local users cache
        const users = getStoredUsers();
        const idx = users.findIndex((existing) => existing.username.trim().toLowerCase() === u.username.trim().toLowerCase());
        if (idx !== -1) {
          users[idx] = { ...users[idx], ...u };
        } else {
          users.push(u);
        }
        saveStoredUsers(users);

        return { success: true, session };
      } else {
        // If Supabase table doesn't exist, or user isn't in Supabase yet, log and fall through to Server & Local DB
        console.warn('Supabase auth did not succeed, falling back to Server/Local DB:', sbAuth.message);
      }
    }
  } catch (sbErr) {
    console.warn('Supabase login check skipped:', sbErr);
  }
  
  // 2. Try Server backend
  try {
    const serverRes = await serverLogin(cleanUsername, password);
    if (serverRes.success && serverRes.session) {
      saveStoredSession(serverRes.session);
      // Refresh local users list
      if (serverRes.user) {
        const users = getStoredUsers();
        const idx = users.findIndex(
          (u) => u.username.trim().toLowerCase() === serverRes.user!.username.trim().toLowerCase()
        );
        if (idx !== -1) {
          users[idx] = { ...users[idx], ...serverRes.user };
        } else {
          users.push(serverRes.user);
        }
        saveStoredUsers(users);
      }
      return { success: true, session: serverRes.session };
    }
  } catch (err) {
    console.warn('Backend login attempt encountered an exception, proceeding with local fallback:', err);
  }

  // 3. Fallback to local authentication
  const localRes = checkLogin(cleanUsername, password);
  if (localRes.success) {
    return localRes;
  }

  return {
    success: false,
    message: 'Username atau kata sandi tidak sesuai. Mohon periksa kembali kredensial Anda.'
  };
}

export function checkLogin(username: string, password: string): { success: boolean; message?: string; session?: UserSession } {
  const users = getStoredUsers();
  const user = users.find((u) => u.username.trim().toLowerCase() === username.trim().toLowerCase() && u.password === password);
  
  if (!user) {
    return { success: false, message: 'Username atau password salah. Silakan coba lagi.' };
  }

  if (user.status === 'INACTIVE') {
    return { success: false, message: 'Akun ini berstatus non-aktif. Silakan hubungi Super Administrator HRD.' };
  }

  const session: UserSession = {
    username: user.username,
    name: user.name,
    role: user.role,
    department: user.department,
    divisi: user.divisi || '',
    scopeType: user.scopeType || 'ALL',
    scopeValue: user.scopeValue || '',
    status: user.status || 'ACTIVE',
    email: user.email || '',
    phone: user.phone || '',
    nik: user.nik || '',
    avatarUrl: user.avatarUrl || '',
    bio: user.bio || '',
    canEditCompetency: user.canEditCompetency !== undefined ? user.canEditCompetency : true,
    canManageUsers: user.canManageUsers !== undefined ? user.canManageUsers : (user.username === 'hr_admin'),
    token: 'tok_' + Math.random().toString(36).substring(2) + Date.now().toString(36)
  };

  saveStoredSession(session);
  return { success: true, session };
}

export async function changePasswordAsync(
  username: string,
  oldPw: string,
  newPw: string
): Promise<{ success: boolean; message: string }> {
  try {
    const serverRes = await serverChangePassword(username, oldPw, newPw);
    if (serverRes.success) {
      // Also update local cache
      changePassword(username, oldPw, newPw);
      return serverRes;
    }
    return serverRes;
  } catch (_) {
    return changePassword(username, oldPw, newPw);
  }
}

export function changePassword(username: string, oldPw: string, newPw: string): { success: boolean; message: string } {
  const users = getStoredUsers();
  const idx = users.findIndex((u) => u.username.trim().toLowerCase() === username.trim().toLowerCase());
  
  if (idx === -1) {
    return { success: false, message: 'Akun pengguna tidak ditemukan.' };
  }
  if (users[idx].password !== oldPw) {
    return { success: false, message: 'Password lama tidak sesuai.' };
  }
  if (!newPw || newPw.length < 6) {
    return { success: false, message: 'Password baru minimal 6 karakter.' };
  }

  users[idx].password = newPw;
  saveStoredUsers(users);
  return { success: true, message: 'Password berhasil diperbarui.' };
}

/**
 * Asynchronously update user profile & photo in Server Database + Local Cache
 */
export async function updateUserProfileAsync(
  oldUsername: string,
  updatedData: Partial<UserAccount>
): Promise<{ success: boolean; message: string; session?: UserSession; user?: UserAccount }> {
  const targetUsername = oldUsername?.trim() || getStoredSession()?.username || 'hr_admin';
  
  try {
    const serverRes = await updateServerUserProfile(targetUsername, updatedData);
    if (serverRes.success) {
      // Update local storage as well
      const localResult = updateUserProfile(targetUsername, updatedData);
      const finalSession = serverRes.session || localResult.session;
      if (finalSession) {
        saveStoredSession(finalSession);
      }
      return {
        success: true,
        message: serverRes.message || 'Profil dan foto pengguna berhasil diperbarui di database.',
        session: finalSession,
        user: serverRes.user
      };
    }
  } catch (err) {
    console.warn('Server profile update error, continuing with local storage fallback:', err);
  }

  // Fallback to local storage update
  const localResult = updateUserProfile(targetUsername, updatedData);
  return {
    success: localResult.success,
    message: localResult.success
      ? 'Profil dan foto pengguna berhasil diperbarui.'
      : (localResult.message || 'Gagal memperbarui profil pengguna.'),
    session: localResult.session
  };
}

export function updateUserProfile(
  oldUsername: string,
  updatedData: Partial<UserAccount>
): { success: boolean; message: string; session?: UserSession } {
  const users = getStoredUsers();
  const cleanOld = (oldUsername || '').trim().toLowerCase();
  let idx = users.findIndex((u) => u.username.trim().toLowerCase() === cleanOld);

  if (idx === -1) {
    if (updatedData.email) {
      idx = users.findIndex((u) => u.email?.trim().toLowerCase() === updatedData.email?.trim().toLowerCase());
    }
    if (idx === -1 && updatedData.nik) {
      idx = users.findIndex((u) => u.nik?.trim().toLowerCase() === updatedData.nik?.trim().toLowerCase());
    }
    if (idx === -1 && users.length > 0) {
      const hrIdx = users.findIndex((u) => u.username.toLowerCase() === 'hr_admin');
      idx = hrIdx !== -1 ? hrIdx : 0;
    }
  }

  if (idx === -1) {
    const newUser: UserAccount = {
      username: updatedData.username?.trim() || 'hr_admin',
      password: 'password123',
      name: updatedData.name?.trim() || 'Mahmud Nurdiansyah',
      role: updatedData.role?.trim() || 'HR Development Admin',
      department: updatedData.department?.trim() || 'Human Resources Development',
      email: updatedData.email?.trim() || 'mahmudnurdiansyah4@gmail.com',
      phone: updatedData.phone?.trim() || '0819-1932-7912',
      nik: updatedData.nik?.trim() || '122108091',
      avatarUrl: updatedData.avatarUrl || '',
      bio: updatedData.bio || 'Administrator Multi-Skill Monitoring & Pengembangan Kompetensi Karyawan PT Ajinomoto Indonesia Mojokerto Factory.'
    };
    users.push(newUser);
    saveStoredUsers(users);
    const session: UserSession = {
      username: newUser.username,
      name: newUser.name,
      role: newUser.role,
      department: newUser.department,
      email: newUser.email,
      phone: newUser.phone,
      nik: newUser.nik,
      avatarUrl: newUser.avatarUrl,
      bio: newUser.bio,
      token: 'tok_admin_' + Date.now()
    };
    saveStoredSession(session);
    return { success: true, message: 'Profil pengguna berhasil diperbarui.', session };
  }

  // If changing username, ensure uniqueness
  if (updatedData.username && updatedData.username.trim().toLowerCase() !== users[idx].username.trim().toLowerCase()) {
    const isTaken = users.some(
      (u, i) => i !== idx && u.username.trim().toLowerCase() === updatedData.username!.trim().toLowerCase()
    );
    if (isTaken) {
      return { success: false, message: `Username "${updatedData.username}" sudah digunakan oleh akun lain.` };
    }
  }

  const currentUserData = users[idx];
  const mergedUser: UserAccount = {
    ...currentUserData,
    ...updatedData,
    username: updatedData.username?.trim() || currentUserData.username,
    name: updatedData.name?.trim() || currentUserData.name,
    role: updatedData.role?.trim() || currentUserData.role,
    department: updatedData.department?.trim() || currentUserData.department,
    email: updatedData.email?.trim() || currentUserData.email,
    phone: updatedData.phone?.trim() || currentUserData.phone,
    nik: updatedData.nik?.trim() || currentUserData.nik,
    avatarUrl: updatedData.avatarUrl !== undefined ? updatedData.avatarUrl : currentUserData.avatarUrl,
    bio: updatedData.bio !== undefined ? updatedData.bio : currentUserData.bio
  };

  users[idx] = mergedUser;
  saveStoredUsers(users);

  // Trigger server sync in background if available
  updateServerUserProfile(oldUsername || mergedUser.username, updatedData).catch(() => {});

  // Update active session
  const currentSession = getStoredSession();
  const updatedSession: UserSession = {
    ...currentSession,
    username: mergedUser.username,
    name: mergedUser.name,
    role: mergedUser.role,
    department: mergedUser.department,
    email: mergedUser.email,
    phone: mergedUser.phone,
    nik: mergedUser.nik,
    avatarUrl: mergedUser.avatarUrl,
    bio: mergedUser.bio,
    token: currentSession?.token || 'tok_admin_' + Date.now()
  };

  saveStoredSession(updatedSession);
  return { success: true, message: 'Profil admin berhasil diperbarui.', session: updatedSession };
}

// Compute dynamic periods data from employee list
export function getPeriods(employees: Employee[]): PeriodsData {
  const tahunSet: Record<string, boolean> = {};
  const bulanByTahun: Record<string, Record<string, boolean>> = {};

  employees.forEach((e) => {
    if (!e.tahun) return;
    const tKey = String(e.tahun);
    tahunSet[tKey] = true;
    if (!bulanByTahun[tKey]) bulanByTahun[tKey] = {};
    if (e.bulan) bulanByTahun[tKey][String(e.bulan)] = true;
  });

  const tahunList = Object.keys(tahunSet)
    .map(Number)
    .sort((a, b) => b - a);

  const bulanByTahunList: Record<string, number[]> = {};
  Object.keys(bulanByTahun).forEach((k) => {
    bulanByTahunList[k] = Object.keys(bulanByTahun[k])
      .map(Number)
      .sort((a, b) => a - b);
  });

  const now = new Date();
  return {
    tahunList: tahunList.length ? tahunList : [now.getFullYear()],
    bulanByTahun: bulanByTahunList,
    currentTahun: now.getFullYear(),
    currentBulan: now.getMonth() + 1,
    bulanLabels: BULAN_LABELS
  };
}

export const extractPeriods = getPeriods;

/**
 * Mendapatkan filter periode default:
 * 1. Tahun dan bulan saat ini jika datanya tersedia di database karyawan.
 * 2. Jika data tahun & bulan saat ini tidak ada, tampilkan periode data terakhir dalam waktu terdekat yang tersedia.
 */
export function getDefaultFilterPeriod(employees: Employee[]): { tahun: string[]; bulan: string[] } {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (!employees || employees.length === 0) {
    return {
      tahun: [String(currentYear)],
      bulan: [String(currentMonth)]
    };
  }

  // 1. Cek apakah ada data di tahun & bulan saat ini
  const hasCurrent = employees.some(
    (e) => Number(e.tahun) === currentYear && Number(e.bulan) === currentMonth
  );

  if (hasCurrent) {
    return {
      tahun: [String(currentYear)],
      bulan: [String(currentMonth)]
    };
  }

  // 2. Kumpulkan seluruh periode (tahun, bulan) unik yang valid dari dataset
  const periodMap = new Map<string, { tahun: number; bulan: number; count: number; weight: number }>();

  employees.forEach((e) => {
    const t = Number(e.tahun);
    const b = Number(e.bulan);
    if (!isNaN(t) && t > 0 && !isNaN(b) && b >= 1 && b <= 12) {
      const key = `${t}-${b}`;
      const existing = periodMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        periodMap.set(key, { tahun: t, bulan: b, count: 1, weight: t * 12 + b });
      }
    }
  });

  const periodList = Array.from(periodMap.values());

  if (periodList.length === 0) {
    return {
      tahun: [String(currentYear)],
      bulan: [String(currentMonth)]
    };
  }

  // Urutkan menurun berdasarkan bobot kronologis waktu (terbaru ke terlama)
  periodList.sort((a, b) => b.weight - a.weight);

  const currentWeight = currentYear * 12 + currentMonth;

  // Utamakan data terakhir yang <= waktu sekarang (waktu terdekat yang sudah ada)
  const pastOrPresent = periodList.filter((p) => p.weight <= currentWeight);
  const bestPeriod = pastOrPresent.length > 0 ? pastOrPresent[0] : periodList[0];

  return {
    tahun: [String(bestPeriod.tahun)],
    bulan: [String(bestPeriod.bulan)]
  };
}

export function getFilteredEmployees(employees: Employee[], filters: AppFiltersState): Employee[] {
  return employees.filter((e) => {
    if (filters.tahun.length && !filters.tahun.includes(String(e.tahun || ''))) return false;
    if (filters.bulan.length && !filters.bulan.includes(String(e.bulan || ''))) return false;
    if (filters.divisi.length && !filters.divisi.includes(e.divisi)) return false;
    if (filters.department.length && !filters.department.includes(e.department)) return false;
    if (filters.jabatan.length && !filters.jabatan.includes(e.jabatan)) return false;
    return true;
  });
}

export const filterEmployees = getFilteredEmployees;

export function sortByGradeOrder<T extends { label?: string; grade?: string } | string>(list: T[]): T[] {
  function orderIndex(v: any) {
    const str = typeof v === 'string' ? v : (v.label || v.grade || '');
    const idx = GRADE_ORDER.indexOf(str.trim().toUpperCase());
    return idx === -1 ? GRADE_ORDER.length : idx;
  }
  return [...list].sort((a, b) => {
    const ia = orderIndex(a);
    const ib = orderIndex(b);
    if (ia !== ib) return ia - ib;
    const sa = typeof a === 'string' ? a : (a.label || a.grade || '');
    const sb = typeof b === 'string' ? b : (b.label || b.grade || '');
    return sa.localeCompare(sb);
  });
}

export function computeDashboardStats(employees: Employee[], configMeta: ConfigMeta = CONFIG_META): DashboardStats {
  const { jobPositionMeta, targetPercent } = configMeta;

  let totalMS = 0;
  let totalUS = 0;

  const byPosition: Record<JobPositionCategory, { ok: number; notOk: number }> = {
    LL_FOREMAN: { ok: 0, notOk: 0 },
    ASM_SM: { ok: 0, notOk: 0 },
    DEPT_MGR_UP: { ok: 0, notOk: 0 }
  };

  const divisiMap: Record<string, { label: string; ms: number; us: number }> = {};
  const deptMap: Record<string, { label: string; ms: number; us: number }> = {};
  const gradeMap: Record<string, { label: string; ms: number; us: number }> = {};
  const genderMap = { L: 0, P: 0, Lainnya: 0 };

  employees.forEach((emp) => {
    if (emp.result === 'MS') totalMS++;
    else if (emp.result === 'US') totalUS++;

    if (emp.jobCategory && emp.result) {
      if (emp.result === 'MS') byPosition[emp.jobCategory].ok++;
      else byPosition[emp.jobCategory].notOk++;
    }

    const divisiKey = emp.divisi || '(Tanpa Divisi)';
    if (!divisiMap[divisiKey]) divisiMap[divisiKey] = { label: divisiKey, ms: 0, us: 0 };
    if (emp.result === 'MS') divisiMap[divisiKey].ms++;
    else if (emp.result === 'US') divisiMap[divisiKey].us++;

    const deptKey = emp.department || '(Tanpa Department)';
    if (!deptMap[deptKey]) deptMap[deptKey] = { label: deptKey, ms: 0, us: 0 };
    if (emp.result === 'MS') deptMap[deptKey].ms++;
    else if (emp.result === 'US') deptMap[deptKey].us++;

    const gradeKey = emp.grade || '(Tanpa Grade)';
    if (!gradeMap[gradeKey]) gradeMap[gradeKey] = { label: gradeKey, ms: 0, us: 0 };
    if (emp.result === 'MS') gradeMap[gradeKey].ms++;
    else if (emp.result === 'US') gradeMap[gradeKey].us++;

    const g = (emp.gender || '').toString().trim().toUpperCase();
    if (g === 'L') genderMap.L++;
    else if (g === 'P') genderMap.P++;
    else genderMap.Lainnya++;
  });

  const totalManpower = totalMS + totalUS;

  const positionKeys: JobPositionCategory[] = ['DEPT_MGR_UP', 'ASM_SM', 'LL_FOREMAN'];
  const byPositionArray: PositionStat[] = positionKeys.map((key) => {
    const meta = jobPositionMeta[key];
    const counts = byPosition[key];
    const manpower = counts.ok + counts.notOk;
    return {
      key,
      label: meta.label,
      threshold: meta.threshold,
      target: targetPercent[key],
      manpower,
      ok: counts.ok,
      notOk: counts.notOk,
      resultPercent: manpower > 0 ? counts.ok / manpower : 0
    };
  });

  const sortDesc = (a: GroupStat, b: GroupStat) => (b.ms + b.us) - (a.ms + a.us);
  const byDivisi = Object.values(divisiMap).sort(sortDesc);
  const byDepartment = Object.values(deptMap).sort(sortDesc);
  const byGrade = sortByGradeOrder(Object.values(gradeMap));

  return {
    totalManpower,
    totalMS,
    totalUS,
    percentMS: totalManpower > 0 ? totalMS / totalManpower : 0,
    byPosition: byPositionArray,
    byDivisi,
    byDepartment,
    byGrade,
    genderMap,
    notes: [
      'Data dihitung realtime dari sheet "Baseline Data Multi Skill" sesuai filter aktif.',
      'Gunakan filter Tahun/Bulan/Divisi/Department/Jabatan di atas untuk mempersempit tampilan matriks.',
      'Standar threshold: Dept Mgr Up (≥4 seksi), ASM-SM (≥3 seksi), LL-Foreman (≥2 seksi).'
    ],
    lastUpdated: new Date().toISOString()
  };
}

export function updateEmployeeSkillMatrix(
  employees: Employee[],
  rowIndex: number,
  skillCode: string,
  checked: boolean
): { updatedEmployees: Employee[]; updatedEmployee: Employee } {
  const index = employees.findIndex((e) => e.rowIndex === rowIndex);
  if (index === -1) {
    throw new Error('Baris data karyawan tidak ditemukan.');
  }

  const emp = { ...employees[index] };
  const updatedSkills = { ...emp.skills, [skillCode]: checked };
  const calc = calculateEmployeeScore(updatedSkills, emp.jabatan, emp.standard);

  const updatedEmployee: Employee = {
    ...emp,
    skills: updatedSkills,
    totalScore: calc.totalScore,
    standard: calc.standard,
    result: calc.result,
    gap: calc.gap,
    jobCategory: calc.jobCategory
  };

  const updatedEmployees = [...employees];
  updatedEmployees[index] = updatedEmployee;
  saveStoredEmployees(updatedEmployees);

  return { updatedEmployees, updatedEmployee };
}

export function addNewEmployee(
  employees: Employee[],
  payload: {
    empId: string;
    empName: string;
    divisi?: string;
    department?: string;
    section?: string;
    grade?: string;
    jobGrade?: string;
    jabatan?: string;
    gender?: string;
    pic?: string;
    tahun: number;
    bulan: number;
  }
): { success: boolean; message: string; employees: Employee[] } {
  const exists = employees.some(
    (e) =>
      e.empId.trim().toLowerCase() === payload.empId.trim().toLowerCase() &&
      Number(e.tahun) === Number(payload.tahun) &&
      Number(e.bulan) === Number(payload.bulan)
  );

  if (exists) {
    return { success: false, message: 'Karyawan dengan Emp. ID tersebut sudah ada pada periode ini.', employees };
  }

  const maxRowIndex = employees.reduce((max, e) => Math.max(max, e.rowIndex || 0), 6);
  const maxNo = employees.reduce((max, e) => Math.max(max, e.no || 0), 0);

  const emptySkills: Record<string, boolean> = {};
  INITIAL_SKILL_META.forEach((sm) => {
    emptySkills[sm.code] = false;
  });

  const calc = calculateEmployeeScore(emptySkills, payload.jabatan || '');

  const newEmployee: Employee = {
    rowIndex: maxRowIndex + 1,
    no: maxNo + 1,
    empId: payload.empId.trim(),
    empName: payload.empName.trim(),
    divisi: payload.divisi?.trim() || '',
    department: payload.department?.trim() || '',
    section: payload.section?.trim() || '',
    grade: payload.grade?.trim() || '',
    jobGrade: payload.jobGrade?.trim() || '',
    jabatan: payload.jabatan?.trim() || '',
    gender: payload.gender || 'L',
    pic: payload.pic?.trim() || '',
    tahun: Number(payload.tahun),
    bulan: Number(payload.bulan),
    jobCategory: calc.jobCategory,
    totalScore: calc.totalScore,
    standard: calc.standard,
    result: calc.result,
    gap: calc.gap,
    skills: emptySkills
  };

  const updatedEmployees = [...employees, newEmployee];
  saveStoredEmployees(updatedEmployees);
  return { success: true, message: 'Karyawan baru berhasil ditambahkan.', employees: updatedEmployees };
}

export function deleteEmployee(employees: Employee[], rowIndex: number): { success: boolean; message: string; employees: Employee[] } {
  const updatedEmployees = employees.filter((e) => e.rowIndex !== rowIndex);
  saveStoredEmployees(updatedEmployees);
  return { success: true, message: 'Data karyawan berhasil dihapus.', employees: updatedEmployees };
}

export function duplicatePeriod(
  employees: Employee[],
  sourceTahun: number,
  sourceBulan: number,
  targetTahun: number,
  targetBulan: number
): { success: boolean; message: string; count: number; employees: Employee[] } {
  const sourceRows = employees.filter(
    (e) => Number(e.tahun) === Number(sourceTahun) && Number(e.bulan) === Number(sourceBulan)
  );

  if (!sourceRows.length) {
    return { success: false, message: 'Tidak ditemukan data pada periode sumber tersebut.', count: 0, employees };
  }

  let nextRowIndex = employees.reduce((max, e) => Math.max(max, e.rowIndex || 0), 6) + 1;
  let nextNo = employees.reduce((max, e) => Math.max(max, e.no || 0), 0) + 1;

  const duplicatedRows: Employee[] = sourceRows.map((src) => {
    return {
      ...src,
      rowIndex: nextRowIndex++,
      no: nextNo++,
      tahun: Number(targetTahun),
      bulan: Number(targetBulan),
      skills: { ...src.skills } // deep clone skills
    };
  });

  const updatedEmployees = [...employees, ...duplicatedRows];
  saveStoredEmployees(updatedEmployees);

  return {
    success: true,
    count: duplicatedRows.length,
    message: `${duplicatedRows.length} data karyawan berhasil diduplikasi ke periode ${BULAN_LABELS[targetBulan - 1]} ${targetTahun}. Silakan sesuaikan checklist skill dan mutasi.`,
    employees: updatedEmployees
  };
}

// CSV Export for Database Data (All records + 90+ skill matrix columns)
export function exportDatabaseCsv(employees: Employee[], skillMeta: SkillMeta[] = INITIAL_SKILL_META): void {
  function csvEscape(val: any): string {
    const s = val === null || val === undefined ? '' : String(val);
    if (/[",\n\r]/.test(s)) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  const header = [
    'No', 'Emp ID', 'Emp Name', 'Divisi', 'Department', 'Section', 'Grade', 'Job Grade',
    'Jabatan', 'Gender', 'Tanggal Pensiun', 'PIC', 'Tahun', 'Bulan'
  ].concat(skillMeta.map((s) => s.code)).concat(['Total Score', 'Standard', 'Result', 'GAP']);

  const rows: string[][] = [header];

  employees.forEach((e) => {
    const row = [
      String(e.no),
      e.empId,
      e.empName,
      e.divisi,
      e.department,
      e.section,
      e.grade,
      e.jobGrade,
      e.jabatan,
      e.gender,
      e.tanggalPensiun || '',
      e.pic || '',
      String(e.tahun),
      String(e.bulan)
    ];

    skillMeta.forEach((s) => {
      row.push(e.skills[s.code] ? '1' : '0');
    });

    row.push(String(e.totalScore), String(e.standard ?? ''), e.result || '', String(e.gap ?? ''));
    rows.push(row);
  });

  const csvContent = rows.map((r) => r.map(csvEscape).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Database_MultiSkill_${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

import { generateMultiSkillReportPdf } from './pdfExport';

// PDF Generator matching the elegant Ajinomoto Mojokerto Factory template (GAS format)
export function buildReportPdfDoc(
  filteredEmployees: Employee[],
  filters: AppFiltersState,
  userInfo: { name: string; role: string }
): jsPDF {
  const result = generateMultiSkillReportPdf({
    scope: 'filtered',
    filteredEmployees: filteredEmployees,
    allEmployees: filteredEmployees,
    filters: filters,
    currentUser: {
      username: 'hr_admin',
      name: userInfo.name || 'Mahmud Nurdiansyah',
      role: userInfo.role || 'HR Development Specialist',
      department: 'Human Resources Development'
    },
    reportType: 'comprehensive'
  });

  return result.doc;
}

