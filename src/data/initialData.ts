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
    empId: 'AJN-MJK-0101',
    empName: 'Ahmad Fadhil Kurniawan',
    divisi: 'Produksi MSG & Seasoning',
    department: 'Fermentation Department',
    section: 'Inoculum & Media Section',
    grade: 'M4',
    jobGrade: 'JG-11',
    jabatan: 'Department Manager Fermentation',
    gender: 'L',
    tanggalPensiun: '14 Nov 2038',
    pic: 'Rudi Hartono',
    skillIndices: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 40, 48, 56, 88, 89]
  },
  {
    empId: 'AJN-MJK-0102',
    empName: 'Siti Nurhaliza Rahayu',
    divisi: 'Produksi MSG & Seasoning',
    department: 'Fermentation Department',
    section: 'Main Fermentor Section',
    grade: 'M2',
    jobGrade: 'JG-09',
    jabatan: 'Section Manager Fermentation',
    gender: 'P',
    tanggalPensiun: '28 Agu 2042',
    pic: 'Ahmad Fadhil',
    skillIndices: [1, 2, 3, 4, 7, 8, 9, 48, 56, 88]
  },
  {
    empId: 'AJN-MJK-0103',
    empName: 'Budi Santoso',
    divisi: 'Produksi MSG & Seasoning',
    department: 'Fermentation Department',
    section: 'Sterile Systems',
    grade: 'ST4',
    jobGrade: 'JG-06',
    jabatan: 'Line Leader Inoculum',
    gender: 'L',
    tanggalPensiun: '10 Mei 2045',
    pic: 'Siti Nurhaliza',
    skillIndices: [0, 1, 2, 4]
  },
  {
    empId: 'AJN-MJK-0104',
    empName: 'Dimas Prasetyo Utomo',
    divisi: 'Produksi MSG & Seasoning',
    department: 'Fermentation Department',
    section: 'Harvesting',
    grade: 'ST3',
    jobGrade: 'JG-05',
    jabatan: 'Foreman Fermentation Line A',
    gender: 'L',
    tanggalPensiun: '22 Des 2049',
    pic: 'Siti Nurhaliza',
    skillIndices: [5, 6]
  },
  {
    empId: 'AJN-MJK-0105',
    empName: 'Eko Wahyudi',
    divisi: 'Produksi MSG & Seasoning',
    department: 'Fermentation Department',
    section: 'Harvesting',
    grade: 'ST2',
    jobGrade: 'JG-04',
    jabatan: 'Foreman Fermentation Line B',
    gender: 'L',
    tanggalPensiun: '18 Jul 2051',
    pic: 'Siti Nurhaliza',
    skillIndices: [5] // US: only 1 skill, needs 2
  },
  {
    empId: 'AJN-MJK-0106',
    empName: 'Hendro Kusuma Wardhana',
    divisi: 'Produksi MSG & Seasoning',
    department: 'Refining & Isolation Dept',
    section: 'Neutralization Section',
    grade: 'M3',
    jobGrade: 'JG-10',
    jabatan: 'Associate Manager Refining',
    gender: 'L',
    tanggalPensiun: '05 Okt 2039',
    pic: 'Ahmad Fadhil',
    skillIndices: [10, 11, 12, 13, 14, 15, 16, 56]
  },
  {
    empId: 'AJN-MJK-0107',
    empName: 'Ratna Dewi Kusumaningrum',
    divisi: 'Produksi MSG & Seasoning',
    department: 'Refining & Isolation Dept',
    section: 'Crystallizer Section',
    grade: 'ST4',
    jobGrade: 'JG-06',
    jabatan: 'Line Leader Crystallization',
    gender: 'P',
    tanggalPensiun: '12 Jan 2046',
    pic: 'Hendro Kusuma',
    skillIndices: [15, 16, 17]
  },
  {
    empId: 'AJN-MJK-0108',
    empName: 'Guntur Pamungkas',
    divisi: 'Produksi MSG & Seasoning',
    department: 'Refining & Isolation Dept',
    section: 'Evaporator Line',
    grade: 'ST3',
    jobGrade: 'JG-05',
    jabatan: 'Foreman Evaporator 2',
    gender: 'L',
    tanggalPensiun: '30 Sep 2050',
    pic: 'Hendro Kusuma',
    skillIndices: [15] // US: 1 skill, needs 2
  },
  {
    empId: 'AJN-MJK-0109',
    empName: 'Maya Safitri',
    divisi: 'Produksi MSG & Seasoning',
    department: 'Seasoning Blending Dept',
    section: 'Powder Blending Section',
    grade: 'M2',
    jobGrade: 'JG-09',
    jabatan: 'Section Manager Seasoning Plant',
    gender: 'P',
    tanggalPensiun: '19 Mar 2043',
    pic: 'Ahmad Fadhil',
    skillIndices: [20, 21, 22, 23, 24, 25, 26, 27]
  },
  {
    empId: 'AJN-MJK-0110',
    empName: 'Agus Triono',
    divisi: 'Produksi MSG & Seasoning',
    department: 'Seasoning Blending Dept',
    section: 'Flavor Extract Section',
    grade: 'ST4',
    jobGrade: 'JG-06',
    jabatan: 'Line Leader Granulation',
    gender: 'L',
    tanggalPensiun: '08 Feb 2044',
    pic: 'Maya Safitri',
    skillIndices: [20, 25, 26, 27]
  },
  {
    empId: 'AJN-MJK-0111',
    empName: 'Dian Permata Sari',
    divisi: 'Produksi MSG & Seasoning',
    department: 'Packaging Department',
    section: 'VFFS High Speed Line',
    grade: 'M3',
    jobGrade: 'JG-10',
    jabatan: 'Section Manager Packaging',
    gender: 'P',
    tanggalPensiun: '15 Jun 2041',
    pic: 'Rudi Hartono',
    skillIndices: [30, 31, 32, 33, 34, 35, 36, 37, 56]
  },
  {
    empId: 'AJN-MJK-0112',
    empName: 'Fajar Nugroho',
    divisi: 'Produksi MSG & Seasoning',
    department: 'Packaging Department',
    section: 'Retail Packaging Line A',
    grade: 'ST4',
    jobGrade: 'JG-06',
    jabatan: 'Line Leader Packaging Sachet',
    gender: 'L',
    tanggalPensiun: '03 Nov 2048',
    pic: 'Dian Permata',
    skillIndices: [30, 31, 32, 35]
  },
  {
    empId: 'AJN-MJK-0113',
    empName: 'Aris Setiawan',
    divisi: 'Produksi MSG & Seasoning',
    department: 'Packaging Department',
    section: 'Cartoning & Palletizing',
    grade: 'ST3',
    jobGrade: 'JG-05',
    jabatan: 'Foreman Robotic Palletizer',
    gender: 'L',
    tanggalPensiun: '25 Apr 2052',
    pic: 'Dian Permata',
    skillIndices: [33, 34]
  },
  {
    empId: 'AJN-MJK-0114',
    empName: 'Wahyu Hidayat',
    divisi: 'Engineering & Utilities',
    department: 'Maintenance & TPM Dept',
    section: 'Mechanical Maintenance',
    grade: 'M4',
    jobGrade: 'JG-11',
    jabatan: 'Department Manager Engineering',
    gender: 'L',
    tanggalPensiun: '11 Des 2037',
    pic: 'Ir. Bambang',
    skillIndices: [40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 90, 91]
  },
  {
    empId: 'AJN-MJK-0115',
    empName: 'Rian Firmansyah',
    divisi: 'Engineering & Utilities',
    department: 'Maintenance & TPM Dept',
    section: 'Automation & PLC Section',
    grade: 'M2',
    jobGrade: 'JG-09',
    jabatan: 'Associate Manager Automation',
    gender: 'L',
    tanggalPensiun: '09 Agu 2043',
    pic: 'Wahyu Hidayat',
    skillIndices: [42, 43, 44, 45, 90, 91]
  },
  {
    empId: 'AJN-MJK-0116',
    empName: 'Taufik Hidayatullah',
    divisi: 'Engineering & Utilities',
    department: 'Maintenance & TPM Dept',
    section: 'Electrical & Instrumentation',
    grade: 'ST4',
    jobGrade: 'JG-06',
    jabatan: 'Line Leader Electrical',
    gender: 'L',
    tanggalPensiun: '17 Mei 2047',
    pic: 'Rian Firmansyah',
    skillIndices: [42, 43, 45]
  },
  {
    empId: 'AJN-MJK-0117',
    empName: 'Bayu Anggoro',
    divisi: 'Engineering & Utilities',
    department: 'Utilities & Power Plant',
    section: 'Boiler & Steam Generation',
    grade: 'M2',
    jobGrade: 'JG-09',
    jabatan: 'Section Manager Utilities Plant',
    gender: 'L',
    tanggalPensiun: '29 Jan 2040',
    pic: 'Wahyu Hidayat',
    skillIndices: [38, 39, 40, 41, 42, 43, 62, 63]
  },
  {
    empId: 'AJN-MJK-0118',
    empName: 'Nanang Suherman',
    divisi: 'Engineering & Utilities',
    department: 'Utilities & Power Plant',
    section: 'Boiler Station',
    grade: 'ST3',
    jobGrade: 'JG-05',
    jabatan: 'Foreman Boiler 50T/H',
    gender: 'L',
    tanggalPensiun: '14 Sep 2046',
    pic: 'Bayu Anggoro',
    skillIndices: [38] // US: only 1 skill, needs 2
  },
  {
    empId: 'AJN-MJK-0119',
    empName: 'Dra. Endang Sulistyowati',
    divisi: 'Quality & Technical',
    department: 'Quality Assurance Dept',
    section: 'Food Safety & Regulatory',
    grade: 'M4',
    jobGrade: 'JG-11',
    jabatan: 'Department Manager QA/QC',
    gender: 'P',
    tanggalPensiun: '21 Jun 2036',
    pic: 'Ir. Bambang',
    skillIndices: [54, 55, 56, 57, 58, 59, 60, 61, 80]
  },
  {
    empId: 'AJN-MJK-0120',
    empName: 'Lina Marlina',
    divisi: 'Quality & Technical',
    department: 'Quality Control Dept',
    section: 'Chemical Laboratory',
    grade: 'M2',
    jobGrade: 'JG-09',
    jabatan: 'Section Manager QC Lab',
    gender: 'P',
    tanggalPensiun: '04 Mar 2042',
    pic: 'Dra. Endang',
    skillIndices: [54, 55, 56, 57]
  },
  {
    empId: 'AJN-MJK-0121',
    empName: 'Indah Puspitasari',
    divisi: 'Quality & Technical',
    department: 'Quality Control Dept',
    section: 'Microbiology Laboratory',
    grade: 'ST4',
    jobGrade: 'JG-06',
    jabatan: 'Line Leader Microbiological Assay',
    gender: 'P',
    tanggalPensiun: '30 Jul 2048',
    pic: 'Lina Marlina',
    skillIndices: [55, 57, 60]
  },
  {
    empId: 'AJN-MJK-0122',
    empName: 'Reza Pahlevi',
    divisi: 'Quality & Technical',
    department: 'EHS & Environment Dept',
    section: 'WWTP & Waste Management',
    grade: 'M3',
    jobGrade: 'JG-10',
    jabatan: 'Associate Manager EHS',
    gender: 'L',
    tanggalPensiun: '18 Nov 2041',
    pic: 'Dra. Endang',
    skillIndices: [62, 63, 64, 65, 66, 67]
  },
  {
    empId: 'AJN-MJK-0123',
    empName: 'Surya Dharmawan',
    divisi: 'Quality & Technical',
    department: 'EHS & Environment Dept',
    section: 'Safety & K3 Inspection',
    grade: 'ST3',
    jobGrade: 'JG-05',
    jabatan: 'Foreman K3 Fire & Safety',
    gender: 'L',
    tanggalPensiun: '07 Feb 2051',
    pic: 'Reza Pahlevi',
    skillIndices: [65, 66, 67]
  },
  {
    empId: 'AJN-MJK-0124',
    empName: 'Tri Haryanto',
    divisi: 'Supply Chain Management',
    department: 'Warehouse & Logistics',
    section: 'ASRS & Finished Goods',
    grade: 'M3',
    jobGrade: 'JG-10',
    jabatan: 'Section Manager Logistics',
    gender: 'L',
    tanggalPensiun: '13 Okt 2040',
    pic: 'Ir. Bambang',
    skillIndices: [68, 69, 70, 71, 72, 73]
  },
  {
    empId: 'AJN-MJK-0125',
    empName: 'Danang Wicaksono',
    divisi: 'Supply Chain Management',
    department: 'Warehouse & Logistics',
    section: 'Raw Material Receiving',
    grade: 'ST4',
    jobGrade: 'JG-06',
    jabatan: 'Line Leader ASRS Inventory',
    gender: 'L',
    tanggalPensiun: '26 Mei 2047',
    pic: 'Tri Haryanto',
    skillIndices: [69, 70, 72]
  },
  {
    empId: 'AJN-MJK-0126',
    empName: 'Mahmud Nurdiansyah',
    divisi: 'HR & General Affairs',
    department: 'HR Development Dept',
    section: 'Technical Competency & Training',
    grade: 'M3',
    jobGrade: 'JG-10',
    jabatan: 'Section Manager HR Development',
    gender: 'L',
    tanggalPensiun: '19 Des 2045',
    pic: 'Admin HRD',
    skillIndices: [74, 75, 76, 77, 78, 88, 89]
  },
  {
    empId: 'AJN-MJK-0127',
    empName: 'Nurul Hidayati',
    divisi: 'HR & General Affairs',
    department: 'HR Development Dept',
    section: 'Skill Dojo & Evaluation',
    grade: 'ST4',
    jobGrade: 'JG-06',
    jabatan: 'Line Leader Training Dojo',
    gender: 'P',
    tanggalPensiun: '15 Apr 2049',
    pic: 'Mahmud Nurdiansyah',
    skillIndices: [74, 75, 78]
  },
  {
    empId: 'AJN-MJK-0128',
    empName: 'Bagus Prakoso',
    divisi: 'HR & General Affairs',
    department: 'General Affairs Dept',
    section: 'Facility & Security',
    grade: 'ST3',
    jobGrade: 'JG-05',
    jabatan: 'Foreman Factory Security',
    gender: 'L',
    tanggalPensiun: '02 Sep 2048',
    pic: 'Admin HRD',
    skillIndices: [79, 80]
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
