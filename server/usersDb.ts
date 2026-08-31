import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { addActivityLog } from './systemDb.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dedicated Directory and File Path for Persistent User Database
const DATA_DIR = path.join(process.cwd(), 'server', 'data');
const USERS_DB_FILE_PATH = path.join(DATA_DIR, 'users_db.json');
const LEGACY_SYSTEM_DB_FILE_PATH = path.join(DATA_DIR, 'system_db.json');

export interface UserAccountRecord {
  username: string;
  password: string;
  name: string;
  role: string;
  department: string;
  divisi?: string;
  scopeType?: 'ALL' | 'DIVISI' | 'DEPARTMENT' | 'PIC';
  scopeValue?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  email?: string;
  phone?: string;
  nik?: string;
  avatarUrl?: string;
  bio?: string;
  signatureImage?: string;
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
  canEditCompetency?: boolean;
  canManageUsers?: boolean;
}

export interface UsersDatabaseSchema {
  version: string;
  databaseName: string;
  description: string;
  lastUpdated: string;
  users: UserAccountRecord[];
}

const DEFAULT_INITIAL_USERS_DB: UsersDatabaseSchema = {
  version: '2.5',
  databaseName: 'PT Ajinomoto Indonesia - User Accounts & Authentication Master Database',
  description: 'Dedicated database storage for system administrators, user profiles, departmental credentials, access scopes, and digital signatures.',
  lastUpdated: new Date().toISOString(),
  users: [
    {
      username: 'hr_admin',
      password: 'password123',
      name: 'Mahmud Nurdiansyah',
      role: 'HR Development Admin',
      department: 'Human Resources Development',
      divisi: 'Human Resources & Corporate Service',
      scopeType: 'ALL',
      status: 'ACTIVE',
      email: 'mahmudnurdiansyah4@gmail.com',
      phone: '0819-1932-7912',
      nik: '122108091',
      avatarUrl: '',
      bio: 'Super Administrator Multi-Skill Monitoring & Pengembangan Kompetensi Karyawan PT Ajinomoto Indonesia Mojokerto Factory.',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: new Date().toISOString(),
      canEditCompetency: true,
      canManageUsers: true
    },
    {
      username: 'fermentasi_pic',
      password: 'fermentasi123',
      name: 'Budi Santoso, S.T.',
      role: 'PIC Departemen Fermentasi',
      department: 'Fermentation Department',
      divisi: 'Production FI (MSG)',
      scopeType: 'DEPARTMENT',
      scopeValue: 'Fermentation Department',
      status: 'ACTIVE',
      email: 'budi.santoso@ajinomoto.co.id',
      phone: '0812-3456-7890',
      nik: '121904102',
      avatarUrl: '',
      bio: 'Person-in-Charge Pemantauan & Evaluasi Matriks Multi-Skill Karyawan Bagian Proses Fermentasi MSG.',
      createdAt: '2026-01-15T00:00:00.000Z',
      updatedAt: new Date().toISOString(),
      canEditCompetency: true,
      canManageUsers: false
    },
    {
      username: 'packaging_pic',
      password: 'packaging123',
      name: 'Siti Rahmawati',
      role: 'PIC Packaging & Filling',
      department: 'Packaging Department',
      divisi: 'Production FP (Food Products)',
      scopeType: 'DEPARTMENT',
      scopeValue: 'Packaging Department',
      status: 'ACTIVE',
      email: 'siti.rahmawati@ajinomoto.co.id',
      phone: '0813-9876-5432',
      nik: '122005214',
      avatarUrl: '',
      bio: 'Supervisor & PIC Multi-Skill Pemantauan Keahlian Packaging & Filling Food Products Mojokerto Factory.',
      createdAt: '2026-01-15T00:00:00.000Z',
      updatedAt: new Date().toISOString(),
      canEditCompetency: true,
      canManageUsers: false
    },
    {
      username: 'qa_pic',
      password: 'qa123456',
      name: 'Agus Setiawan, S.Si.',
      role: 'Quality Assurance PIC',
      department: 'Quality Assurance',
      divisi: 'Technical & QA',
      scopeType: 'DEPARTMENT',
      scopeValue: 'Quality Assurance',
      status: 'ACTIVE',
      email: 'agus.setiawan@ajinomoto.co.id',
      phone: '0815-6789-0123',
      nik: '121803119',
      avatarUrl: '',
      bio: 'Penanggung Jawab Kompetensi Analis & Matriks Laboratorium Quality Assurance & Control.',
      createdAt: '2026-02-01T00:00:00.000Z',
      updatedAt: new Date().toISOString(),
      canEditCompetency: true,
      canManageUsers: false
    },
    {
      username: 'eng_supervisor',
      password: 'eng12345',
      name: 'Hendra Wijaya',
      role: 'Section Supervisor Maintenance',
      department: 'Engineering & Maintenance',
      divisi: 'Engineering & Utility',
      scopeType: 'DEPARTMENT',
      scopeValue: 'Engineering & Maintenance',
      status: 'ACTIVE',
      email: 'hendra.wijaya@ajinomoto.co.id',
      phone: '0821-4567-8901',
      nik: '121702088',
      avatarUrl: '',
      bio: 'Supervisor Divisi Pemeliharaan Mesin & Utilitas Pabrik Ajinomoto Mojokerto.',
      createdAt: '2026-02-10T00:00:00.000Z',
      updatedAt: new Date().toISOString(),
      canEditCompetency: true,
      canManageUsers: false
    },
    {
      username: 'mgmt_viewer',
      password: 'viewer123',
      name: 'Ir. Haryono',
      role: 'Executive Management Auditor',
      department: 'Factory Executive Office',
      divisi: 'Factory Management',
      scopeType: 'ALL',
      status: 'ACTIVE',
      email: 'haryono.exec@ajinomoto.co.id',
      phone: '0811-2233-4455',
      nik: '119801001',
      avatarUrl: '',
      bio: 'Pemantau Eksekutif KPI Matriks Multi-Skill dan Kesiapan Kompetensi Tenaga Kerja Pabrik.',
      createdAt: '2026-02-15T00:00:00.000Z',
      updatedAt: new Date().toISOString(),
      canEditCompetency: false,
      canManageUsers: false
    }
  ]
};

