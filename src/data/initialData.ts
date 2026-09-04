import { SkillMeta, Employee, UserAccount, ConfigMeta } from '../types';

export const BULAN_LABELS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const GRADE_ORDER = ['M5', 'M4', 'M3', 'M2', 'M1', 'ST5', 'ST4', 'ST3', 'ST2', 'ST1'];

export const CONFIG_META: ConfigMeta = {
  targetPercent: {
    LL_FOREMAN: 0.30,
    ASM_SM: 0.30,
    DEPT_MGR_UP: 0.30
  },
  jobPositionMeta: {
    DEPT_MGR_UP: { label: 'Dept. Manager up', threshold: 4 },
    ASM_SM: { label: 'ASM - SM', threshold: 3 },
    LL_FOREMAN: { label: 'LL - Foreman', threshold: 2 }
  },
  bulanLabels: BULAN_LABELS
};

export const INITIAL_USERS: UserAccount[] = [
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
    canEditCompetency: false,
    canManageUsers: false
  }
];

// -------------------------------------------------------------
// 92 Skill Competency Matrix Definitions (Matching Google Sheet Master)
// -------------------------------------------------------------
export const INITIAL_SKILL_META: SkillMeta[] = [
  { code: 'FI-1 / H-1', family: 'Decalfication & SACC Process MSG', group: 'FI / H' },
  { code: 'FI-1 / H-2', family: 'Fermentation Process MSG', group: 'FI / H' },
  { code: 'FI-1 / H-4', family: 'Isolation Process MSG', group: 'FI / H' },
  { code: 'FI-1 / H-5,6', family: 'Purification Process MSG', group: 'FI / H' },
  { code: 'FI-2 / Production', family: 'Packaging MSG', group: 'FI-2' },
  { code: 'FI-2 / Supporting', family: 'Packaging MSG', group: 'FI-2' },
  { code: 'FP-1 / EMP', family: 'Extract Meat Process', group: 'FP-1' },
  { code: 'FP-1 / Masako Bulk', family: 'Granules Process', group: 'FP-1' },
  { code: 'FP-1 / Masako Pack', family: 'Packaging Process', group: 'FP-1' },
  { code: 'FP-2 / Sajiku Bulk', family: 'Flour Process', group: 'FP-2' },
  { code: 'FP-2 / Sajiku Pack', family: 'Flour Packaging Process', group: 'FP-2' },
  { code: 'FP-2 / Mayumi', family: 'Sauce Process & Packaging', group: 'FP-2' },
  { code: 'FL-1 / Lamination', family: 'Printing & Lamination Film', group: 'FL-1' },
  { code: 'FL-1 / Supporting', family: 'QC Film', group: 'FL-1' },
  { code: 'IC / IC - Material', family: 'Warehouse Management', group: 'IC' },
  { code: 'IC / EDC', family: 'Distribution Warehouse', group: 'IC' },
  { code: 'PE / Procurement', family: 'Purchasing', group: 'PE' },
  { code: 'PE / EXIM', family: 'Export & Import', group: 'PE' },
  { code: 'PPC / PPC FOOD', family: 'Production Planning & Control', group: 'PPC' },
  { code: 'PPC / PPC Development', family: 'Production Planning & Control', group: 'PPC' },
  { code: 'PPC / PPC MSG', family: 'Production Planning & Control', group: 'PPC' },
  { code: 'E&M / T-1', family: 'Maintenance', group: 'E&M' },
  { code: 'E&M / T-2', family: 'Design & Construction', group: 'E&M' },
  { code: 'E&M / T-3', family: 'Electric & Instrument', group: 'E&M' },
  { code: 'Utility / Utility - 1', family: 'Energy Process', group: 'Utility' },
  { code: 'Utility / Utility - 2', family: 'Energy Process', group: 'Utility' },
  { code: 'Utility / WWT', family: 'Water Treatment Process', group: 'Utility' },
  { code: 'Agri / Production Liquid Co-Pro.', family: 'Production Co-Product', group: 'Agri' },
  { code: 'Agri / Production Solid Co-Pro', family: 'Production Co-Product', group: 'Agri' },
  { code: 'GA / GA-1', family: 'Communication & Services', group: 'GA' },
  { code: 'GA / GA-2', family: 'Fixed Asset & Transportation', group: 'GA' },
  { code: 'HRL / HR Development', family: 'HR Development', group: 'HRL' },
  { code: 'HRL / HR Operation & Administration', family: 'HR Operation & Administration', group: 'HRL' },
  { code: 'Legal / Corporate & Regulatory Compliance', family: 'Corporate & Regulatory Compliance', group: 'Legal' },
  { code: 'Legal / Permit & Legal Administration', family: 'Permit & Legal Administration', group: 'Legal' },
  { code: 'STTC / STTC', family: 'Customs', group: 'STTC' },
  { code: 'FOE / Digital Infrastructure & Security', family: 'Digital Infrastructure & Security', group: 'FOE' },
  { code: 'FOE / Operational Aplication & Development', family: 'Operational Aplication & Development', group: 'FOE' },
  { code: 'HSE / Health & Safety', family: 'Health & Safety', group: 'HSE' },
  { code: 'HSE / Environment', family: 'Environment', group: 'HSE' },
  { code: 'QA NE / Quality Assurance', family: 'QA', group: 'QA NE' },
  { code: 'QA NE / Quality Control', family: 'QC', group: 'QA NE' },
  { code: 'ITEC Proc.', family: 'R&D', group: 'ITEC' },
  { code: 'ITEC Proj.', family: 'Building Process Improvement', group: 'ITEC' },
  { code: 'Prod. / H-0', family: 'Strain Preparation', group: 'Prod. NEX' },
  { code: 'Prod. / H-2', family: 'Fermentation Process MSG', group: 'Prod. NEX' },
  { code: 'Prod. / H-4', family: 'Isolation Process MSG', group: 'Prod. NEX' },
  { code: 'Prod. / H-5,6', family: 'Purification Process MSG', group: 'Prod. NEX' },
  { code: 'Prod. / H-7', family: 'Packaging MSG', group: 'Prod. NEX' },
  { code: 'QA NEX / QA', family: 'QA', group: 'QA NEX' },
  { code: 'FA', family: 'Finance', group: 'FA' },
  { code: 'IFTC / Food Dev.', family: 'R&D', group: 'IFTC' },
  { code: 'IFTC / Packing & Printing', family: 'Packing & Printing Dev.', group: 'IFTC' },
  { code: 'IFTC / IFTC - Krw', family: 'Building Process Improvement', group: 'IFTC' },
  { code: 'IFTC Eng. / Eng. Food & MSG', family: 'Building Process Improvement', group: 'IFTC' },
  { code: 'PPIC NEX / IC', family: 'Warehouse Management', group: 'PPIC NEX' },
  { code: 'PPIC NEX / PPC', family: 'Production Planning & Control', group: 'PPIC NEX' },
  { code: 'ABI / Production', family: 'Production Bread', group: 'ABI' },
  { code: 'FP-1 KRW / Masako Bulk', family: 'Granules Process', group: 'FP KRW' },
  { code: 'FP-1 KRW / Masako Pack', family: 'Packaging Process', group: 'FP KRW' },
  { code: 'FP-2 KRW / Sajiku Bulk', family: 'Flour Process', group: 'FP KRW' },
  { code: 'FP-2 KRW / Sajiku Pack', family: 'Flour Packaging Process', group: 'FP KRW' },
  { code: 'FP-3 KRW / Saori Bulk', family: 'Sauce Process', group: 'FP KRW' },
  { code: 'FP-3 KRW / Saori Pack', family: 'Sauce Packaging', group: 'FP KRW' },
  { code: 'PPIC KRW / PPC', family: 'Production Planning & Control', group: 'PPIC KRW' },
  { code: 'PPIC KRW / IC - Material', family: 'Warehouse Management', group: 'PPIC KRW' },
  { code: 'PPIC KRW / KDC', family: 'Warehouse Management', group: 'PPIC KRW' },
  { code: 'GA KRW / Personnel', family: 'HR', group: 'GA KRW' },
  { code: 'GA KRW / General Affairs', family: 'GA', group: 'GA KRW' },
  { code: 'GA KRW / Legal & Asset', family: 'Legal & Asset', group: 'GA KRW' },
  { code: 'PS KRW / Utility', family: 'Energy Process', group: 'PS KRW' },
  { code: 'PS KRW / EM - 1', family: 'Maintenance', group: 'PS KRW' },
  { code: 'PS KRW / EM - 2', family: 'Maintenance', group: 'PS KRW' },
  { code: 'PS KRW / HSE', family: 'Health Safety & Environment', group: 'PS KRW' },
  { code: 'PS KRW / WWT & Utilization', family: 'Water Treatment', group: 'PS KRW' },
  { code: 'QA KRW / QA', family: 'QA', group: 'QA KRW' },
  { code: 'QA KRW / QC', family: 'QC', group: 'QA KRW' },
  { code: 'FT / Process Technology', family: 'Process Improvement', group: 'FT' },
  { code: 'FT / Packing Printing', family: 'Packing & Printing Improvement', group: 'FT' },
  { code: 'FE / Food Engineering', family: 'Food Engineering Improvement', group: 'FE' },
  { code: 'SSP / Food Material SSD', family: 'Purchasing', group: 'SSP' },
  { code: 'SSP / Packaging Material SSD', family: 'Purchasing', group: 'SSP' },
  { code: 'SSP / Consumable Goods SSD', family: 'Purchasing', group: 'SSP' },
  { code: 'SSP / MSG, Energy & Co-Prod Material SSD', family: 'Purchasing', group: 'SSP' },
  { code: 'PSA / Production OE / DX Promotion', family: 'DX Improvement', group: 'PSA' },
  { code: 'PSA / Production Administration', family: 'Production Administration', group: 'PSA' },
  { code: 'IT', family: 'IT', group: 'IT' },
  { code: 'Agri / Sales & Marketing', family: 'Sales Co-Product', group: 'Agri' },
  { code: 'Agri / Business Dev.', family: 'Business Dev. Co-Product', group: 'Agri' },
  { code: 'GA HO / GA - Development', family: 'GA', group: 'GA HO' },
  { code: 'COEC / COEC Development', family: 'Finance', group: 'COEC' },
  { code: 'COEC / COEC Site Operation', family: 'Salary & Benefit', group: 'COEC' }
];

