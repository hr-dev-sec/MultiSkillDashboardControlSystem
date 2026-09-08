import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

import { createServer as createViteServer } from 'vite';
import {
  initSystemDatabase,
  getSystemDatabase,
  getAllUsers,
  getUserByUsername,
  authenticateUser,
  updateUserProfile,
  updateUserPhoto,
  removeUserPhoto,
  changeUserPassword,
  createNewUser,
  deleteUser,
  adminUpdateUser,
  adminResetUserPassword,
  getSystemConfig,
  updateSystemConfig,
  getActivityLogs,
  addActivityLog,
  getEmailLogs,
  addEmailLog,
  exportUsersDatabaseJson,
  importUsersDatabaseJson,
  resetUsersDatabaseToDefault
} from './server/systemDb.js';
import { initUsersDatabase, getUsersDatabase } from './server/usersDb.js';
import {
  initEmployeesDatabase,
  getEmployeesDatabase,
  persistEmployeesDatabase,
  getAllEmployees
} from './server/employeeDb.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Dedicated Users Database, Employee Database & System Database on startup
initUsersDatabase();
initEmployeesDatabase();
initSystemDatabase();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for parsing JSON with generous payload limits for base64 PDF attachments and custom avatar photos (up to 50MB)
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // =========================================================================
  // API ROUTE: HEALTH CHECK
  // =========================================================================
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'Multi-Skill Monitoring System API',
      timestamp: new Date().toISOString(),
      emailService: 'ready',
      database: 'connected'
    });
  });

  // =========================================================================
  // API ROUTE: SYSTEM DATABASE INITIALIZATION & SYNC
  // =========================================================================
  app.get('/api/system/init', (req, res) => {
    try {
      const db = getSystemDatabase();
      const freshUsers = getAllUsers();
      // Remove passwords from public user lists
      const sanitizedUsers = freshUsers.map(({ password, ...rest }) => rest);
      res.json({
        success: true,
        users: sanitizedUsers,
        config: db.config,
        recentLogs: db.activityLogs.slice(0, 20),
        emailLogs: db.emailLogs.slice(0, 20)
      });
    } catch (err: any) {
      console.error('Error fetching system init data:', err);
      res.status(500).json({ success: false, message: 'Gagal memuat data database sistem.' });
    }
  });

  // =========================================================================
  // API ROUTE: AUTHENTICATION & LOGIN
  // =========================================================================
  app.post('/api/auth/login', (req, res) => {
    try {
      const { username, password } = req.body || {};
      if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username dan kata sandi wajib diisi.' });
      }

      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const result = authenticateUser(username, password, clientIp);
      if (!result.success || !result.user) {
        return res.status(401).json({ success: false, message: result.message || 'Kredensial tidak valid.' });
      }

      const { password: _, ...safeUser } = result.user;
      const session = {
        username: safeUser.username,
        name: safeUser.name,
        role: safeUser.role,
        department: safeUser.department,
        divisi: safeUser.divisi || '',
        scopeType: safeUser.scopeType || 'ALL',
        scopeValue: safeUser.scopeValue || '',
        status: safeUser.status || 'ACTIVE',
        email: safeUser.email || '',
        phone: safeUser.phone || '',
        nik: safeUser.nik || '',
        avatarUrl: safeUser.avatarUrl || '',
        bio: safeUser.bio || '',
        canEditCompetency: safeUser.canEditCompetency !== undefined ? safeUser.canEditCompetency : true,
        canManageUsers: safeUser.canManageUsers !== undefined ? safeUser.canManageUsers : (safeUser.username === 'hr_admin'),
        token: 'tok_' + Math.random().toString(36).substring(2) + Date.now().toString(36)
      };

      return res.json({ success: true, session, user: safeUser });
    } catch (err: any) {
      console.error('Login error:', err);
      return res.status(500).json({ success: false, message: 'Terjadi kesalahan sistem saat login.' });
    }
  });

  // =========================================================================
  // API ROUTE: CHANGE PASSWORD
  // =========================================================================
  app.post('/api/auth/change-password', (req, res) => {
    try {
      const { username, oldPassword, newPassword } = req.body || {};
      if (!username || !oldPassword || !newPassword) {
        return res.status(400).json({ success: false, message: 'Data penggantian kata sandi tidak lengkap.' });
      }

      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const result = changeUserPassword(username, oldPassword, newPassword, clientIp);
      if (!result.success) {
        return res.status(400).json(result);
      }
      return res.json(result);
    } catch (err: any) {
      console.error('Password change error:', err);
      return res.status(500).json({ success: false, message: 'Gagal memperbarui kata sandi di server.' });
    }
  });

  // =========================================================================
  // API ROUTE: DEDICATED USER DATABASE TOOLS (EXPORT / IMPORT / INFO / RESET)
  // MUST BE PLACED BEFORE /api/users/:username to avoid routing conflicts
  // =========================================================================
  app.get('/api/users/database/info', (req, res) => {
    try {
      const userDb = getUsersDatabase();
      res.json({
        success: true,
        databaseName: userDb.databaseName,
        fileName: 'users_db.json',
        storageType: 'Dedicated Isolated JSON Database',
        version: userDb.version,
        totalUsers: userDb.users.length,
        lastUpdated: userDb.lastUpdated,
        usersSummary: userDb.users.map((u) => ({
          username: u.username,
          name: u.name,
          role: u.role,
          department: u.department,
          hasAvatar: Boolean(u.avatarUrl),
          lastLogin: u.lastLogin || null
        }))
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: 'Gagal membaca metadata database pengguna.' });
    }
  });

  app.get('/api/users/database/export', (req, res) => {
    try {
      const jsonStr = exportUsersDatabaseJson();
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="ajinomoto_users_database_${Date.now()}.json"`);
      res.send(jsonStr);
    } catch (err: any) {
      res.status(500).json({ success: false, message: 'Gagal mengekspor database pengguna.' });
    }
  });

  // =========================================================================
  // API ROUTE: COMPLETE MULTI-SKILL SYSTEM BACKUP & EXPORT
  // =========================================================================
  app.get('/api/system/database/export', (req, res) => {
    try {
      const usersDb = getUsersDatabase();
      const sysDb = getSystemDatabase();
      const empDb = getEmployeesDatabase();

      const fullBackupPayload = {
        system: 'PT Ajinomoto Indonesia - Multi-Skill Monitoring System (Complete Persistent Backup)',
        version: '2.5',
        exportDate: new Date().toISOString(),
        factory: 'Mojokerto Plant',
        stats: {
          totalEmployees: empDb.employees.length,
          totalUsers: usersDb.users.length,
          activeSuperAdmin: usersDb.users[0]?.username || 'hr_admin'
        },
        usersDatabase: usersDb,
        employees: empDb.employees,
        config: sysDb.config,
        activityLogs: sysDb.activityLogs.slice(0, 100),
        emailLogs: sysDb.emailLogs.slice(0, 100)
      };

      const jsonStr = JSON.stringify(fullBackupPayload, null, 2);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="ajinomoto_full_system_database_${Date.now()}.json"`);
      res.send(jsonStr);
    } catch (err: any) {
      console.error('System export error:', err);
      res.status(500).json({ success: false, message: 'Gagal mengekspor cadangan database sistem lengkap.' });
    }
  });

  app.post('/api/system/database/export-full', (req, res) => {
    try {
      const { clientEmployees = [], clientUsers = [], clientConfig = {} } = req.body || {};
      const usersDb = getUsersDatabase();
      const sysDb = getSystemDatabase();
      const serverEmployees = getAllEmployees();

      const mergedEmployees = clientEmployees.length > 0 ? clientEmployees : serverEmployees;
      const mergedUsers = usersDb.users.length > 0 ? usersDb.users : clientUsers;

      const fullBackupPayload = {
        system: 'PT Ajinomoto Indonesia - Multi-Skill Monitoring System (Comprehensive Backup)',
        version: '2.5',
        exportDate: new Date().toISOString(),
        factory: 'Mojokerto Plant',
        stats: {
          totalEmployees: mergedEmployees.length,
          totalUsers: mergedUsers.length,
          activeSuperAdmin: mergedUsers[0]?.username || 'hr_admin'
        },
        usersDatabase: usersDb,
        users: mergedUsers,
        employees: mergedEmployees,
        config: { ...sysDb.config, ...clientConfig }
      };

      const jsonStr = JSON.stringify(fullBackupPayload, null, 2);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="ajinomoto_full_system_backup_${Date.now()}.json"`);
      res.send(jsonStr);
    } catch (err: any) {
      res.status(500).json({ success: false, message: 'Gagal memproses cadangan sistem lengkap.' });
    }
  });

  // =========================================================================
  // API ROUTE: EMPLOYEE DATA PERSISTENCE ON SERVER
  // =========================================================================
  app.get('/api/employees', (req, res) => {
    try {
      const employees = getAllEmployees();
      res.json({
        success: true,
        count: employees.length,
        employees
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: 'Gagal memuat data karyawan dari server.' });
    }
  });

  app.put('/api/employees', (req, res) => {
    try {
      const { employees = [] } = req.body || {};
      if (!Array.isArray(employees)) {
        return res.status(400).json({ success: false, message: 'Data karyawan harus berupa array.' });
      }

      const success = persistEmployeesDatabase(employees);
      if (success) {
        return res.json({
          success: true,
          message: `Berhasil menyimpan ${employees.length} data karyawan di database server.`,
          count: employees.length
        });
      } else {
        return res.status(500).json({ success: false, message: 'Gagal menyimpan data karyawan ke disk server.' });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, message: 'Gagal memproses penyimpanan data karyawan.' });
    }
  });

  app.post('/api/users/database/import', (req, res) => {
    try {
      const { jsonContent, operatorUsername } = req.body || {};
      if (!jsonContent) {
        return res.status(400).json({ success: false, message: 'Konten JSON database pengguna wajib disertakan.' });
      }

      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const result = importUsersDatabaseJson(jsonContent, operatorUsername || 'admin', clientIp);
      if (!result.success) {
        return res.status(400).json(result);
      }
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, message: 'Gagal mengimpor database pengguna.' });
    }
  });

  app.post('/api/users/database/reset', (req, res) => {
    try {
      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const result = resetUsersDatabaseToDefault(req.body.operatorUsername || 'admin', clientIp);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, message: 'Gagal mereset database pengguna.' });
    }
  });

  // =========================================================================
  // API ROUTE: USERS & PROFILES MANAGEMENT
  // =========================================================================
  app.get('/api/users', (req, res) => {
    try {
      const users = getAllUsers().map(({ password, ...rest }) => rest);
      res.json({ success: true, users });
    } catch (err: any) {
      res.status(500).json({ success: false, message: 'Gagal memuat daftar pengguna.' });
    }
  });

  app.get('/api/users/:username', (req, res) => {
    try {
      const user = getUserByUsername(req.params.username);
      if (!user) {
        return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
      }
      const { password, ...safeUser } = user;
      res.json({ success: true, user: safeUser });
    } catch (err: any) {
      res.status(500).json({ success: false, message: 'Gagal memuat profil pengguna.' });
    }
  });

  // Update Profile & Photo
  app.put('/api/users/:username/profile', (req, res) => {
    try {
      const targetUsername = req.params.username;
      const updates = req.body || {};
      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;

      const result = updateUserProfile(targetUsername, updates, clientIp);
      if (!result.success || !result.user) {
        return res.status(400).json(result);
      }

      const { password, ...safeUser } = result.user;
      const updatedSession = {
        username: safeUser.username,
        name: safeUser.name,
        role: safeUser.role,
        department: safeUser.department,
        email: safeUser.email,
        phone: safeUser.phone,
        nik: safeUser.nik,
        avatarUrl: safeUser.avatarUrl,
        bio: safeUser.bio,
        token: 'tok_' + Math.random().toString(36).substring(2) + Date.now().toString(36)
      };

      res.json({
        success: true,
        message: result.message,
        user: safeUser,
        session: updatedSession
      });
    } catch (err: any) {
      console.error('Update profile error:', err);
      res.status(500).json({ success: false, message: 'Gagal memperbarui profil pengguna di server.' });
    }
  });

  // Update Avatar / Photo directly
  app.post('/api/users/:username/avatar', (req, res) => {
    try {
      const targetUsername = req.params.username;
      const { avatarUrl } = req.body || {};
      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;

      if (!avatarUrl) {
        return res.status(400).json({ success: false, message: 'Data foto profil wajib disertakan.' });
      }

      const result = updateUserPhoto(targetUsername, avatarUrl, clientIp);
      if (!result.success || !result.user) {
        return res.status(400).json(result);
      }

      const { password, ...safeUser } = result.user;
      res.json({ success: true, message: 'Foto profil berhasil disimpan di database server.', user: safeUser });
    } catch (err: any) {
      console.error('Update avatar error:', err);
      res.status(500).json({ success: false, message: 'Gagal memperbarui foto profil di server.' });
    }
  });

  // Remove Avatar / Photo
  app.delete('/api/users/:username/avatar', (req, res) => {
    try {
      const targetUsername = req.params.username;
      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;

      const result = removeUserPhoto(targetUsername, clientIp);
      if (!result.success || !result.user) {
        return res.status(400).json(result);
      }

      const { password, ...safeUser } = result.user;
      res.json({ success: true, message: 'Foto profil berhasil dihapus dari database server.', user: safeUser });
    } catch (err: any) {
      res.status(500).json({ success: false, message: 'Gagal menghapus foto profil di server.' });
    }
  });

  // Create User Account
  app.post('/api/users', (req, res) => {
    try {
      const userData = req.body || {};
      if (!userData.username || !userData.password || !userData.name) {
        return res.status(400).json({ success: false, message: 'Username, password, dan nama lengkap wajib diisi.' });
      }

      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const result = createNewUser(userData, req.body.creatorUsername || 'admin', clientIp);
      if (!result.success || !result.user) {
        return res.status(400).json(result);
      }

      const { password, ...safeUser } = result.user;
      res.json({ success: true, message: result.message, user: safeUser });
    } catch (err: any) {
      res.status(500).json({ success: false, message: 'Gagal membuat akun baru.' });
    }
  });

  // Delete User Account
  app.delete('/api/users/:username', (req, res) => {
    try {
      const targetUsername = req.params.username;
      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const result = deleteUser(targetUsername, req.body.operatorUsername || 'hr_admin', clientIp);
      if (!result.success) {
        return res.status(400).json(result);
      }
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, message: 'Gagal menghapus akun pengguna.' });
    }
  });

  // Admin Update User Account (all fields + optional password)
  app.put('/api/users/:username/admin-update', (req, res) => {
    try {
      const targetUsername = req.params.username;
      const updates = req.body || {};
      const operator = req.body.operatorUsername || 'hr_admin';
      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;

      const result = adminUpdateUser(targetUsername, updates, operator, clientIp);
      if (!result.success || !result.user) {
        return res.status(400).json(result);
      }

      const { password, ...safeUser } = result.user;
      res.json({ success: true, message: result.message, user: safeUser });
    } catch (err: any) {
      console.error('Admin update user error:', err);
      res.status(500).json({ success: false, message: 'Gagal memperbarui data akun pengguna.' });
    }
  });

  // Admin Reset User Password
  app.post('/api/users/:username/reset-password', (req, res) => {
    try {
      const targetUsername = req.params.username;
      const { newPassword, operatorUsername } = req.body || {};
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ success: false, message: 'Kata sandi baru minimal 6 karakter.' });
      }

      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const result = adminResetUserPassword(targetUsername, newPassword, operatorUsername || 'hr_admin', clientIp);
      if (!result.success) {
        return res.status(400).json(result);
      }
      res.json(result);
    } catch (err: any) {
      console.error('Admin reset password error:', err);
      res.status(500).json({ success: false, message: 'Gagal mereset kata sandi pengguna.' });
    }
  });

  // =========================================================================
  // API ROUTE: SYSTEM CONFIGURATION (SMTP / SYNC / E-SIGN)
  // =========================================================================
  app.get('/api/system/config', (req, res) => {
    try {
      const config = getSystemConfig();
      res.json({ success: true, config });
    } catch (err: any) {
      res.status(500).json({ success: false, message: 'Gagal memuat konfigurasi sistem.' });
    }
  });

  app.put('/api/system/config', (req, res) => {
    try {
      const updates = req.body || {};
      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const result = updateSystemConfig(updates, updates.username || 'admin', clientIp);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, message: 'Gagal menyimpan konfigurasi sistem.' });
    }
  });

  // =========================================================================
  // API ROUTE: SUPABASE CLOUD DATABASE CONFIGURATION
  // =========================================================================
  app.get('/api/system/supabase-config', (req, res) => {
    try {
      const config = getSystemConfig();
      res.json({
        success: true,
        supabaseConfig: config.supabaseConfig || {
          url: '',
          anonKey: '',
          tableName: 'employees_multi_skill'
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: 'Gagal membaca konfigurasi Supabase.' });
    }
  });

  app.put('/api/system/supabase-config', (req, res) => {
    try {
      const { url, anonKey, tableName } = req.body || {};
      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const currentConfig = getSystemConfig();
      const updatedSupabaseConfig = {
        url: (url !== undefined ? url : currentConfig.supabaseConfig?.url || '').trim(),
        anonKey: (anonKey !== undefined ? anonKey : currentConfig.supabaseConfig?.anonKey || '').trim(),
        tableName: (tableName !== undefined ? tableName : currentConfig.supabaseConfig?.tableName || 'employees_multi_skill').trim(),
        usersTableName: (req.body.usersTableName !== undefined ? req.body.usersTableName : (currentConfig.supabaseConfig as any)?.usersTableName || 'system_users').trim()
      };
      const result = updateSystemConfig(
        { supabaseConfig: updatedSupabaseConfig },
        req.body.username || 'admin',
        clientIp
      );
      res.json({
        success: true,
        message: 'Konfigurasi Supabase berhasil disimpan di database server terpusat.',
        supabaseConfig: updatedSupabaseConfig
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: 'Gagal menyimpan konfigurasi Supabase ke database server.' });
    }
  });

  // Helper function to prune unrecognized columns from records if Supabase table schema differs
  const pruneMissingColumnFromRecords = (records: any[], errorText: string): { records: any[]; prunedColumn: string | null } => {
    let match = errorText.match(/Could not find the ['"]([^'"]+)['"] column/i);
    if (!match) {
      match = errorText.match(/column ['"]([^'"]+)['"] of relation/i);
    }
    if (!match) {
      match = errorText.match(/column ['"]([^'"]+)['"] does not exist/i);
    }
    if (match && match[1]) {
      const col = match[1].trim();
      const cleaned = records.map((r) => {
        const copy = { ...r };
        delete copy[col];
        return copy;
      });
      return { records: cleaned, prunedColumn: col };
    }
    return { records, prunedColumn: null };
  };

  // Server-Side Supabase Proxy: Push Batch (Solves browser "TypeError: Failed to fetch", CORS, and rate limits)
  app.post('/api/supabase/push-batch', async (req, res) => {
    try {
      const { url, anonKey, tableName, records: initialRecords, mode } = req.body || {};
      if (!url || !anonKey || !tableName || !Array.isArray(initialRecords) || initialRecords.length === 0) {
        return res.status(400).json({ success: false, message: 'Parameter URL, anonKey, tableName, dan records (array) wajib diisi.' });
      }

      const cleanUrl = url.trim().replace(/\/+$/, '');
      const cleanTable = tableName.trim();

      // 1. Filter out empty or whitespace-only emp_id rows to prevent constraint violations
      let records = initialRecords.filter((r) => r && String(r.emp_id || '').trim().length > 0);
      if (records.length === 0) {
        return res.json({ success: true, count: 0, note: 'Tidak ada baris data valid untuk dikirim' });
      }

      // 2. Deduplicate within the batch by (emp_id, tahun, bulan)
      // Postgres ON CONFLICT DO UPDATE throws "cannot affect row a second time" if duplicate keys exist in same batch!
      if (mode !== 'replace') {
        const seen = new Set<string>();
        const deduped: any[] = [];
        for (let i = records.length - 1; i >= 0; i--) {
          const r = records[i];
          const k = `${String(r.emp_id).trim()}_${r.tahun || ''}_${r.bulan || ''}`;
          if (!seen.has(k)) {
            seen.add(k);
            deduped.unshift(r);
          }
        }
        records = deduped;
      }

      // Helper for making fetch to Supabase
      const doPushAttempt = async (targetRecords: any[]) => {
        const endpoint = mode === 'replace'
          ? `${cleanUrl}/rest/v1/${cleanTable}`
          : `${cleanUrl}/rest/v1/${cleanTable}?on_conflict=emp_id,tahun,bulan`;

        return await fetch(endpoint, {
          method: 'POST',
          headers: {
            'apikey': anonKey,
            'Authorization': `Bearer ${anonKey}`,
            'Content-Type': 'application/json',
            'Prefer': mode === 'replace' ? 'return=minimal' : 'resolution=merge-duplicates'
          },
          body: JSON.stringify(targetRecords)
        });
      };

      let response = await doPushAttempt(records);

      // Handle Rate Limiting (429) or Server Busy / Gateway Timeout (502, 503, 504) with backoff retry
      if (response.status === 429 || response.status === 502 || response.status === 503 || response.status === 504) {
        console.warn(`[Supabase Proxy] Received HTTP ${response.status} from Supabase, backing off for 1200ms...`);
        await new Promise((r) => setTimeout(r, 1200));
        response = await doPushAttempt(records);
      }

      if (!response.ok) {
        let errorText = await response.text();

        // Loop pruning missing columns if schema cache complains (up to 5 iterations for multiple missing columns)
        let pruneAttempts = 0;
        while (pruneAttempts < 5) {
          const pruneResult = pruneMissingColumnFromRecords(records, errorText);
          if (!pruneResult.prunedColumn) break;
          console.warn(`[Supabase Proxy] Pruning missing column "${pruneResult.prunedColumn}" and retrying...`);
          records = pruneResult.records;
          response = await doPushAttempt(records);
          if (response.ok) {
            return res.json({ success: true, count: records.length, note: `Kolom ${pruneResult.prunedColumn} diabaikan (tidak ada di skema Supabase)` });
          }
          errorText = await response.text();
          pruneAttempts++;
        }

        // Fallback 1: If composite onConflict emp_id,tahun,bulan fails due to missing constraint, try onConflict: emp_id
        if (mode !== 'replace' && (errorText.includes('unique') || errorText.includes('constraint') || errorText.includes('ON CONFLICT') || response.status === 400 || response.status === 409)) {
          // Deduplicate by emp_id for single-column on_conflict
          const seenEmp = new Set<string>();
          const dedupedEmp: any[] = [];
          for (let i = records.length - 1; i >= 0; i--) {
            const r = records[i];
            const k = String(r.emp_id).trim();
            if (!seenEmp.has(k)) {
              seenEmp.add(k);
              dedupedEmp.unshift(r);
            }
          }

          const fbResponse = await fetch(`${cleanUrl}/rest/v1/${cleanTable}?on_conflict=emp_id`, {
            method: 'POST',
            headers: {
              'apikey': anonKey,
              'Authorization': `Bearer ${anonKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify(dedupedEmp)
          });
          if (fbResponse.ok) {
            return res.json({ success: true, count: dedupedEmp.length, note: 'Fallback onConflict emp_id sukses' });
          }

          // Fallback 2 (Atomic Delete-then-Insert): When table has NO unique constraint on emp_id,
          // delete the old records first in chunks so URL length is never exceeded
          try {
            const empIds = Array.from(new Set(records.map((r: any) => String(r.emp_id || '').trim()).filter(Boolean)));
            if (empIds.length > 0) {
              for (let d = 0; d < empIds.length; d += 25) {
                const subIds = empIds.slice(d, d + 25);
                const inFilter = subIds.map((id) => `"${encodeURIComponent(id)}"`).join(',');
                await fetch(`${cleanUrl}/rest/v1/${cleanTable}?emp_id=in.(${inFilter})`, {
                  method: 'DELETE',
                  headers: {
                    'apikey': anonKey,
                    'Authorization': `Bearer ${anonKey}`,
                    'Prefer': 'return=minimal'
                  }
                });
              }
            }

            const insertResponse = await fetch(`${cleanUrl}/rest/v1/${cleanTable}`, {
              method: 'POST',
              headers: {
                'apikey': anonKey,
                'Authorization': `Bearer ${anonKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
              },
              body: JSON.stringify(records)
            });

            if (insertResponse.ok) {
              return res.json({ success: true, count: records.length, note: 'Fallback clean atomic replace sukses' });
            }
          } catch (deleteInsertErr) {
            console.warn('[Supabase Proxy] Atomic delete-then-insert warning:', deleteInsertErr);
          }
        }

        // Fallback 3: Single-Record Rescue
        // If a batch of rows fails due to one corrupted row or tight constraint, insert records individually
        let singleSuccessCount = 0;
        let lastSingleErr = '';
        for (const item of records) {
          try {
            const singleRes = await fetch(`${cleanUrl}/rest/v1/${cleanTable}`, {
              method: 'POST',
              headers: {
                'apikey': anonKey,
                'Authorization': `Bearer ${anonKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
              },
              body: JSON.stringify([item])
            });
            if (singleRes.ok) {
              singleSuccessCount++;
            } else {
              lastSingleErr = await singleRes.text();
            }
          } catch (sErr: any) {
            lastSingleErr = sErr?.message || '';
          }
        }

        if (singleSuccessCount > 0) {
          return res.json({
            success: true,
            count: singleSuccessCount,
            partial: singleSuccessCount < records.length,
            note: `Penyisipan per baris sukses (${singleSuccessCount}/${records.length} data)`
          });
        }

        return res.status(response.status).json({ success: false, message: `Supabase error (${response.status}): ${errorText || lastSingleErr}` });
      }

      return res.json({ success: true, count: records.length });
    } catch (err: any) {
      console.error('[Supabase Server Proxy] Push error:', err);
      return res.status(500).json({ success: false, message: `Server proxy Supabase gagal: ${err?.message || 'Network error'}` });
    }
  });

  // Server-Side Supabase Proxy: Sync Single Employee Record Realtime
  app.post('/api/supabase/sync-single', async (req, res) => {
    try {
      const { url, anonKey, tableName, record } = req.body || {};
      if (!url || !anonKey || !tableName || !record || !record.emp_id) {
        return res.status(400).json({ success: false, message: 'Parameter URL, anonKey, tableName, dan record karyawan wajib diisi.' });
      }

      const cleanUrl = url.trim().replace(/\/+$/, '');
      const cleanTable = tableName.trim();
      const empId = String(record.emp_id).trim();
      const tahun = Number(record.tahun);
      const bulan = Number(record.bulan);

      // 1. Attempt PATCH to update matching record
      let filterUrl = `${cleanUrl}/rest/v1/${cleanTable}?emp_id=eq.${encodeURIComponent(empId)}`;
      if (!isNaN(tahun) && !isNaN(bulan)) {
        filterUrl += `&tahun=eq.${tahun}&bulan=eq.${bulan}`;
      }

      let patchResp = await fetch(filterUrl, {
        method: 'PATCH',
        headers: {
          'apikey': anonKey,
          'Authorization': `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(record)
      });

      if (patchResp.ok) {
        const patchData = await patchResp.json().catch(() => []);
        if (Array.isArray(patchData) && patchData.length > 0) {
          return res.json({ success: true, mode: 'updated', record: patchData[0] });
        }
      }

      // 2. If record was not in Supabase yet, attempt standard insert
      let insertResp = await fetch(`${cleanUrl}/rest/v1/${cleanTable}`, {
        method: 'POST',
        headers: {
          'apikey': anonKey,
          'Authorization': `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify([record])
      });

      if (insertResp.ok) {
        return res.json({ success: true, mode: 'inserted' });
      }

      const errText = await insertResp.text();
      return res.status(insertResp.status).json({ success: false, message: `Supabase single sync gagal (${insertResp.status}): ${errText}` });
    } catch (err: any) {
      console.error('[Supabase Proxy] Single sync error:', err);
      return res.status(500).json({ success: false, message: err?.message || 'Gagal sinkronisasi record ke Supabase' });
    }
  });

  // Server-Side Supabase Proxy: Clear / Delete Table
  app.post('/api/supabase/delete-table', async (req, res) => {
    try {
      const { url, anonKey, tableName } = req.body || {};
      if (!url || !anonKey || !tableName) {
        return res.status(400).json({ success: false, message: 'URL, anonKey, dan tableName wajib diisi.' });
      }

      const cleanUrl = url.trim().replace(/\/+$/, '');
      const response = await fetch(`${cleanUrl}/rest/v1/${tableName}?emp_id=neq.___MSM_EMPTY_GUARD___`, {
        method: 'DELETE',
        headers: {
          'apikey': anonKey,
          'Authorization': `Bearer ${anonKey}`,
          'Prefer': 'return=minimal'
        }
      });

      if (!response.ok) {
        // Fallback delete with id filter
        await fetch(`${cleanUrl}/rest/v1/${tableName}?id=gt.0`, {
          method: 'DELETE',
          headers: {
            'apikey': anonKey,
            'Authorization': `Bearer ${anonKey}`,
            'Prefer': 'return=minimal'
          }
        });
      }

      return res.json({ success: true, message: 'Tabel berhasil dibersihkan via server proxy.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Gagal menghapus data tabel via proxy.' });
    }
  });

  // Server-Side Supabase Proxy: Fetch Users (auto-detects system_users, users_accounts, user_accounts, users)
  app.post('/api/supabase/users/fetch', async (req, res) => {
    try {
      const { url, anonKey, tableName } = req.body || {};
      if (!url || !anonKey) {
        return res.status(400).json({ success: false, message: 'URL dan anonKey wajib diisi.' });
      }

      const cleanUrl = url.trim().replace(/\/+$/, '');
      const candidateTables = Array.from(new Set([
        tableName,
        'system_users',
        'users_accounts',
        'user_accounts',
        'users'
      ])).filter(Boolean) as string[];

      // Parallel query all candidate tables to eliminate sequential multi-second network delay!
      const promises = candidateTables.map(async (t) => {
        try {
          const resp = await fetch(`${cleanUrl}/rest/v1/${t}?select=*`, {
            method: 'GET',
            headers: {
              'apikey': anonKey,
              'Authorization': `Bearer ${anonKey}`,
              'Accept': 'application/json'
            }
          });

          if (resp.ok) {
            const data = await resp.json();
            if (Array.isArray(data)) {
              return { table: t, data };
            }
          }
        } catch (_) {}
        return null;
      });

      const results = await Promise.all(promises);
      // Prioritize table with records, or any table that responded successfully
      const found = results.find((r) => r && r.data && r.data.length > 0) || results.find((r) => r && r.data);

      if (!found) {
        return res.status(404).json({
          success: false,
          message: `Tidak ditemukan tabel akun pengguna di Supabase. Tabel yang dicoba: ${candidateTables.join(', ')}.`
        });
      }

      return res.json({
        success: true,
        tableName: found.table,
        users: found.data,
        message: `Berhasil memuat ${found.data.length} akun pengguna dari tabel Supabase "${found.table}".`
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Gagal memuat akun pengguna dari Supabase.' });
    }
  });

  // Server-Side Supabase Proxy: Push Users
  app.post('/api/supabase/users/push', async (req, res) => {
    try {
      const { url, anonKey, tableName, users } = req.body || {};
      if (!url || !anonKey || !Array.isArray(users) || users.length === 0) {
        return res.status(400).json({ success: false, message: 'URL, anonKey, dan users (array) wajib diisi.' });
      }

      const cleanUrl = url.trim().replace(/\/+$/, '');
      const targetTable = tableName || 'system_users';

      const resp = await fetch(`${cleanUrl}/rest/v1/${targetTable}?on_conflict=username`, {
        method: 'POST',
        headers: {
          'apikey': anonKey,
          'Authorization': `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(users)
      });

      if (!resp.ok) {
        const errText = await resp.text();
        return res.status(resp.status).json({ success: false, message: `Supabase error (${resp.status}): ${errText}` });
      }

      return res.json({
        success: true,
        count: users.length,
        tableName: targetTable,
        message: `Berhasil menyimpan ${users.length} akun ke tabel Supabase "${targetTable}".`
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Gagal mengirim akun ke Supabase.' });
    }
  });

  // =========================================================================
  // API ROUTE: ACTIVITY & EMAIL LOGS
  // =========================================================================
  app.get('/api/system/activity-logs', (req, res) => {
    try {
      const limit = Number(req.query.limit) || 50;
      const logs = getActivityLogs(limit);
      res.json({ success: true, logs });
    } catch (err: any) {
      res.status(500).json({ success: false, message: 'Gagal memuat log aktivitas.' });
    }
  });

  app.get('/api/system/email-logs', (req, res) => {
    try {
      const limit = Number(req.query.limit) || 50;
      const logs = getEmailLogs(limit);
      res.json({ success: true, logs });
    } catch (err: any) {
      res.status(500).json({ success: false, message: 'Gagal memuat riwayat pengiriman email.' });
    }
  });

  // =========================================================================
  // API ROUTE: TEST SMTP CONNECTION
  // =========================================================================
  app.post('/api/test-smtp', async (req, res) => {
    try {
      const { host, port, secure, user, pass, from } = req.body || {};

      const smtpHost = host || process.env.SMTP_HOST;
      const smtpPort = port ? Number(port) : (process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587);
      const smtpSecure = secure !== undefined ? Boolean(secure) : (process.env.SMTP_SECURE === 'true' || smtpPort === 465);
      const smtpUser = user || process.env.SMTP_USER;
      const smtpPass = pass || process.env.SMTP_PASS;

      if (!smtpHost) {
        return res.status(400).json({
          success: false,
          message: 'Host SMTP belum ditentukan.'
        });
      }

      const transportOptions: nodemailer.TransportOptions = {
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: (smtpUser && smtpPass) ? { user: smtpUser, pass: smtpPass } : undefined,
        connectionTimeout: 10000,
        greetingTimeout: 5000
      } as any;

      const transporter = nodemailer.createTransport(transportOptions);
      await transporter.verify();

      return res.json({
        success: true,
        message: `Koneksi ke server SMTP (${smtpHost}:${smtpPort}) berhasil diverifikasi.`
      });
    } catch (err: any) {
      console.error('SMTP test error:', err);
      return res.status(500).json({
        success: false,
        message: `Gagal terhubung ke SMTP: ${err?.message || 'Error tidak diketahui'}`
      });
    }
  });

  // =========================================================================
  // API ROUTE: SEND EMAIL DIRECTLY FROM SYSTEM
  // =========================================================================
  app.post('/api/send-email', async (req, res) => {
    try {
      const {
        to,
        cc,
        bcc,
        subject,
        htmlBody,
        plainTextBody,
        senderName,
        senderEmail,
        pdfBase64,
        pdfFileName,
        smtpConfig
      } = req.body || {};

      if (!to) {
        return res.status(400).json({
          success: false,
          message: 'Alamat email penerima (To) wajib diisi.'
        });
      }

      if (!subject || (!htmlBody && !plainTextBody)) {
        return res.status(400).json({
          success: false,
          message: 'Subjek dan konten email wajib diisi.'
        });
      }

      // Determine sender identity
      const defaultSenderName = 'Multi-Skill Monitoring System — Ajinomoto Mojokerto Factory';
      const defaultSenderEmail = process.env.SMTP_FROM || 'noreply@ajinomoto.co.id';
      const fromHeader = `"${senderName || defaultSenderName}" <${senderEmail || defaultSenderEmail}>`;

      // Determine SMTP config
      const host = smtpConfig?.host || process.env.SMTP_HOST;
      const port = smtpConfig?.port ? Number(smtpConfig.port) : (process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587);
      const secure = smtpConfig?.secure !== undefined
        ? Boolean(smtpConfig.secure)
        : (process.env.SMTP_SECURE === 'true' || port === 465);
      const user = smtpConfig?.user || process.env.SMTP_USER;
      const pass = smtpConfig?.pass || process.env.SMTP_PASS;

      let transporter: nodemailer.Transporter;
      let isSimulated = false;
      let previewUrl = '';

      if (host && user && pass) {
        // Mode 1: Custom / Configured Real SMTP Server
        transporter = nodemailer.createTransport({
          host,
          port,
          secure,
          auth: { user, pass },
          connectionTimeout: 15000,
          tls: {
            rejectUnauthorized: false // Allow self-signed or internal enterprise certs
          }
        });
      } else if (host) {
        // Mode 2: Unauthenticated Internal SMTP Relay (Corporate Factory Relay)
        transporter = nodemailer.createTransport({
          host,
          port,
          secure: false,
          connectionTimeout: 15000,
          tls: {
            rejectUnauthorized: false
          }
        });
      } else {
        // Mode 3: Direct Built-in System Dispatcher (uses Ethereal/Test Transporter fallback)
        try {
          const testAccount = await nodemailer.createTestAccount();
          transporter = nodemailer.createTransport({
            host: testAccount.smtp.host,
            port: testAccount.smtp.port,
            secure: testAccount.smtp.secure,
            auth: {
              user: testAccount.user,
              pass: testAccount.pass
            }
          });
        } catch (_) {
          // Fallback transporter
          transporter = nodemailer.createTransport({
            jsonTransport: true
          });
          isSimulated = true;
        }
      }

      // Prepare Attachments (PDF)
      const attachments = [];
      if (pdfBase64) {
        const cleanBase64 = pdfBase64.includes('base64,')
          ? pdfBase64.split('base64,')[1]
          : pdfBase64.replace(/^data:[^;]+;base64,/, '');
        attachments.push({
          filename: pdfFileName || 'Laporan_MultiSkill_Ajinomoto.pdf',
          content: Buffer.from(cleanBase64, 'base64'),
          contentType: 'application/pdf'
        });
      }

      // Send Mail
      const mailOptions: nodemailer.SendMailOptions = {
        from: fromHeader,
        to: Array.isArray(to) ? to.join(', ') : to,
        cc: cc ? (Array.isArray(cc) ? cc.join(', ') : cc) : undefined,
        bcc: bcc ? (Array.isArray(bcc) ? bcc.join(', ') : bcc) : undefined,
        subject: subject,
        html: htmlBody || undefined,
        text: plainTextBody || undefined,
        attachments: attachments.length ? attachments : undefined
      };

      const info = await transporter.sendMail(mailOptions);

      if (!isSimulated && nodemailer.getTestMessageUrl) {
        const testUrl = nodemailer.getTestMessageUrl(info);
        if (testUrl) {
          previewUrl = testUrl;
        }
      }

      const recipientStr = Array.isArray(to) ? to.join(', ') : to;
      const responseMessage = `Laporan resmi berhasil dikirimkan langsung dari sistem ke ${recipientStr}${attachments.length ? ' beserta lampiran dokumen PDF resmi' : ''}.`;
      const msgId = info.messageId || `MSG-${Date.now()}`;

      // Persist in Email & Activity Database
      addEmailLog({
        recipient: recipientStr,
        cc: cc ? (Array.isArray(cc) ? cc.join(', ') : cc) : undefined,
        bcc: bcc ? (Array.isArray(bcc) ? bcc.join(', ') : bcc) : undefined,
        subject,
        senderName: senderName || defaultSenderName,
        senderEmail: senderEmail || defaultSenderEmail,
        messageId: msgId,
        hasAttachment: attachments.length > 0,
        status: 'SENT',
        previewUrl: previewUrl || undefined
      });

      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      addActivityLog(
        senderEmail || 'system',
        'EMAIL_SENT',
        `Mengirim laporan resmi via Direct Dispatch ke ${recipientStr} (Subjek: ${subject})`,
        clientIp
      );

      return res.json({
        success: true,
        message: responseMessage,
        messageId: msgId,
        previewUrl: previewUrl || undefined,
        recipient: recipientStr,
        timestamp: new Date().toISOString(),
        hasAttachment: attachments.length > 0
      });
    } catch (err: any) {
      console.error('Error sending email directly from system:', err);

      try {
        const { to, subject, senderName, senderEmail } = req.body || {};
        const recipientStr = Array.isArray(to) ? to.join(', ') : (to || 'Unknown');
        addEmailLog({
          recipient: recipientStr,
          subject: subject || 'Laporan Multi-Skill',
          senderName: senderName || 'System',
          senderEmail: senderEmail || 'system@ajinomoto.co.id',
          messageId: `ERR-${Date.now()}`,
          hasAttachment: false,
          status: 'FAILED'
        });
      } catch (_) {}

      return res.status(500).json({
        success: false,
        message: `Gagal mengirim email langsung: ${err?.message || 'Terjadi gangguan koneksi ke server email'}`
      });
    }
  });

  // =========================================================================
  // VITE MIDDLEWARE SETUP
  // =========================================================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Multi-Skill Monitoring System running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