// In-Memory Database Cache
let inMemoryUsersDb: UsersDatabaseSchema | null = null;

/**
 * Initialize and ensure dedicated users database exists on disk.
 * Migrates and enriches user records with master account database templates.
 */
export function initUsersDatabase(): UsersDatabaseSchema {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(USERS_DB_FILE_PATH)) {
      fs.writeFileSync(USERS_DB_FILE_PATH, JSON.stringify(DEFAULT_INITIAL_USERS_DB, null, 2), 'utf-8');
      inMemoryUsersDb = JSON.parse(JSON.stringify(DEFAULT_INITIAL_USERS_DB));
      console.log(`[UserDB] Initialized dedicated users database: ${USERS_DB_FILE_PATH}`);
      return inMemoryUsersDb!;
    }

    const raw = fs.readFileSync(USERS_DB_FILE_PATH, 'utf-8');
    const parsed: UsersDatabaseSchema = JSON.parse(raw);

    if (!parsed.users || !Array.isArray(parsed.users) || parsed.users.length === 0) {
      parsed.users = DEFAULT_INITIAL_USERS_DB.users;
      persistUsersDatabase(parsed);
    } else {
      // Ensure super administrator hr_admin is always present
      const hrAdminExists = parsed.users.some(
        (u) => u.username.toLowerCase() === 'hr_admin'
      );
      if (!hrAdminExists) {
        parsed.users.unshift(DEFAULT_INITIAL_USERS_DB.users[0]);
        persistUsersDatabase(parsed);
      }
    }

    inMemoryUsersDb = parsed;
    return inMemoryUsersDb;
  } catch (err) {
    console.error('[UserDB] Error initializing users database file, falling back to default:', err);
    inMemoryUsersDb = JSON.parse(JSON.stringify(DEFAULT_INITIAL_USERS_DB));
    return inMemoryUsersDb!;
  }
}

/**
 * Persist Users Database atomically to disk
 */