export function getJabatanCategory(jabatan: string): 'DEPT_MGR_UP' | 'ASM_SM' | 'LL_FOREMAN' | null {
  if (!jabatan) return null;
  const j = jabatan.toString().toLowerCase().trim();

  // Dept. Manager up (Threshold: 4)
  if (
    j.includes('general manager') ||
    j.includes('gm') ||
    j.includes('department manager') ||
    j.includes('dept. manager') ||
    j.includes('dept manager') ||
    j.includes('senior manager') ||
    j.includes('plant manager')
  ) {
    return 'DEPT_MGR_UP';
  }

  // ASM - SM (Threshold: 3)
  if (
    j.includes('section manager') ||
    j.includes('associate manager') ||
    j.includes('asst. manager') ||
    j.includes('assistant manager') ||
    j.includes('sec. manager') ||
    j === 'sm' ||
    j === 'asm'
  ) {
    return 'ASM_SM';
  }

  // LL - Foreman (Threshold: 2)
  if (
    j.includes('line leader') ||
    j.includes('group leader') ||
    j.includes('assistant foreman') ||
    j.includes('asst. foreman') ||
    j.includes('foreman') ||
    j.includes('leader')
  ) {
    return 'LL_FOREMAN';
  }

  return null;
}

export function resolveStandard(sheetStandardValue: any, jabatan: string): number | null {
  const fromSheet = Number(sheetStandardValue);
  if (!isNaN(fromSheet) && fromSheet > 0) return fromSheet;

  const category = getJabatanCategory(jabatan);
  return category ? CONFIG_META.jobPositionMeta[category].threshold : 2;
}

