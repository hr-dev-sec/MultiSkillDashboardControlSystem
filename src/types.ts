/**
 * Multi-Skill Monitoring System Types
 * PT Ajinomoto Indonesia - Mojokerto Factory
 */

export interface SkillMeta {
  code: string;
  family: string;
  group: string;
}

export type JobPositionCategory = 'DEPT_MGR_UP' | 'ASM_SM' | 'LL_FOREMAN';

export interface Employee {
  rowIndex: number;
  no: number;
  empId: string;
  empName: string;
  divisi: string;
  department: string;
  section: string;
  grade: string;
  jobGrade: string;
  jabatan: string;
  gender: 'L' | 'P' | string;
  tanggalPensiun?: string;
  pic?: string;
  tahun: number;
  bulan: number;
  jobCategory: JobPositionCategory | null;
  totalScore: number;
  standard: number | null;
  result: 'MS' | 'US' | null;
  gap: number | null;
  skills: Record<string, boolean>;
}

export type UserScopeType = 'ALL' | 'DIVISI' | 'DEPARTMENT' | 'PIC';

export interface UserSession {
  username: string;
  name: string;
  role: string;
  department: string;
  divisi?: string;
  scopeType?: UserScopeType;
  scopeValue?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  email?: string;
  phone?: string;
  nik?: string;
  avatarUrl?: string;
  bio?: string;
  signatureImage?: string;
  token?: string;
  canEditCompetency?: boolean;
  canManageUsers?: boolean;
}

export interface UserAccount {
  username: string;
  password?: string;
  name: string;
  role: string;
  department: string;
  divisi?: string;
  scopeType?: UserScopeType;
  scopeValue?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  email?: string;
  phone?: string;
  nik?: string;
  avatarUrl?: string;
  bio?: string;
  signatureImage?: string;
  createdAt?: string;
  updatedAt?: string;
  lastLogin?: string;
  canEditCompetency?: boolean;
  canManageUsers?: boolean;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  username: string;
  action: 'LOGIN_SUCCESS' | 'PROFILE_UPDATED' | 'PHOTO_UPDATED' | 'PASSWORD_CHANGED' | 'USER_CREATED' | 'USER_DELETED' | 'SETTINGS_SAVED' | 'EMAIL_SENT' | 'PERIOD_DUPLICATED' | 'DATABASE_EXPORTED';
  details: string;
  ip?: string;
}

export interface EmailLog {
  id: string;
  timestamp: string;
  recipient: string;
  cc?: string;
  bcc?: string;
  subject: string;
  senderName: string;
  senderEmail: string;
  messageId: string;
  hasAttachment: boolean;
  status: 'SENT' | 'FAILED';
  previewUrl?: string;
}

export interface SystemConfig {
  smtp: {
    host: string;
    port: number;
    user: string;
    pass: string;
    fromName: string;
    fromEmail: string;
    secure: boolean;
    enabled: boolean;
  };
  googleSheetUrl: string;
  eSignApprover: {
    name: string;
    role: string;
    nik: string;
    department: string;
    defaultNote: string;
  };
  jobPositionTargets: {
    LL_FOREMAN: number;
    ASM_SM: number;
    DEPT_MGR_UP: number;
  };
  supabaseConfig?: {
    url: string;
    anonKey: string;
    tableName: string;
  };
  updatedAt: string;
}

export interface PeriodsData {
  tahunList: number[];
  bulanByTahun: Record<string, number[]>;
  currentTahun: number;
  currentBulan: number;
  bulanLabels: string[];
}

export interface ConfigMeta {
  targetPercent: Record<JobPositionCategory, number>;
  jobPositionMeta: Record<JobPositionCategory, { label: string; threshold: number }>;
  bulanLabels: string[];
}

export interface AppFiltersState {
  tahun: string[];
  bulan: string[];
  divisi: string[];
  department: string[];
  jabatan: string[];
}

export interface PositionStat {
  key: JobPositionCategory;
  label: string;
  threshold: number;
  target: number;
  manpower: number;
  ok: number;
  notOk: number;
  resultPercent: number;
}

export interface GroupStat {
  label: string;
  ms: number;
  us: number;
}

export interface DashboardStats {
  totalManpower: number;
  totalMS: number;
  totalUS: number;
  percentMS: number;
  byPosition: PositionStat[];
  byDivisi: GroupStat[];
  byDepartment: GroupStat[];
  byGrade: GroupStat[];
  genderMap: { L: number; P: number; Lainnya: number };
  notes: string[];
  lastUpdated: string;
}