export function persistUsersDatabase(db: UsersDatabaseSchema): boolean {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    db.lastUpdated = new Date().toISOString();
    inMemoryUsersDb = db;

    const tempFilePath = `${USERS_DB_FILE_PATH}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFilePath, JSON.stringify(db, null, 2), 'utf-8');
    fs.renameSync(tempFilePath, USERS_DB_FILE_PATH);
    return true;
  } catch (err) {
    console.error('[UserDB] Error persisting users database to disk:', err);
    return false;
  }
}

/**
 * Get current Users Database schema
 */
export function getUsersDatabase(): UsersDatabaseSchema {
  if (!inMemoryUsersDb) {
    return initUsersDatabase();
  }
  try {
    if (fs.existsSync(USERS_DB_FILE_PATH)) {
      const raw = fs.readFileSync(USERS_DB_FILE_PATH, 'utf-8');
      const parsed: UsersDatabaseSchema = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.users) && parsed.users.length > 0) {
        inMemoryUsersDb = parsed;
      }
    }
  } catch (_) {}
  return inMemoryUsersDb;
}

/**
 * Get all active users
 */
export function getAllUsers(): UserAccountRecord[] {
  const db = getUsersDatabase();
  return db.users;
}

/**
 * Get user by exact username
 */
export function getUserByUsername(username: string): UserAccountRecord | null {
  const db = getUsersDatabase();
  const found = db.users.find(
    (u) => u.username.trim().toLowerCase() === (username || '').trim().toLowerCase()
  );
  return found || null;
}

/**
 * Get user by identifier (username, email, NIK, or name)
 */
export function getUserByIdentifier(identifier: string): UserAccountRecord | null {
  const db = getUsersDatabase();
  const clean = (identifier || '').trim().toLowerCase();
  if (!clean) return null;

  const found = db.users.find(
    (u) =>
      u.username.trim().toLowerCase() === clean ||
      u.email?.trim().toLowerCase() === clean ||
      u.nik?.trim().toLowerCase() === clean ||
      u.name?.trim().toLowerCase() === clean
  );
  return found || null;
}

/**
 * Authenticate login credentials
 */
export function authenticateUser(
  username: string,
  password: string,
  ip?: string
): { success: boolean; message?: string; user?: UserAccountRecord } {
  const db = getUsersDatabase();
  const cleanUsername = (username || '').trim().toLowerCase();

  const user = db.users.find(
    (u) =>
      (u.username.trim().toLowerCase() === cleanUsername ||
        u.email?.trim().toLowerCase() === cleanUsername ||
        u.nik?.trim().toLowerCase() === cleanUsername) &&
      u.password === password
  );

  if (!user) {
    return { success: false, message: 'Username atau kata sandi salah. Silakan periksa kembali.' };
  }

  if (user.status === 'INACTIVE') {
    return {
      success: false,
      message: 'Akun ini berstatus non-aktif. Silakan hubungi Super Administrator HRD untuk aktivasi kembali.'
    };
  }

  user.lastLogin = new Date().toISOString();
  addActivityLog(user.username, 'LOGIN_SUCCESS', `Login berhasil ke sistem dari ${user.role} (${user.department}) - Scope: ${user.scopeType || 'ALL'}`, ip);
  persistUsersDatabase(db);

  return { success: true, user };
}

/**
 * Admin: Full Update of any user account
 */
export function adminUpdateUser(
  targetUsername: string,
  updates: Partial<UserAccountRecord> & { newPassword?: string },
  operatorUsername: string = 'hr_admin',
  ip?: string
): { success: boolean; message: string; user?: UserAccountRecord } {
  const db = getUsersDatabase();
  const cleanTarget = (targetUsername || '').trim().toLowerCase();

  const index = db.users.findIndex(
    (u) => u.username.trim().toLowerCase() === cleanTarget
  );

  if (index === -1) {
    return { success: false, message: `Akun "${targetUsername}" tidak ditemukan di database.` };
  }

  const current = db.users[index];

  // If changing username, check uniqueness
  if (updates.username && updates.username.trim().toLowerCase() !== current.username.trim().toLowerCase()) {
    const isTaken = db.users.some(
      (u, idx) => idx !== index && u.username.trim().toLowerCase() === updates.username!.trim().toLowerCase()
    );
    if (isTaken) {
      return { success: false, message: `Username "${updates.username}" sudah digunakan oleh akun lain.` };
    }
  }

  const updatedUser: UserAccountRecord = {
    ...current,
    ...updates,
    username: updates.username?.trim() || current.username,
    name: updates.name?.trim() || current.name,
    role: updates.role?.trim() || current.role,
    department: updates.department?.trim() || current.department,
    divisi: updates.divisi !== undefined ? updates.divisi : current.divisi,
    scopeType: updates.scopeType || current.scopeType || 'ALL',
    scopeValue: updates.scopeValue !== undefined ? updates.scopeValue : current.scopeValue,
    status: updates.status || current.status || 'ACTIVE',
    email: updates.email !== undefined ? updates.email : current.email,
    phone: updates.phone !== undefined ? updates.phone : current.phone,
    nik: updates.nik !== undefined ? updates.nik : current.nik,
    bio: updates.bio !== undefined ? updates.bio : current.bio,
    avatarUrl: updates.avatarUrl !== undefined ? updates.avatarUrl : current.avatarUrl,
    canEditCompetency: updates.canEditCompetency !== undefined ? updates.canEditCompetency : current.canEditCompetency,
    canManageUsers: updates.canManageUsers !== undefined ? updates.canManageUsers : current.canManageUsers,
    password: updates.newPassword && updates.newPassword.trim().length >= 6 ? updates.newPassword.trim() : (updates.password || current.password),
    updatedAt: new Date().toISOString()
  };

  db.users[index] = updatedUser;
  addActivityLog(
    operatorUsername,
    'PROFILE_UPDATED',
    `Administrator ${operatorUsername} memperbarui akun: ${updatedUser.username} (${updatedUser.name} - ${updatedUser.role})`,
    ip
  );
  persistUsersDatabase(db);

  return {
    success: true,
    message: `Data akun ${updatedUser.name} (@${updatedUser.username}) berhasil diperbarui di database master.`,
    user: updatedUser
  };
}

/**
 * Admin: Reset user password directly
 */
export function adminResetUserPassword(
  targetUsername: string,
  newPw: string,
  operatorUsername: string = 'hr_admin',
  ip?: string
): { success: boolean; message: string } {
  const db = getUsersDatabase();
  const cleanTarget = (targetUsername || '').trim().toLowerCase();

  const index = db.users.findIndex(
    (u) => u.username.trim().toLowerCase() === cleanTarget
  );

  if (index === -1) {
    return { success: false, message: `Akun "${targetUsername}" tidak ditemukan di database.` };
  }

  if (!newPw || newPw.length < 6) {
    return { success: false, message: 'Kata sandi baru minimal 6 karakter.' };
  }

  db.users[index].password = newPw;
  db.users[index].updatedAt = new Date().toISOString();

  addActivityLog(
    operatorUsername,
    'PASSWORD_CHANGED',
    `Administrator ${operatorUsername} mereset kata sandi akun @${targetUsername}`,
    ip
  );
  persistUsersDatabase(db);

  return { success: true, message: `Kata sandi akun @${targetUsername} berhasil direset.` };
}

/**
 * Update user profile details and/or HD avatar photo
 */
export function updateUserProfile(
  targetUsername: string,
  updates: Partial<UserAccountRecord>,
  ip?: string
): { success: boolean; message: string; user?: UserAccountRecord } {
  const db = getUsersDatabase();
  const cleanTarget = (targetUsername || '').trim().toLowerCase();

  let index = db.users.findIndex(
    (u) => u.username.trim().toLowerCase() === cleanTarget
  );

  // Fallback identifier search
  if (index === -1) {
    if (updates.email) {
      index = db.users.findIndex((u) => u.email?.trim().toLowerCase() === updates.email?.trim().toLowerCase());
    }
    if (index === -1 && updates.nik) {
      index = db.users.findIndex((u) => u.nik?.trim().toLowerCase() === updates.nik?.trim().toLowerCase());
    }
    if (index === -1 && cleanTarget) {
      index = db.users.findIndex((u) => u.name?.trim().toLowerCase() === cleanTarget);
    }
    if (index === -1 && db.users.length > 0) {
      const hrAdminIdx = db.users.findIndex((u) => u.username.toLowerCase() === 'hr_admin');
      index = hrAdminIdx !== -1 ? hrAdminIdx : 0;
    }
  }

  // If no user exists, bootstrap the record
  if (index === -1) {
    const newUser: UserAccountRecord = {
      username: updates.username?.trim() || 'hr_admin',
      password: 'password123',
      name: updates.name?.trim() || 'Mahmud Nurdiansyah',
      role: updates.role?.trim() || 'HR Development Admin',
      department: updates.department?.trim() || 'Human Resources Development',
      email: updates.email?.trim() || 'mahmudnurdiansyah4@gmail.com',
      phone: updates.phone?.trim() || '0819-1932-7912',
      nik: updates.nik?.trim() || '122108091',
      avatarUrl: updates.avatarUrl || '',
      bio: updates.bio || 'Administrator Multi-Skill Monitoring & Pengembangan Kompetensi Karyawan PT Ajinomoto Indonesia Mojokerto Factory.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.users.push(newUser);
    addActivityLog(
      newUser.username,
      'PROFILE_UPDATED',
      `Inisialisasi & pembaruan profil pengguna ${newUser.name} di database user mandiri`,
      ip
    );
    persistUsersDatabase(db);
    return { success: true, message: 'Profil dan foto pengguna berhasil diperbarui di database user.', user: newUser };
  }

  const current = db.users[index];

  // Ensure username uniqueness if changing
  if (updates.username && updates.username.trim().toLowerCase() !== current.username.trim().toLowerCase()) {
    const isTaken = db.users.some(
      (u, idx) => idx !== index && u.username.trim().toLowerCase() === updates.username!.trim().toLowerCase()
    );
    if (isTaken) {
      return { success: false, message: `Username "${updates.username}" telah digunakan oleh akun lain.` };
    }
  }

  const updatedUser: UserAccountRecord = {
    ...current,
    ...updates,
    username: updates.username?.trim() || current.username,
    name: updates.name?.trim() || current.name,
    role: updates.role?.trim() || current.role,
    department: updates.department?.trim() || current.department,
    email: updates.email?.trim() || current.email,
    phone: updates.phone?.trim() || current.phone,
    nik: updates.nik?.trim() || current.nik,
    bio: updates.bio !== undefined ? updates.bio : current.bio,
    avatarUrl: updates.avatarUrl !== undefined ? updates.avatarUrl : current.avatarUrl,
    signatureImage: updates.signatureImage !== undefined ? updates.signatureImage : current.signatureImage,
    updatedAt: new Date().toISOString()
  };

  db.users[index] = updatedUser;

  const hasAvatarChange = updates.avatarUrl !== undefined && updates.avatarUrl !== current.avatarUrl;
  addActivityLog(
    updatedUser.username,
    hasAvatarChange ? 'PHOTO_UPDATED' : 'PROFILE_UPDATED',
    `Memperbarui data profil: ${updatedUser.name} (${updatedUser.role} - ${updatedUser.department})${hasAvatarChange ? ' beserta foto profil HD' : ''}`,
    ip
  );

  persistUsersDatabase(db);
  return { success: true, message: 'Profil dan foto pengguna berhasil disimpan secara permanen di database user server.', user: updatedUser };
}

/**
 * Update user avatar photo
 */
export function updateUserPhoto(
  username: string,
  avatarUrl: string,
  ip?: string
): { success: boolean; message: string; user?: UserAccountRecord } {
  return updateUserProfile(username, { avatarUrl }, ip);
}

/**
 * Remove user avatar photo
 */
export function removeUserPhoto(
  username: string,
  ip?: string
): { success: boolean; message: string; user?: UserAccountRecord } {
  return updateUserProfile(username, { avatarUrl: '' }, ip);
}

/**
 * Change user password
 */
export function changeUserPassword(
  username: string,
  oldPw: string,
  newPw: string,
  ip?: string
): { success: boolean; message: string } {
  const db = getUsersDatabase();
  const index = db.users.findIndex(
    (u) => u.username.trim().toLowerCase() === (username || '').trim().toLowerCase()
  );

  if (index === -1) {
    return { success: false, message: 'Akun pengguna tidak ditemukan di database server.' };
  }

  if (db.users[index].password !== oldPw) {
    return { success: false, message: 'Kata sandi lama tidak sesuai.' };
  }

  if (!newPw || newPw.length < 6) {
    return { success: false, message: 'Kata sandi baru minimal 6 karakter.' };
  }

  db.users[index].password = newPw;
  db.users[index].updatedAt = new Date().toISOString();

  addActivityLog(username, 'PASSWORD_CHANGED', `Mengganti kata sandi akun ${username}`, ip);
  persistUsersDatabase(db);

  return { success: true, message: 'Kata sandi akun berhasil diperbarui di database user server.' };
}

/**
 * Create a new user account
 */
export function createNewUser(
  newUser: Omit<UserAccountRecord, 'createdAt' | 'updatedAt'>,
  creatorUsername: string = 'system',
  ip?: string
): { success: boolean; message: string; user?: UserAccountRecord } {
  const db = getUsersDatabase();
  const exists = db.users.some(
    (u) => u.username.trim().toLowerCase() === newUser.username.trim().toLowerCase()
  );

  if (exists) {
    return { success: false, message: `Username "${newUser.username}" sudah terdaftar.` };
  }

  const record: UserAccountRecord = {
    ...newUser,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.users.push(record);
  addActivityLog(creatorUsername, 'USER_CREATED', `Membuat akun pengguna baru: ${record.username} (${record.name})`, ip);
  persistUsersDatabase(db);

  return { success: true, message: `Akun ${record.name} berhasil ditambahkan ke database user server.`, user: record };
}

/**
 * Delete a user account (protecting main hr_admin)
 */
export function deleteUser(
  targetUsername: string,
  removerUsername: string = 'system',
  ip?: string
): { success: boolean; message: string } {
  const db = getUsersDatabase();
  if ((targetUsername || '').trim().toLowerCase() === 'hr_admin') {
    return { success: false, message: 'Akun Super Administrator utama (hr_admin) tidak dapat dihapus.' };
  }

  const index = db.users.findIndex(
    (u) => u.username.trim().toLowerCase() === (targetUsername || '').trim().toLowerCase()
  );

  if (index === -1) {
    return { success: false, message: 'Pengguna tidak ditemukan di database user.' };
  }

  const deleted = db.users.splice(index, 1)[0];
  addActivityLog(removerUsername, 'USER_DELETED', `Menghapus akun pengguna: ${deleted.username} (${deleted.name})`, ip);
  persistUsersDatabase(db);

  return { success: true, message: `Akun ${deleted.name} berhasil dihapus dari database user server.` };
}

/**
 * Export Users Database to JSON format
 */
export function exportUsersDatabaseJson(): string {
  const db = getUsersDatabase();
  return JSON.stringify(db, null, 2);
}

/**
 * Import and restore Users Database from JSON
 */
export function importUsersDatabaseJson(
  jsonContent: string,
  operatorUsername: string = 'system',
  ip?: string
): { success: boolean; message: string; count?: number } {
  try {
    const parsed = JSON.parse(jsonContent);
    let usersList: UserAccountRecord[] = [];

    if (Array.isArray(parsed)) {
      usersList = parsed;
    } else if (parsed && Array.isArray(parsed.users)) {
      usersList = parsed.users;
    } else {
      return { success: false, message: 'Format data JSON pengguna tidak valid.' };
    }

    if (usersList.length === 0) {
      return { success: false, message: 'File JSON tidak memuat akun pengguna yang valid.' };
    }

    // Ensure super admin hr_admin exists
    const hasHrAdmin = usersList.some((u) => u.username.toLowerCase() === 'hr_admin');
    if (!hasHrAdmin) {
      usersList.unshift(DEFAULT_INITIAL_USERS_DB.users[0]);
    }

    const updatedDb: UsersDatabaseSchema = {
      version: '2.0',
      databaseName: 'PT Ajinomoto Indonesia - User Accounts & Authentication Database',
      description: 'Dedicated database storage for system administrators, user profiles, credentials, and digital signatures.',
      lastUpdated: new Date().toISOString(),
      users: usersList
    };

    persistUsersDatabase(updatedDb);
    addActivityLog(operatorUsername, 'DATABASE_EXPORTED', `Memulihkan/import database user (${usersList.length} akun)`, ip);

    return {
      success: true,
      message: `Database pengguna berhasil dipulihkan dengan ${usersList.length} akun.`,
      count: usersList.length
    };
  } catch (err: any) {
    return { success: false, message: `Gagal membaca file JSON: ${err?.message || 'Error tidak diketahui'}` };
  }
}

/**
 * Reset Users Database to factory default
 */
export function resetUsersDatabaseToDefault(
  operatorUsername: string = 'system',
  ip?: string
): { success: boolean; message: string } {
  const defaultCopy: UsersDatabaseSchema = JSON.parse(JSON.stringify(DEFAULT_INITIAL_USERS_DB));
  defaultCopy.lastUpdated = new Date().toISOString();
  persistUsersDatabase(defaultCopy);

  addActivityLog(operatorUsername, 'DATABASE_EXPORTED', 'Mereset database pengguna ke setelan default pabrik', ip);
  return { success: true, message: 'Database pengguna berhasil direset ke pengaturan awal default.' };
}