export function getStandardForJabatan(jabatan: string): {
  standard: number;
  category: 'DEPT_MGR_UP' | 'ASM_SM' | 'LL_FOREMAN' | null;
  label: string;
} {
  const category = getJabatanCategory(jabatan);
  if (category) {
    return {
      standard: CONFIG_META.jobPositionMeta[category].threshold,
      category,
      label: CONFIG_META.jobPositionMeta[category].label
    };
  }
  return {
    standard: 2,
    category: null,
    label: 'Staff / Operator (Standard Dasar)'
  };
}

export function calculateEmployeeScore(skills: Record<string, boolean>, jabatan: string, customStandard?: number | null): {
  totalScore: number;
  standard: number | null;
  result: 'MS' | 'US' | null;
  gap: number | null;
  jobCategory: 'DEPT_MGR_UP' | 'ASM_SM' | 'LL_FOREMAN' | null;
} {
  const totalScore = Object.values(skills).filter(Boolean).length;
  const jobCategory = getJabatanCategory(jabatan);
  const standard = customStandard !== undefined && customStandard !== null && !isNaN(Number(customStandard)) && Number(customStandard) > 0
    ? Number(customStandard)
    : (jobCategory ? CONFIG_META.jobPositionMeta[jobCategory].threshold : 2);

  const result = totalScore >= standard ? 'MS' : 'US';
  const gap = totalScore - standard;

  return { totalScore, standard, result, gap, jobCategory };
}

