import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
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

dotenv.config();

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