// Generate realistic employee records for Mojokerto Factory
const rawEmployeeTemplates = [
  {
    empId: '119711183',
    empName: 'IMAM GATOT ISWANTO',
    divisi: 'AI (A-MJK) Level 3',
    department: 'Film & Lamination (A-MJK) Department',
    section: 'FL Production',
    grade: 'ST3',
    jobGrade: 'JG-05',
    jabatan: 'Foreman FL Production',
    gender: 'L',
    tanggalPensiun: '14 Nov 2038',
    pic: 'Prima Wahyudi',
    skillIndices: [12, 13]
  },
  {
    empId: '119609201',
    empName: 'PRIMA WAHYUDI',
    divisi: 'AI (A-MJK) Level 3',
    department: 'Film & Lamination (A-MJK) Department',
    section: 'FL Production',
    grade: 'ST4',
    jobGrade: 'JG-06',
    jabatan: 'Line Leader FL',
    gender: 'L',
    tanggalPensiun: '28 Agu 2042',
    pic: 'Imam Gatot',
    skillIndices: [12, 13, 21]
  },
  {
    empId: '119911085',
    empName: 'MOHAMAD PUJIONO',
    divisi: 'AI (A-MJK) Level 3',
    department: 'Film & Lamination (A-MJK) Department',
    section: 'FL Production',
    grade: 'ST2',
    jobGrade: 'JG-04',
    jabatan: 'Operator FL Production',
    gender: 'L',
    tanggalPensiun: '10 Mei 2045',
    pic: 'Prima Wahyudi',
    skillIndices: [12]
  },
  {
    empId: '119911076',
    empName: 'HERI PRAMUJI',
    divisi: 'Food Ingredients (A-MJK)',
    department: 'Food Ingredients-2 (A-MJK)',
    section: 'Production FI',
    grade: 'ST4',
    jobGrade: 'JG-06',
    jabatan: 'Line Leader FI-2',
    gender: 'L',
    tanggalPensiun: '22 Des 2049',
    pic: 'Heri Pramuji',
    skillIndices: [4, 5, 21]
  },
  {
    empId: '119704071',
    empName: 'HERU SUSANTO',
    divisi: 'Food Ingredients (A-MJK)',
    department: 'Food Ingredients-2 (A-MJK)',
    section: 'Production FI',
    grade: 'ST3',
    jobGrade: 'JG-05',
    jabatan: 'Foreman FI Production',
    gender: 'L',
    tanggalPensiun: '18 Jul 2051',
    pic: 'Heri Pramuji',
    skillIndices: [4, 5]
  },
  {
    empId: '119704058',
    empName: 'IFAN TOHARI',
    divisi: 'Food Ingredients (A-MJK)',
    department: 'Food Ingredients-2 (A-MJK)',
    section: 'Supporting FI',
    grade: 'ST3',
    jobGrade: 'JG-05',
    jabatan: 'Staff Supporting FI',
    gender: 'L',
    tanggalPensiun: '05 Okt 2039',
    pic: 'Heri Pramuji',
    skillIndices: [4, 5]
  },
  {
    empId: '120008074',
    empName: 'LUTFI HASAN',
    divisi: 'Food Ingredients (A-MJK)',
    department: 'Food Ingredients-2 (A-MJK)',
    section: 'Production FI',
    grade: 'ST2',
    jobGrade: 'JG-04',
    jabatan: 'Operator Process FI',
    gender: 'L',
    tanggalPensiun: '12 Jan 2046',
    pic: 'Heru Susanto',
    skillIndices: [4]
  },
  {
    empId: '119810069',
    empName: 'MANSYUR AFFANDI',
    divisi: 'Food Ingredients (A-MJK)',
    department: 'Food Ingredients-2 (A-MJK)',
    section: 'Production FI',
    grade: 'ST2',
    jobGrade: 'JG-04',
    jabatan: 'Operator FI-2',
    gender: 'L',
    tanggalPensiun: '30 Sep 2050',
    pic: 'Heru Susanto',
    skillIndices: [4, 5]
  },
  {
    empId: '119810075',
    empName: 'MUKTASOM',
    divisi: 'Food Ingredients (A-MJK)',
    department: 'Food Ingredients-2 (A-MJK)',
    section: 'Production FI',
    grade: 'ST3',
    jobGrade: 'JG-05',
    jabatan: 'Foreman FI-2',
    gender: 'L',
    tanggalPensiun: '19 Mar 2043',
    pic: 'Heri Pramuji',
    skillIndices: [4, 5]
  },
  {
    empId: '120501032',
    empName: 'ADI WAHONO',
    divisi: 'Food Products (A-MJK)',
    department: 'Food Production-1 (A-MJK)',
    section: 'Masako Bulk',
    grade: 'ST2',
    jobGrade: 'JG-04',
    jabatan: 'Operator Masako Bulk',
    gender: 'L',
    tanggalPensiun: '08 Feb 2044',
    pic: 'Andik Hariono',
    skillIndices: [7]
  },
  {
    empId: '119704065',
    empName: 'ANDIK HARIONO',
    divisi: 'Food Products (A-MJK)',
    department: 'Food Production-1 (A-MJK)',
    section: 'Masako Bulk',
    grade: 'ST3',
    jobGrade: 'JG-05',
    jabatan: 'Foreman Masako Bulk',
    gender: 'L',
    tanggalPensiun: '15 Jun 2041',
    pic: 'Dwi Susilo',
    skillIndices: [7, 8]
  },
  {
    empId: '119704063',
    empName: 'DWI SUSILO',
    divisi: 'Food Products (A-MJK)',
    department: 'Food Production-1 (A-MJK)',
    section: 'Masako Bulk',
    grade: 'ST4',
    jobGrade: 'JG-06',
    jabatan: 'Line Leader Masako Bulk',
    gender: 'L',
    tanggalPensiun: '03 Nov 2048',
    pic: 'Andik Hariono',
    skillIndices: [6, 7, 8]
  },
  {
    empId: '119308093',
    empName: 'ANDRI PURNAMA JUNIAWAN',
    divisi: 'Food Products (A-MJK)',
    department: 'Food Production-1 (A-MJK)',
    section: 'Masako Pack',
    grade: 'ST4',
    jobGrade: 'JG-06',
    jabatan: 'Line Leader Masako Pack',
    gender: 'L',
    tanggalPensiun: '25 Apr 2052',
    pic: 'Dedy Setiawan',
    skillIndices: [7, 8, 21]
  },
  {
    empId: '119711198',
    empName: 'DEDY SETIAWAN',
    divisi: 'Food Products (A-MJK)',
    department: 'Food Production-1 (A-MJK)',
    section: 'Masako Pack',
    grade: 'ST3',
    jobGrade: 'JG-05',
    jabatan: 'Foreman Masako Pack',
    gender: 'L',
    tanggalPensiun: '11 Des 2037',
    pic: 'Andri Purnama',
    skillIndices: [7, 8]
  },
  {
    empId: '119704048',
    empName: 'DHATUK SISWO PURWANTO',
    divisi: 'Food Products (A-MJK)',
    department: 'Food Production-1 (A-MJK)',
    section: 'Masako Pack',
    grade: 'ST3',
    jobGrade: 'JG-05',
    jabatan: 'Foreman Masako Pack',
    gender: 'L',
    tanggalPensiun: '09 Sep 2040',
    pic: 'Andri Purnama',
    skillIndices: [7, 8]
  },
  {
    empId: '120405062',
    empName: 'SUPRIYADI',
    divisi: 'Food Products (A-MJK)',
    department: 'Food Production-1 (A-MJK)',
    section: 'Masako Pack',
    grade: 'ST2',
    jobGrade: 'JG-04',
    jabatan: 'Operator Masako Pack',
    gender: 'L',
    tanggalPensiun: '17 Jan 2047',
    pic: 'Dedy Setiawan',
    skillIndices: [8]
  },
  {
    empId: '119804020',
    empName: 'TRI PUJIASIH',
    divisi: 'Food Products (A-MJK)',
    department: 'Food Production-2 (A-MJK)',
    section: 'Sajiku Production',
    grade: 'ST4',
    jobGrade: 'JG-06',
    jabatan: 'Line Leader Sajiku Production',
    gender: 'P',
    tanggalPensiun: '21 Agu 2044',
    pic: 'Tri Pujiasih',
    skillIndices: [9, 10, 11]
  },
  {
    empId: '119809055',
    empName: 'BAMBANG SUPRAPTO',
    divisi: 'Food Products (A-MJK)',
    department: 'Food Production-2 (A-MJK)',
    section: 'Sajiku Packaging',
    grade: 'ST3',
    jobGrade: 'JG-05',
    jabatan: 'Foreman Sajiku Packaging',
    gender: 'L',
    tanggalPensiun: '16 Jun 2043',
    pic: 'Tri Pujiasih',
    skillIndices: [9, 10]
  },
  {
    empId: '120102041',
    empName: 'EKO PRASETYO',
    divisi: 'Utility & Energy (A-MJK)',
    department: 'Utility (A-MJK) Department',
    section: 'Boiler & Steam Section',
    grade: 'ST3',
    jobGrade: 'JG-05',
    jabatan: 'Foreman Boiler & Steam',
    gender: 'L',
    tanggalPensiun: '29 Nov 2048',
    pic: 'Eko Prasetyo',
    skillIndices: [24, 25]
  },
  {
    empId: '119903088',
    empName: 'SUGIANTO',
    divisi: 'Engineering & Maintenance (A-MJK)',
    department: 'E&M-1 (A-MJK) Department',
    section: 'Mechanical Maintenance',
    grade: 'ST4',
    jobGrade: 'JG-06',
    jabatan: 'Line Leader Maintenance Line A',
    gender: 'L',
    tanggalPensiun: '14 Okt 2046',
    pic: 'Sugianto',
    skillIndices: [21, 22, 23]
  },
  {
    empId: '120207019',
    empName: 'AHMAD SYAMSUDIN',
    divisi: 'Engineering & Maintenance (A-MJK)',
    department: 'E&M-2 (A-MJK) Department',
    section: 'Electrical & Automation',
    grade: 'ST3',
    jobGrade: 'JG-05',
    jabatan: 'Foreman Electrical & PLC',
    gender: 'L',
    tanggalPensiun: '08 Mar 2050',
    pic: 'Sugianto',
    skillIndices: [23, 24]
  },
  {
    empId: '119806034',
    empName: 'DIDIK KURNIAWAN',
    divisi: 'Quality Assurance (A-MJK)',
    department: 'QA (A-MJK) Department',
    section: 'QC Physical & Chemical',
    grade: 'ST4',
    jobGrade: 'JG-06',
    jabatan: 'Line Leader Quality Control',
    gender: 'L',
    tanggalPensiun: '25 Jul 2045',
    pic: 'Didik Kurniawan',
    skillIndices: [40, 41]
  },
  {
    empId: '120305082',
    empName: 'WAHYU TRIONO',
    divisi: 'PPIC (A-MJK)',
    department: 'PPIC (A-MJK) Department',
    section: 'Raw Material Warehouse',
    grade: 'ST3',
    jobGrade: 'JG-05',
    jabatan: 'Foreman Gudang Bahan Baku',
    gender: 'L',
    tanggalPensiun: '19 Des 2049',
    pic: 'Wahyu Triono',
    skillIndices: [14, 15]
  },
  {
    empId: '122108091',
    empName: 'MAHMUD NURDIANSYAH',
    divisi: 'Human Resources (A-MJK)',
    department: 'HR Development (A-MJK) Department',
    section: 'Multi-Skill & Competency Development',
    grade: 'M3',
    jobGrade: 'JG-10',
    jabatan: 'HR Development Specialist & Admin',
    gender: 'L',
    tanggalPensiun: '18 Mei 2055',
    pic: 'Mahmud Nurdiansyah',
    skillIndices: [31, 32, 33]
  }
];

export function generateInitialEmployees(): Employee[] {
  const employees: Employee[] = [];
  let rowIdx = 7;
  let noCounter = 1;

  // Periods: 2026 month 8 (Current Active), 2026 month 7, 2025 month 12
  const periods = [
    { tahun: 2026, bulan: 8 },
    { tahun: 2026, bulan: 7 },
    { tahun: 2025, bulan: 12 }
  ];

  periods.forEach((period) => {
    rawEmployeeTemplates.forEach((tpl) => {
      const skillsRecord: Record<string, boolean> = {};
      
      // Initialize all skill codes as false
      INITIAL_SKILL_META.forEach((sm) => {
        skillsRecord[sm.code] = false;
      });

      // Turn on indicated skill codes
      tpl.skillIndices.forEach((idx) => {
        if (INITIAL_SKILL_META[idx]) {
          // In previous periods, simulate slightly fewer skills for realistic progression
          if (period.tahun === 2025 && idx % 3 === 0) {
            skillsRecord[INITIAL_SKILL_META[idx].code] = false;
          } else {
            skillsRecord[INITIAL_SKILL_META[idx].code] = true;
          }
        }
      });

      const calc = calculateEmployeeScore(skillsRecord, tpl.jabatan);

      employees.push({
        rowIndex: rowIdx++,
        no: noCounter++,
        empId: tpl.empId,
        empName: tpl.empName,
        divisi: tpl.divisi,
        department: tpl.department,
        section: tpl.section,
        grade: tpl.grade,
        jobGrade: tpl.jobGrade,
        jabatan: tpl.jabatan,
        gender: tpl.gender,
        tanggalPensiun: tpl.tanggalPensiun,
        pic: tpl.pic,
        tahun: period.tahun,
        bulan: period.bulan,
        jobCategory: calc.jobCategory,
        totalScore: calc.totalScore,
        standard: calc.standard,
        result: calc.result,
        gap: calc.gap,
        skills: skillsRecord
      });
    });
  });

  return employees;
}
