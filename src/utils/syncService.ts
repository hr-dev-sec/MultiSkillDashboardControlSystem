import { Employee, SkillMeta, UserAccount, UserScopeType } from '../types';
import { INITIAL_SKILL_META, calculateEmployeeScore, BULAN_LABELS } from '../data/initialData';
import { saveStoredEmployees } from './storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  tableName: string;
}

export interface ImportPreview {
  totalRows: number;
  newRows: number;
  updateRows: number;
  sampleRows: Partial<Employee>[];
  detectedColumns: string[];
  periods: string[];
  parsedEmployees: Employee[];
}

export interface SyncResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  users?: UserAccount[];
  count?: number;
  preview?: ImportPreview;
  errors?: string[];
  syncedBatches?: number;
  totalBatches?: number;
}

export interface SchemaFieldDoc {
  column: string;
  type: string;
  description: string;
  sheetSource: string;
  sample: string;
}

const SUPABASE_CONFIG_KEY = 'msm_supabase_config_v1';

// Default Supabase Config (with automatic fallback to Vite Environment Variables)
export function getSupabaseConfig(): SupabaseConfig {
  let savedConfig: Partial<SupabaseConfig> = {};
  try {
    const raw = localStorage.getItem(SUPABASE_CONFIG_KEY);
    if (raw) savedConfig = JSON.parse(raw);
  } catch (_) {}

  // Fallback to VITE_ environment variables if available
  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';
  const envTable = (import.meta as any).env?.VITE_SUPABASE_TABLE || 'employees_multi_skill';

  return {
    url: savedConfig.url || envUrl || '',
    anonKey: savedConfig.anonKey || envKey || '',
    tableName: savedConfig.tableName || envTable || 'employees_multi_skill'
  };
}

export function saveSupabaseConfig(config: SupabaseConfig): void {
  try {
    cachedClient = null;
    cachedClientUrl = '';
    cachedClientKey = '';
    localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify(config));

    // Also persist Supabase configuration to centralized server database
    // so any browser, incognito window, or new device automatically connects
    fetch('/api/system/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supabaseConfig: {
          url: config.url,
          anonKey: config.anonKey,
          tableName: config.tableName || 'employees_multi_skill'
        }
      })
    }).catch((err) => {
      console.warn('Could not persist Supabase config to server:', err);
    });
  } catch (err) {
    console.error('Error saving Supabase config:', err);
  }
}

// Create or get Supabase Client
let cachedClient: SupabaseClient | null = null;
let cachedClientUrl = '';
let cachedClientKey = '';

export function getSupabaseClient(config: SupabaseConfig): SupabaseClient | null {
  if (!config.url || !config.anonKey) return null;
  const cleanUrl = config.url.trim().replace(/\/+$/, '');
  const cleanKey = config.anonKey.trim();

  if (cachedClient && cachedClientUrl === cleanUrl && cachedClientKey === cleanKey) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(cleanUrl, cleanKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    cachedClientUrl = cleanUrl;
    cachedClientKey = cleanKey;
    return cachedClient;
  } catch (err) {
    console.error('Failed to create Supabase client:', err);
    return null;
  }
}

export const DEFAULT_GOOGLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1FJTXnDq4bVTFfxcpCyML5GGh4qeiZjMfV0OmzGY56yI/edit?gid=2036340139#gid=2036340139';
const GOOGLE_SHEET_URL_KEY = 'msm_googlesheet_url_v1';

export function getSavedGoogleSheetUrl(): string {
  try {
    const saved = localStorage.getItem(GOOGLE_SHEET_URL_KEY);
    if (saved && saved.trim()) return saved.trim();
  } catch (_) {}
  return DEFAULT_GOOGLE_SHEET_URL;
}

export function saveGoogleSheetUrl(url: string): void {
  try {
    localStorage.setItem(GOOGLE_SHEET_URL_KEY, url.trim());
  } catch (err) {
    console.error('Error saving Google Sheet URL:', err);
  }
}

// -------------------------------------------------------------
// Google Sheet Helpers
// -------------------------------------------------------------
export function extractGoogleSheetId(inputUrl: string): { sheetId: string; gid: string } | null {
  if (!inputUrl || !inputUrl.trim()) return null;
  const url = inputUrl.trim();

  // Match /spreadsheets/d/{sheetId} with optional gid
  const matchId = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!matchId) return null;

  const sheetId = matchId[1];
  const gidMatch = url.match(/[?&#]gid=([0-9]+)/);
  const gid = gidMatch ? gidMatch[1] : '0';

  return { sheetId, gid };
}

export function buildGoogleSheetCsvUrl(inputUrl: string, method: 'gviz' | 'export' = 'gviz'): string {
  const parsed = extractGoogleSheetId(inputUrl);
  if (!parsed) {
    return inputUrl.trim();
  }
  if (method === 'export') {
    return `https://docs.google.com/spreadsheets/d/${parsed.sheetId}/export?format=csv&gid=${parsed.gid}`;
  }
  return `https://docs.google.com/spreadsheets/d/${parsed.sheetId}/gviz/tq?tqx=out:csv&gid=${parsed.gid}`;
}

// Robust CSV Line & Column Parser (handles multiline, quotes, commas, semicolons)
export function parseCsvString(csvText: string): string[][] {
  const cleanText = csvText.replace(/^\uFEFF/, ''); // strip BOM
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let insideQuotes = false;

  // Auto-detect delimiter from first non-empty line: comma or semicolon or tab
  const firstLine = cleanText.split(/\r\n|\n|\r/)[0] || '';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  
  let delimiter = ',';
  if (semicolonCount > commaCount && semicolonCount > tabCount) delimiter = ';';
  else if (tabCount > commaCount && tabCount > semicolonCount) delimiter = '\t';

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentCell += '"';
        i++; // skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') i++; // handle CRLF
      currentRow.push(currentCell.trim());
      currentCell = '';
      if (currentRow.some((c) => c.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentCell += char;
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

// Match header key names with fuzzy aliases
function normalizeHeaderName(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Convert parsed CSV rows into Employee objects
export function parseRowsToEmployees(
  rawRows: string[][],
  currentEmployees: Employee[] = []
): { employees: Employee[]; preview: ImportPreview; errors: string[] } {
  const errors: string[] = [];
  if (!rawRows || rawRows.length === 0) {
    return {
      employees: [],
      preview: {
        totalRows: 0,
        newRows: 0,
        updateRows: 0,
        sampleRows: [],
        detectedColumns: [],
        periods: [],
        parsedEmployees: []
      },
      errors: ['File/sheet kosong atau tidak memiliki baris data.']
    };
  }

  // 1. Dynamic Header Row Finder: Find the row containing core column keywords
  let headerRowIndex = -1;
  for (let r = 0; r < Math.min(rawRows.length, 25); r++) {
    const row = rawRows[r];
    if (!row) continue;
    const rowJoined = row.map((c) => normalizeHeaderName(c)).join(' ');
    if (
      (rowJoined.includes('empid') || rowJoined.includes('idkaryawan') || rowJoined.includes('nip')) &&
      (rowJoined.includes('empname') || rowJoined.includes('namakaryawan') || rowJoined.includes('nama'))
    ) {
      headerRowIndex = r;
      break;
    }
  }

  // Fallback: If no empId/empName keywords found, search for any standard columns
  if (headerRowIndex === -1) {
    for (let r = 0; r < Math.min(rawRows.length, 25); r++) {
      const row = rawRows[r];
      if (!row) continue;
      const nonEmpties = row.filter((c) => c && c.trim().length > 0);
      if (nonEmpties.length >= 5) {
        headerRowIndex = r;
        break;
      }
    }
  }

  if (headerRowIndex === -1) {
    headerRowIndex = 0;
  }

  const headerRow = rawRows[headerRowIndex] || [];
  let candidateDataRows = rawRows.slice(headerRowIndex + 1);

  // Map header index to employee fields
  const colMap: Record<string, number> = {};
  const skillColMap: Record<string, number> = {};

  headerRow.forEach((col, idx) => {
    const rawCol = col.trim();
    if (!rawCol) return;
    const norm = normalizeHeaderName(rawCol);

    if (['empid', 'idkaryawan', 'employeeid', 'nip', 'nik', 'id'].includes(norm)) {
      colMap['empId'] = idx;
    } else if (['empname', 'namakaryawan', 'nama', 'name', 'employeename', 'namalengkap'].includes(norm)) {
      colMap['empName'] = idx;
    } else if (['divisi', 'division', 'div'].includes(norm)) {
      colMap['divisi'] = idx;
    } else if (['department', 'departemen', 'dept'].includes(norm)) {
      colMap['department'] = idx;
    } else if (['section', 'seksi', 'bagian'].includes(norm)) {
      colMap['section'] = idx;
    } else if (['grade', 'golongan'].includes(norm)) {
      colMap['grade'] = idx;
    } else if (['jobgrade', 'jg'].includes(norm)) {
      colMap['jobGrade'] = idx;
    } else if (['jabatan', 'position', 'jobtitle', 'title', 'posisi'].includes(norm)) {
      colMap['jabatan'] = idx;
    } else if (['gender', 'jeniskelamin', 'sex', 'lp'].includes(norm)) {
      colMap['gender'] = idx;
    } else if (['tanggalpensiun', 'tglpensiun', 'pensiun', 'retirementdate'].includes(norm)) {
      colMap['tanggalPensiun'] = idx;
    } else if (['pic', 'atasan', 'supervisor'].includes(norm)) {
      colMap['pic'] = idx;
    } else if (['tahun', 'year', 'periodetahun'].includes(norm)) {
      colMap['tahun'] = idx;
    } else if (['bulan', 'month', 'periodebulan'].includes(norm)) {
      colMap['bulan'] = idx;
    } else if (['standard', 'standar', 'target', 'threshold'].includes(norm)) {
      colMap['standard'] = idx;
    } else if (['total', 'totalscore', 'score', 'skor'].includes(norm)) {
      colMap['total'] = idx;
    } else if (['result', 'hasil', 'status', 'msus'].includes(norm)) {
      colMap['result'] = idx;
    } else if (['gap', 'selisih'].includes(norm)) {
      colMap['gap'] = idx;
    } else if (['no', 'nomor'].includes(norm)) {
      colMap['no'] = idx;
    }

    // Check if this header matches any skill code
    INITIAL_SKILL_META.forEach((sm) => {
      const smCodeNorm = normalizeHeaderName(sm.code);
      if (
        norm === smCodeNorm ||
        rawCol.toUpperCase() === sm.code.toUpperCase() ||
        rawCol.toLowerCase() === sm.code.toLowerCase() ||
        rawCol.replace(/\s+/g, '') === sm.code.replace(/\s+/g, '')
      ) {
        skillColMap[sm.code] = idx;
      }
    });
  });

  // Fallback for missing empId or empName index
  if (colMap['empId'] === undefined) {
    for (let i = 0; i < headerRow.length; i++) {
      const norm = normalizeHeaderName(headerRow[i]);
      if (norm.includes('id') || norm.includes('emp')) {
        colMap['empId'] = i;
        break;
      }
    }
  }

  // 2. Filter out sub-header row (e.g., skill descriptions like "Decalfication & SACC Process MSG...")
  if (candidateDataRows.length > 0) {
    const firstRow = candidateDataRows[0];
    const firstIdVal = colMap['empId'] !== undefined ? firstRow[colMap['empId']]?.trim() : '';
    const firstRowJoined = firstRow.join(' ').toLowerCase();

    if (
      (!firstIdVal || isNaN(Number(firstIdVal))) &&
      (firstRowJoined.includes('process') ||
        firstRowJoined.includes('decalfication') ||
        firstRowJoined.includes('fermentation') ||
        firstRowJoined.includes('packaging') ||
        firstRowJoined.includes('warehouse') ||
        firstRowJoined.includes('management') ||
        firstRowJoined.includes('maintenance'))
    ) {
      // It's a subheader description row -> skip it
      candidateDataRows = candidateDataRows.slice(1);
    }
  }

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  let maxRowIndex = currentEmployees.reduce((m, e) => Math.max(m, e.rowIndex || 0), 6);
  let maxNo = currentEmployees.reduce((m, e) => Math.max(m, e.no || 0), 0);

  const parsedEmployees: Employee[] = [];
  const periodsSet = new Set<string>();

  candidateDataRows.forEach((row, rIdx) => {
    // Skip empty lines
    if (!row || row.every((c) => !c || c.trim() === '')) return;

    const rawEmpId = (colMap['empId'] !== undefined ? row[colMap['empId']] : '')?.trim();
    const rawEmpName = (colMap['empName'] !== undefined ? row[colMap['empName']] : '')?.trim();

    // Skip if row has no ID and no Name
    if (!rawEmpId && !rawEmpName) return;

    const empId = rawEmpId || `EMP-${rIdx + 1}`;
    const empName = rawEmpName || `Karyawan ${rIdx + 1}`;
    const divisi = (colMap['divisi'] !== undefined ? row[colMap['divisi']] : '')?.trim() || '';
    const department = (colMap['department'] !== undefined ? row[colMap['department']] : '')?.trim() || '';
    const section = (colMap['section'] !== undefined ? row[colMap['section']] : '')?.trim() || '';
    const grade = (colMap['grade'] !== undefined ? row[colMap['grade']] : '')?.trim() || '';
    const jobGrade = (colMap['jobGrade'] !== undefined ? row[colMap['jobGrade']] : '')?.trim() || '';
    const jabatan = (colMap['jabatan'] !== undefined ? row[colMap['jabatan']] : '')?.trim() || '';

    let gender = (colMap['gender'] !== undefined ? row[colMap['gender']] : 'L')?.trim().toUpperCase() || 'L';
    if (gender.startsWith('P') || gender.startsWith('W') || gender === 'FEMALE') gender = 'P';
    else gender = 'L';

    const tanggalPensiun = (colMap['tanggalPensiun'] !== undefined ? row[colMap['tanggalPensiun']] : '')?.trim();
    const pic = (colMap['pic'] !== undefined ? row[colMap['pic']] : '')?.trim();

    // Parse Tahun & Bulan
    let tahun = currentYear;
    if (colMap['tahun'] !== undefined && row[colMap['tahun']]) {
      const parsedTahun = parseInt(row[colMap['tahun']].trim(), 10);
      if (!isNaN(parsedTahun) && parsedTahun >= 2000 && parsedTahun <= 2100) {
        tahun = parsedTahun;
      }
    }

    let bulan = currentMonth;
    if (colMap['bulan'] !== undefined && row[colMap['bulan']]) {
      const val = row[colMap['bulan']].trim();
      const parsedBulan = parseInt(val, 10);
      if (!isNaN(parsedBulan) && parsedBulan >= 1 && parsedBulan <= 12) {
        bulan = parsedBulan;
      } else {
        const foundIdx = BULAN_LABELS.findIndex((b) => b.toLowerCase().startsWith(val.toLowerCase().slice(0, 3)));
        if (foundIdx !== -1) bulan = foundIdx + 1;
      }
    }

    periodsSet.add(`${BULAN_LABELS[bulan - 1] || bulan} ${tahun}`);

    // Parse Skills Matrix
    const skills: Record<string, boolean> = {};
    let checkedSkillsCount = 0;

    INITIAL_SKILL_META.forEach((sm) => {
      skills[sm.code] = false;
      const colIdx = skillColMap[sm.code];
      if (colIdx !== undefined && row[colIdx] !== undefined) {
        const val = row[colIdx].trim().toLowerCase();
        if (['1', 'true', 'v', 'x', 'ya', 'yes', 'ok', 'ms', '✓', '✔'].includes(val)) {
          skills[sm.code] = true;
          checkedSkillsCount++;
        }
      }
    });

    // Custom standard if provided in sheet
    let customStandard: number | null = null;
    if (colMap['standard'] !== undefined && row[colMap['standard']]) {
      const parsedStd = parseInt(row[colMap['standard']].trim(), 10);
      if (!isNaN(parsedStd) && parsedStd > 0) customStandard = parsedStd;
    }

    // Sheet Total fallback if skill columns were unaligned
    if (checkedSkillsCount === 0 && colMap['total'] !== undefined && row[colMap['total']]) {
      const sheetTotal = parseInt(row[colMap['total']].trim(), 10);
      if (!isNaN(sheetTotal) && sheetTotal > 0) {
        // Assign first N skills to simulate total count for visualization
        for (let s = 0; s < Math.min(sheetTotal, INITIAL_SKILL_META.length); s++) {
          skills[INITIAL_SKILL_META[s].code] = true;
        }
      }
    }

    const calc = calculateEmployeeScore(skills, jabatan, customStandard);

    parsedEmployees.push({
      rowIndex: ++maxRowIndex,
      no: ++maxNo,
      empId,
      empName,
      divisi,
      department,
      section,
      grade,
      jobGrade,
      jabatan,
      gender,
      tanggalPensiun,
      pic,
      tahun,
      bulan,
      jobCategory: calc.jobCategory,
      totalScore: calc.totalScore,
      standard: calc.standard,
      result: calc.result,
      gap: calc.gap,
      skills
    });
  });

  // Calculate merge / update stats
  let updateRows = 0;
  let newRows = 0;

  parsedEmployees.forEach((emp) => {
    const isExisting = currentEmployees.some(
      (e) =>
        e.empId.trim().toLowerCase() === emp.empId.trim().toLowerCase() &&
        Number(e.tahun) === Number(emp.tahun) &&
        Number(e.bulan) === Number(emp.bulan)
    );
    if (isExisting) updateRows++;
    else newRows++;
  });

  const preview: ImportPreview = {
    totalRows: parsedEmployees.length,
    newRows,
    updateRows,
    sampleRows: parsedEmployees.slice(0, 8),
    detectedColumns: headerRow.map((h) => h.trim()).filter(Boolean),
    periods: Array.from(periodsSet),
    parsedEmployees
  };

  return { employees: parsedEmployees, preview, errors };
}

// -------------------------------------------------------------
// Merge / Apply Data Strategy
// -------------------------------------------------------------
export function mergeEmployeesData(
  currentEmployees: Employee[],
  incomingEmployees: Employee[],
  mode: 'merge' | 'replace' | 'append'
): { updatedEmployees: Employee[]; addedCount: number; updatedCount: number } {
  if (mode === 'replace') {
    let rowIdx = 7;
    let noCounter = 1;
    const reindexed = incomingEmployees.map((e) => ({
      ...e,
      rowIndex: rowIdx++,
      no: noCounter++
    }));
    saveStoredEmployees(reindexed);
    return { updatedEmployees: reindexed, addedCount: incomingEmployees.length, updatedCount: 0 };
  }

  let addedCount = 0;
  let updatedCount = 0;

  if (mode === 'append') {
    let nextRowIndex = currentEmployees.reduce((max, e) => Math.max(max, e.rowIndex || 0), 6) + 1;
    let nextNo = currentEmployees.reduce((max, e) => Math.max(max, e.no || 0), 0) + 1;

    const toAppend: Employee[] = [];
    incomingEmployees.forEach((inc) => {
      const exists = currentEmployees.some(
        (e) =>
          e.empId.trim().toLowerCase() === inc.empId.trim().toLowerCase() &&
          Number(e.tahun) === Number(inc.tahun) &&
          Number(e.bulan) === Number(inc.bulan)
      );
      if (!exists) {
        toAppend.push({
          ...inc,
          rowIndex: nextRowIndex++,
          no: nextNo++
        });
        addedCount++;
      }
    });

    const updatedEmployees = [...currentEmployees, ...toAppend];
    saveStoredEmployees(updatedEmployees);
    return { updatedEmployees, addedCount, updatedCount };
  }

  // mode === 'merge' (Update existing, append new)
  const mapKey = (e: Employee) => `${e.empId.trim().toLowerCase()}_${e.tahun}_${e.bulan}`;
  const incomingMap = new Map<string, Employee>();
  incomingEmployees.forEach((inc) => incomingMap.set(mapKey(inc), inc));

  let nextRowIndex = currentEmployees.reduce((max, e) => Math.max(max, e.rowIndex || 0), 6) + 1;
  let nextNo = currentEmployees.reduce((max, e) => Math.max(max, e.no || 0), 0) + 1;

  const merged: Employee[] = [];
  const processedKeys = new Set<string>();

  // 1. Process current employees (update if matched, keep if not)
  currentEmployees.forEach((cur) => {
    const key = mapKey(cur);
    if (incomingMap.has(key)) {
      const incoming = incomingMap.get(key)!;
      merged.push({
        ...incoming,
        rowIndex: cur.rowIndex,
        no: cur.no
      });
      processedKeys.add(key);
      updatedCount++;
    } else {
      merged.push(cur);
    }
  });

  // 2. Append new employees that were not in current database
  incomingEmployees.forEach((inc) => {
    const key = mapKey(inc);
    if (!processedKeys.has(key)) {
      merged.push({
        ...inc,
        rowIndex: nextRowIndex++,
        no: nextNo++
      });
      addedCount++;
    }
  });

  saveStoredEmployees(merged);
  return { updatedEmployees: merged, addedCount, updatedCount };
}

// -------------------------------------------------------------
// Fetch Data from Google Sheet
// -------------------------------------------------------------
export async function fetchGoogleSheetData(
  sheetUrl: string,
  currentEmployees: Employee[] = []
): Promise<SyncResponse<Employee[]>> {
  try {
    if (!sheetUrl || !sheetUrl.trim()) {
      return {
        success: false,
        message: 'URL Google Sheet belum diisi.'
      };
    }

    saveGoogleSheetUrl(sheetUrl);

    let csvText = '';
    let lastError = '';

    // Attempt 1: GViz endpoint
    const gvizUrl = buildGoogleSheetCsvUrl(sheetUrl, 'gviz');
    try {
      const res1 = await fetch(gvizUrl);
      if (res1.ok) {
        const text = await res1.text();
        if (text && !text.includes('<!DOCTYPE html>') && !text.includes('<html') && !text.includes('Sign in to your Google Account')) {
          csvText = text;
        } else if (text.includes('Sign in to your Google Account') || text.includes('request-storage-access') || text.includes('show-login-page')) {
          lastError = 'Akses Google Sheet saat ini masih dibatasi (Private/Perlu Login Google).';
        }
      }
    } catch (e: any) {
      lastError = e?.message || 'Gagal koneksi GViz';
    }

    // Attempt 2: Export format=csv endpoint (if attempt 1 did not yield csv)
    if (!csvText) {
      const exportUrl = buildGoogleSheetCsvUrl(sheetUrl, 'export');
      try {
        const res2 = await fetch(exportUrl);
        if (res2.ok) {
          const text = await res2.text();
          if (text && !text.includes('<!DOCTYPE html>') && !text.includes('<html') && !text.includes('Sign in to your Google Account')) {
            csvText = text;
          } else if (text.includes('Sign in to your Google Account') || text.includes('request-storage-access') || text.includes('show-login-page')) {
            lastError = 'Akses Google Sheet saat ini masih dibatasi (Private/Perlu Login Google).';
          }
        }
      } catch (e: any) {
        if (!lastError) lastError = e?.message || 'Gagal koneksi export CSV';
      }
    }

    if (!csvText) {
      if (lastError.includes('dibatasi') || lastError.includes('Private') || lastError.includes('Sign in')) {
        return {
          success: false,
          message: 'Google Sheet memerlukan izin akses publik. Silakan buka spreadsheet di Google Docs, klik tombol "Bagikan" (Share) di kanan atas, lalu ubah akses menjadi "Siapa saja yang memiliki link dapat melihat" (Anyone with the link can view).'
        };
      }
      return {
        success: false,
        message: `Tidak dapat mengunduh data spreadsheet: ${lastError || 'Pastikan link benar dan akses dibuka untuk publik (Anyone with the link can view)'}.`
      };
    }

    const rawRows = parseCsvString(csvText);
    const { employees, preview, errors } = parseRowsToEmployees(rawRows, currentEmployees);

    if (!employees.length) {
      return {
        success: false,
        message: 'Tidak ditemukan baris data karyawan yang valid pada Google Sheet tersebut.',
        errors
      };
    }

    return {
      success: true,
      message: `Berhasil menarik ${employees.length} data karyawan dari Google Sheet.`,
      data: employees,
      count: employees.length,
      preview
    };
  } catch (err: any) {
    console.error('Error fetching Google Sheet:', err);
    return {
      success: false,
      message: `Terjadi kendala koneksi saat mengambil Google Sheet: ${err.message || 'CORS atau Jaringan terputus'}. Pastikan spreadsheet diatur public (Anyone with the link can view).`
    };
  }
}

// -------------------------------------------------------------
// Supabase REST Database Sync
// -------------------------------------------------------------
export async function testSupabaseConnection(config: SupabaseConfig): Promise<{
  success: boolean;
  message: string;
  rowCount?: number;
  columns?: string[];
}> {
  if (!config.url || !config.anonKey) {
    return { success: false, message: 'URL Supabase dan Anon API Key wajib diisi.' };
  }

  const cleanUrl = config.url.trim().replace(/\/+$/, '');
  const tableName = config.tableName.trim() || 'employees_multi_skill';

  try {
    const client = getSupabaseClient(config);
    if (client) {
      const { count, error, data } = await client
        .from(tableName)
        .select('*', { count: 'exact', head: false })
        .limit(1);

      if (error) {
        if (
          error.code === 'PGRST205' ||
          error.code === 'PGRST116' ||
          error.code === '42P01' ||
          error.message?.includes('schema cache') ||
          error.message?.includes('relation') ||
          error.message?.includes('does not exist') ||
          error.message?.includes('Could not find the table')
        ) {
          return {
            success: false,
            message: `Tabel "${tableName}" belum dibuat di project Supabase Anda (PGRST205). Silakan klik tombol "Lihat Script SQL DDL" di atas, salin kodenya, lalu jalankan di menu SQL Editor pada Dashboard Supabase Anda.`
          };
        }
        if (error.message?.includes('JWT') || error.message?.includes('apikey') || error.code === '401' || error.code === '403') {
          return {
            success: false,
            message: `Kredensial API Key tidak valid atau dicegah oleh izin Row Level Security (RLS). Pastikan Anon Key benar dan RLS policy diaktifkan.`
          };
        }
        return {
          success: false,
          message: `Error Supabase (${error.code || 'API'}): ${error.message}`
        };
      }

      const columns = data && data[0] ? Object.keys(data[0]) : [];
      return {
        success: true,
        message: `Koneksi Supabase aktif & terhubung ke tabel "${tableName}"!`,
        rowCount: count ?? (data ? data.length : 0),
        columns
      };
    }

    // Fallback REST API
    const res = await fetch(`${cleanUrl}/rest/v1/${tableName}?select=count`, {
      method: 'GET',
      headers: {
        'apikey': config.anonKey,
        'Authorization': `Bearer ${config.anonKey}`,
        'Range-Unit': 'items',
        'Range': '0-0',
        'Prefer': 'count=exact'
      }
    });

    if (res.ok) {
      const countHeader = res.headers.get('content-range');
      let rowCount = 0;
      if (countHeader) {
        const total = countHeader.split('/')[1];
        if (total) rowCount = parseInt(total, 10) || 0;
      }
      return {
        success: true,
        message: `Koneksi Supabase berhasil! Terhubung ke tabel "${tableName}".`,
        rowCount
      };
    }

    if (res.status === 404 || res.status === 400) {
      return {
        success: false,
        message: `Tabel "${tableName}" belum ada di database Supabase. Silakan jalankan script SQL di tab SQL Editor Supabase.`
      };
    }

    return {
      success: false,
      message: `Koneksi gagal (HTTP ${res.status}: ${res.statusText}). Periksa URL dan API Key Anda.`
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Gagal menghubungi Supabase: ${err.message || 'Koneksi jaringan gagal'}. Pastikan URL berformat https://[project-id].supabase.co`
    };
  }
}

export async function fetchSupabaseEmployees(
  config: SupabaseConfig,
  currentEmployees: Employee[] = []
): Promise<SyncResponse<Employee[]>> {
  const test = await testSupabaseConnection(config);
  if (!test.success) {
    return { success: false, message: test.message };
  }

  const cleanUrl = config.url.trim().replace(/\/+$/, '');
  const tableName = config.tableName.trim() || 'employees_multi_skill';

  try {
    let rows: any[] = [];
    const client = getSupabaseClient(config);

    // Supabase PostgREST default query limit is 1000 rows.
    // We implement chunked pagination to fetch ALL records without truncation.
    const CHUNK_SIZE = 1000;
    let page = 0;
    let keepFetching = true;

    while (keepFetching) {
      const from = page * CHUNK_SIZE;
      const to = from + CHUNK_SIZE - 1;
      let chunkData: any[] = [];

      if (client) {
        const { data, error } = await client
          .from(tableName)
          .select('*')
          .range(from, to);

        if (error) {
          if (page === 0) {
            // Fallback to basic select if range is not supported
            const fallback = await client.from(tableName).select('*');
            if (fallback.error) {
              return { success: false, message: `Gagal mengambil data dari Supabase: ${fallback.error.message}` };
            }
            rows = fallback.data || [];
          }
          break;
        }
        chunkData = data || [];
      } else {
        const res = await fetch(`${cleanUrl}/rest/v1/${tableName}?select=*`, {
          method: 'GET',
          headers: {
            'apikey': config.anonKey,
            'Authorization': `Bearer ${config.anonKey}`,
            'Range-Unit': 'items',
            'Range': `${from}-${to}`
          }
        });

        if (!res.ok) {
          if (page === 0) {
            return {
              success: false,
              message: `Gagal mengambil data dari Supabase (HTTP ${res.status}: ${res.statusText}).`
            };
          }
          break;
        }
        chunkData = await res.json();
      }

      if (Array.isArray(chunkData) && chunkData.length > 0) {
        rows.push(...chunkData);
        if (chunkData.length < CHUNK_SIZE) {
          keepFetching = false;
        } else {
          page++;
        }
      } else {
        keepFetching = false;
      }
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return {
        success: false,
        message: `Tabel Supabase "${tableName}" masih kosong. Anda dapat mengunggah (Push Sync) data saat ini dari Google Sheets atau data lokal ke Supabase.`
      };
    }

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    let maxRowIndex = currentEmployees.reduce((m, e) => Math.max(m, e.rowIndex || 0), 6);
    let maxNo = currentEmployees.reduce((m, e) => Math.max(m, e.no || 0), 0);

    const parsed: Employee[] = [];
    const periodsSet = new Set<string>();

    rows.forEach((r: any, idx: number) => {
      const empId = (r.emp_id || r.empId || r.nip || r.nik || r.id_karyawan || `EMP-${idx + 1}`).toString().trim();
      const empName = (r.emp_name || r.empName || r.nama || r.nama_karyawan || `Karyawan ${idx + 1}`).toString().trim();
      const divisi = (r.divisi || r.division || '').toString().trim();
      const department = (r.department || r.dept || r.departemen || '').toString().trim();
      const section = (r.section || r.seksi || '').toString().trim();
      const grade = (r.grade || '').toString().trim();
      const jobGrade = (r.job_grade || r.jobGrade || r.jg || '').toString().trim();
      const jabatan = (r.jabatan || r.position || r.posisi || '').toString().trim();
      const rawGender = (r.gender || r.jenis_kelamin || r.jk || 'L').toString().toUpperCase().trim();
      const gender = rawGender.startsWith('P') || rawGender.startsWith('F') || rawGender.startsWith('W') ? 'P' : 'L';
      const tanggalPensiun = (r.tanggal_pensiun || r.tanggalPensiun || r.pensiun || '').toString().trim();
      const pic = (r.pic || '').toString().trim();
      const tahun = parseInt(r.tahun || r.year || currentYear, 10);
      const bulan = parseInt(r.bulan || r.month || currentMonth, 10);

      periodsSet.add(`${BULAN_LABELS[bulan - 1] || bulan} ${tahun}`);

      // Parse skills: handle JSONB object, stringified JSON, or individual skill columns
      let skills: Record<string, boolean> = {};
      INITIAL_SKILL_META.forEach((sm) => {
        skills[sm.code] = false;
      });

      let hasParsedSkills = false;
      if (r.skills) {
        let rawSkills = r.skills;
        if (typeof rawSkills === 'string') {
          try {
            rawSkills = JSON.parse(rawSkills);
          } catch (_) {}
        }
        if (typeof rawSkills === 'object' && rawSkills !== null) {
          Object.keys(rawSkills).forEach((k) => {
            if (rawSkills[k] === true || rawSkills[k] === 1 || rawSkills[k] === '1' || rawSkills[k] === 'true' || rawSkills[k] === 'TRUE') {
              skills[k] = true;
              hasParsedSkills = true;
            }
          });
        }
      }

      // Fallback: Check if skills are stored as individual columns on the record (e.g. from direct CSV import to Supabase)
      if (!hasParsedSkills) {
        INITIAL_SKILL_META.forEach((sm) => {
          const val = r[sm.code] ?? r[sm.code.replace('.', '_')] ?? r[`skill_${sm.code}`] ?? r[`skill_${sm.code.replace('.', '_')}`];
          if (val === true || val === 1 || val === '1' || val === 'TRUE' || val === 'true' || val === 'ok' || val === 'OK') {
            skills[sm.code] = true;
          }
        });
      }

      const customStandard = r.standard !== undefined && r.standard !== null && !isNaN(Number(r.standard)) ? Number(r.standard) : null;
      const calc = calculateEmployeeScore(skills, jabatan, customStandard);

      parsed.push({
        rowIndex: ++maxRowIndex,
        no: ++maxNo,
        empId,
        empName,
        divisi,
        department,
        section,
        grade,
        jobGrade,
        jabatan,
        gender,
        tanggalPensiun,
        pic,
        tahun,
        bulan,
        jobCategory: calc.jobCategory,
        totalScore: calc.totalScore,
        standard: calc.standard,
        result: calc.result,
        gap: calc.gap,
        skills
      });
    });

    let updateRows = 0;
    let newRows = 0;
    parsed.forEach((emp) => {
      const isExisting = currentEmployees.some(
        (e) =>
          e.empId.trim().toLowerCase() === emp.empId.trim().toLowerCase() &&
          Number(e.tahun) === Number(emp.tahun) &&
          Number(e.bulan) === Number(emp.bulan)
      );
      if (isExisting) updateRows++;
      else newRows++;
    });

    const preview: ImportPreview = {
      totalRows: parsed.length,
      newRows,
      updateRows,
      sampleRows: parsed.slice(0, 8),
      detectedColumns: Object.keys(rows[0] || {}),
      periods: Array.from(periodsSet),
      parsedEmployees: parsed
    };

    return {
      success: true,
      message: `Berhasil menarik ${parsed.length} data karyawan dari database Supabase.`,
      data: parsed,
      count: parsed.length,
      preview
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Gagal memuat data Supabase: ${err.message || 'Kesalahan jaringan'}`
    };
  }
}

export type SyncProgressCallback = (current: number, total: number, percentage: number, batchInfo?: string) => void;

export async function pushEmployeesToSupabase(
  config: SupabaseConfig,
  employees: Employee[],
  onProgress?: SyncProgressCallback
): Promise<SyncResponse> {
  const test = await testSupabaseConnection(config);
  if (!test.success) {
    return { success: false, message: test.message };
  }

  const tableName = config.tableName.trim() || 'employees_multi_skill';
  const cleanUrl = config.url.trim().replace(/\/+$/, '');

  // Format records for Supabase schema
  const payload = employees.map((e) => ({
    emp_id: e.empId,
    emp_name: e.empName,
    divisi: e.divisi || null,
    department: e.department || null,
    section: e.section || null,
    grade: e.grade || null,
    job_grade: e.jobGrade || null,
    jabatan: e.jabatan || null,
    gender: e.gender || 'L',
    tanggal_pensiun: e.tanggalPensiun || null,
    pic: e.pic || null,
    tahun: e.tahun,
    bulan: e.bulan,
    job_category: e.jobCategory || null,
    total_score: e.totalScore || 0,
    standard: e.standard || null,
    result: e.result || 'US',
    gap: e.gap || 0,
    skills: e.skills || {},
    updated_at: new Date().toISOString()
  }));

  const CHUNK_SIZE = 50;
  const totalRecords = payload.length;
  const totalBatches = Math.ceil(totalRecords / CHUNK_SIZE);
  const client = getSupabaseClient(config);

  try {
    for (let i = 0; i < totalBatches; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, totalRecords);
      const chunk = payload.slice(start, end);

      if (client) {
        // Upsert on conflict (emp_id, tahun, bulan)
        const { error } = await client
          .from(tableName)
          .upsert(chunk, {
            onConflict: 'emp_id,tahun,bulan',
            ignoreDuplicates: false
          });

        if (error) {
          return {
            success: false,
            message: `Gagal mengirim batch ${i + 1}/${totalBatches}: ${error.message}`
          };
        }
      } else {
        // Fallback REST POST with Prefer: resolution=merge-duplicates
        const res = await fetch(`${cleanUrl}/rest/v1/${tableName}`, {
          method: 'POST',
          headers: {
            'apikey': config.anonKey,
            'Authorization': `Bearer ${config.anonKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
          },
          body: JSON.stringify(chunk)
        });

        if (!res.ok && res.status !== 201 && res.status !== 200) {
          const errText = await res.text();
          return {
            success: false,
            message: `Gagal mengirim batch ${i + 1}/${totalBatches} (HTTP ${res.status}): ${errText}`
          };
        }
      }

      const currentCount = end;
      const pct = Math.round((currentCount / totalRecords) * 100);
      if (onProgress) {
        onProgress(currentCount, totalRecords, pct, `Batch ${i + 1}/${totalBatches} (${currentCount}/${totalRecords} data)`);
      }
    }

    return {
      success: true,
      message: `Berhasil mensinkronkan ${employees.length} data karyawan ke tabel Supabase "${tableName}".`,
      count: employees.length,
      syncedBatches: totalBatches,
      totalBatches
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Gagal mengirim data ke Supabase: ${err.message || 'Kesalahan jaringan'}`
    };
  }
}

// Direct Pipeline: Fetch from Google Sheet CSV, parse, and upload straight to Supabase
export async function syncGoogleSheetsDirectToSupabase(
  sheetUrl: string,
  config: SupabaseConfig,
  currentEmployees: Employee[] = [],
  onProgress?: SyncProgressCallback
): Promise<SyncResponse<Employee[]>> {
  // 1. Fetch from Google Sheet
  const sheetResult = await fetchGoogleSheetData(sheetUrl, currentEmployees);
  if (!sheetResult.success || !sheetResult.data || !sheetResult.data.length) {
    return {
      success: false,
      message: `Gagal menarik data dari Google Sheets: ${sheetResult.message}`
    };
  }

  const fetchedEmployees = sheetResult.data;

  // 2. Push to Supabase with progress
  const pushResult = await pushEmployeesToSupabase(config, fetchedEmployees, onProgress);
  if (!pushResult.success) {
    return {
      success: false,
      message: `Data berhasil ditarik dari Google Sheets (${fetchedEmployees.length} baris), namun gagal diunggah ke Supabase: ${pushResult.message}`
    };
  }

  return {
    success: true,
    message: `Sukses sinkronisasi langsung! ${fetchedEmployees.length} data karyawan dari Google Sheets berhasil disimpan ke tabel Supabase "${config.tableName}".`,
    data: fetchedEmployees,
    count: fetchedEmployees.length,
    preview: sheetResult.preview
  };
}

// -------------------------------------------------------------
// Schema Dictionary / Documentation for Easy Understanding
// -------------------------------------------------------------
export function getSupabaseSchemaDictionary(): SchemaFieldDoc[] {
  return [
    {
      column: 'emp_id',
      type: 'VARCHAR(50) NOT NULL',
      description: 'Nomor Induk Karyawan / ID unik (misal: AJN-MJK-0101). Bagian dari Composite Key.',
      sheetSource: 'Kolom "Emp ID" / "ID Karyawan"',
      sample: 'AJN-MJK-0101'
    },
    {
      column: 'emp_name',
      type: 'VARCHAR(150) NOT NULL',
      description: 'Nama lengkap karyawan.',
      sheetSource: 'Kolom "Emp Name" / "Nama Karyawan"',
      sample: 'Ahmad Fadhil Kurniawan'
    },
    {
      column: 'divisi',
      type: 'VARCHAR(100)',
      description: 'Divisi tempat karyawan bertugas (misal: Produksi MSG & Seasoning).',
      sheetSource: 'Kolom "Divisi"',
      sample: 'Produksi MSG & Seasoning'
    },
    {
      column: 'department',
      type: 'VARCHAR(100)',
      description: 'Departemen kerja karyawan.',
      sheetSource: 'Kolom "Department"',
      sample: 'Fermentation Department'
    },
    {
      column: 'section',
      type: 'VARCHAR(100)',
      description: 'Seksi/unit kerja spesifik.',
      sheetSource: 'Kolom "Section"',
      sample: 'Inoculum & Media Section'
    },
    {
      column: 'grade',
      type: 'VARCHAR(20)',
      description: 'Pangkat/golongan karyawan (M1-M4, ST1-ST4, REM1, dll).',
      sheetSource: 'Kolom "Grade"',
      sample: 'M4'
    },
    {
      column: 'job_grade',
      type: 'VARCHAR(20)',
      description: 'Tingkat Job Grade (misal: JG-11, JG-06).',
      sheetSource: 'Kolom "Job Grade"',
      sample: 'JG-11'
    },
    {
      column: 'jabatan',
      type: 'VARCHAR(150)',
      description: 'Nama jabatan resmi / posisi kerja karyawan.',
      sheetSource: 'Kolom "Jabatan"',
      sample: 'Department Manager Fermentation'
    },
    {
      column: 'gender',
      type: "VARCHAR(10) DEFAULT 'L'",
      description: 'Jenis kelamin karyawan ("L" = Laki-laki, "P" = Perempuan).',
      sheetSource: 'Kolom "Gender" / "L/P"',
      sample: 'L'
    },
    {
      column: 'tanggal_pensiun',
      type: 'VARCHAR(50)',
      description: 'Tanggal perkiraan pensiun karyawan (format: dd MMM yyyy).',
      sheetSource: 'Kolom "Tanggal Pensiun"',
      sample: '14 Nov 2038'
    },
    {
      column: 'pic',
      type: 'VARCHAR(150)',
      description: 'Nama Person in Charge / Penilai / Atasan langsung.',
      sheetSource: 'Kolom "PIC" / "Evaluator"',
      sample: 'Rudi Hartono'
    },
    {
      column: 'tahun',
      type: 'INTEGER NOT NULL',
      description: 'Tahun periode evaluasi multi-skill (misal: 2026). Bagian dari Composite Key.',
      sheetSource: 'Kolom "Tahun" / Header Periode',
      sample: '2026'
    },
    {
      column: 'bulan',
      type: 'INTEGER NOT NULL',
      description: 'Bulan periode evaluasi (1 s/d 12, misal 8 = Agustus). Bagian dari Composite Key.',
      sheetSource: 'Kolom "Bulan" / Header Periode',
      sample: '8'
    },
    {
      column: 'job_category',
      type: 'VARCHAR(50)',
      description: 'Kategori jabatan penentu standar skill (Dept. Manager up, ASM - SM, LL - Foreman, Operator, Non Operator).',
      sheetSource: 'Otomatis dihitung / Kolom "Job Category"',
      sample: 'Dept. Manager up'
    },
    {
      column: 'total_score',
      type: 'INTEGER DEFAULT 0',
      description: 'Total jumlah skill yang telah dikuasai (dihitung dari checklist skill bernilai true).',
      sheetSource: 'Otomatis dihitung / Kolom "Total Score"',
      sample: '11'
    },
    {
      column: 'standard',
      type: 'INTEGER',
      description: 'Target standar minimal skill yang harus dikuasai untuk kategori jabatan tersebut.',
      sheetSource: 'Otomatis dihitung / Kolom "Standard"',
      sample: '10'
    },
    {
      column: 'result',
      type: 'VARCHAR(10)',
      description: 'Hasil evaluasi kualifikasi ("MS" = Multi-Skill / Memenuhi, "US" = Under-Skill / Belum Memenuhi).',
      sheetSource: 'Otomatis dihitung / Kolom "Result"',
      sample: 'MS'
    },
    {
      column: 'gap',
      type: 'INTEGER',
      description: 'Selisih antara total skill yang dikuasai dengan standar (total_score - standard).',
      sheetSource: 'Otomatis dihitung / Kolom "Gap"',
      sample: '1'
    },
    {
      column: 'skills',
      type: "JSONB DEFAULT '{}'::jsonb",
      description: 'Objek JSON berisi 92+ kode kompetensi skill dan status penguasaan (key-value boolean: {"1.1": true, "1.2": false, ...}). Sangat fleksibel & mudah di-query.',
      sheetSource: '92+ Kolom Matriks Skill (1.1 s/d 17.5)',
      sample: '{"1.1": true, "1.2": true, "1.3": false}'
    }
  ];
}

// -------------------------------------------------------------
// Comprehensive SQL Schema Generator for Supabase (Full Database + Profiles + Config)
// -------------------------------------------------------------
export const generateSupabaseSqlTable = (tableName: string = 'employees_multi_skill'): string => {
  return generateCompleteSupabaseSqlSchema(tableName);
};

export function generateCompleteSupabaseSqlSchema(tableName: string = 'employees_multi_skill'): string {
  return `-- =========================================================================
-- PT AJINOMOTO INDONESIA - MOJOKERTO FACTORY
-- COMPLETE SUPABASE / POSTGRESQL DATABASE INITIALIZATION SCHEMA
-- Copy and paste all queries below into Supabase -> SQL Editor -> Run
-- =========================================================================

-- 1. TABEL UTAMA: DATA KARYAWAN & MATRIKS MULTI-SKILL (92+ KOMPETENSI)
CREATE TABLE IF NOT EXISTS public.${tableName} (
    id BIGSERIAL PRIMARY KEY,
    emp_id VARCHAR(50) NOT NULL,
    emp_name VARCHAR(150) NOT NULL,
    divisi VARCHAR(100),
    department VARCHAR(100),
    section VARCHAR(100),
    grade VARCHAR(20),
    job_grade VARCHAR(20),
    jabatan VARCHAR(150),
    gender VARCHAR(10) DEFAULT 'L',
    tanggal_pensiun VARCHAR(50),
    pic VARCHAR(150),
    tahun INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
    bulan INTEGER NOT NULL DEFAULT EXTRACT(MONTH FROM CURRENT_DATE),
    job_category VARCHAR(50),
    total_score INTEGER DEFAULT 0,
    standard INTEGER,
    result VARCHAR(10),
    gap INTEGER,
    skills JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_emp_period UNIQUE (emp_id, tahun, bulan)
);

-- Index Performa Tinggi untuk Kueri Cepat
CREATE INDEX IF NOT EXISTS idx_${tableName}_period ON public.${tableName} (tahun, bulan);
CREATE INDEX IF NOT EXISTS idx_${tableName}_div_dept ON public.${tableName} (divisi, department);
CREATE INDEX IF NOT EXISTS idx_${tableName}_emp_id ON public.${tableName} (emp_id);
CREATE INDEX IF NOT EXISTS idx_${tableName}_result ON public.${tableName} (result);
CREATE INDEX IF NOT EXISTS idx_${tableName}_skills_gin ON public.${tableName} USING gin (skills);

-- 2. TABEL AKUN PENGGUNA, PROFIL HR ADMIN & FOTO AVATAR
CREATE TABLE IF NOT EXISTS public.users_accounts (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(150) NOT NULL,
    role VARCHAR(100) NOT NULL DEFAULT 'HR Development Admin',
    department VARCHAR(150) DEFAULT 'Human Resources Development',
    divisi VARCHAR(150) DEFAULT 'Human Resources & Corporate Service',
    scope_type VARCHAR(50) DEFAULT 'ALL',
    scope_value VARCHAR(150) DEFAULT 'Semua Departemen',
    status VARCHAR(20) DEFAULT 'ACTIVE',
    email VARCHAR(150) DEFAULT 'mahmudnurdiansyah4@gmail.com',
    phone VARCHAR(50) DEFAULT '0819-1932-7912',
    nik VARCHAR(50) DEFAULT '122108091',
    avatar_url TEXT DEFAULT '',
    bio TEXT DEFAULT 'Administrator Multi-Skill Monitoring & Pengembangan Kompetensi Karyawan PT Ajinomoto Indonesia Mojokerto Factory.',
    signature_image TEXT DEFAULT '',
    can_edit_competency BOOLEAN DEFAULT true,
    can_manage_users BOOLEAN DEFAULT false,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Akun Default Super Admin & PIC Departemen
INSERT INTO public.users_accounts (username, password, name, role, department, divisi, scope_type, scope_value, status, email, phone, nik, bio, can_edit_competency, can_manage_users)
VALUES 
(
    'hr_admin',
    'password123',
    'Mahmud Nurdiansyah',
    'HR Development Admin',
    'Human Resources Development',
    'Human Resources & Corporate Service',
    'ALL',
    'Semua Departemen',
    'ACTIVE',
    'mahmudnurdiansyah4@gmail.com',
    '0819-1932-7912',
    '122108091',
    'Super Administrator Multi-Skill Monitoring & Pengembangan Kompetensi Karyawan PT Ajinomoto Indonesia Mojokerto Factory.',
    true,
    true
),
(
    'fermentasi_pic',
    'fermentasi123',
    'Budi Santoso, S.T.',
    'PIC Departemen Fermentasi',
    'Fermentation Department',
    'Production FI (MSG)',
    'DEPARTMENT',
    'Fermentation Department',
    'ACTIVE',
    'budi.santoso@ajinomoto.co.id',
    '0812-3456-7890',
    '121904102',
    'Person-in-Charge Pemantauan & Evaluasi Matriks Multi-Skill Bagian Proses Fermentasi MSG.',
    true,
    false
),
(
    'packaging_pic',
    'packaging123',
    'Siti Rahmawati',
    'PIC Packaging & Filling',
    'Packaging Department',
    'Production FP (Food Products)',
    'DEPARTMENT',
    'Packaging Department',
    'ACTIVE',
    'siti.rahmawati@ajinomoto.co.id',
    '0813-9876-5432',
    '122005214',
    'Supervisor & PIC Multi-Skill Pemantauan Keahlian Packaging & Filling Food Products Mojokerto Factory.',
    true,
    false
),
(
    'qa_pic',
    'qa123456',
    'Agus Setiawan, S.Si.',
    'Quality Assurance PIC',
    'Quality Assurance',
    'Technical & QA',
    'DEPARTMENT',
    'Quality Assurance',
    'ACTIVE',
    'agus.setiawan@ajinomoto.co.id',
    '0815-6789-0123',
    '121803119',
    'Penanggung Jawab Kompetensi Analis & Matriks Laboratorium Quality Assurance & Control.',
    true,
    false
),
(
    'eng_supervisor',
    'eng12345',
    'Hendra Wijaya',
    'Section Supervisor Maintenance',
    'Engineering & Maintenance',
    'Engineering & Utility',
    'DEPARTMENT',
    'Engineering & Maintenance',
    'ACTIVE',
    'hendra.wijaya@ajinomoto.co.id',
    '0821-4567-8901',
    '121702088',
    'Supervisor Divisi Pemeliharaan Mesin & Utilitas Pabrik Ajinomoto Mojokerto.',
    true,
    false
),
(
    'mgmt_viewer',
    'viewer123',
    'Ir. Haryono',
    'Executive Management Auditor',
    'Factory Executive Office',
    'Factory Management',
    'ALL',
    'Semua Departemen',
    'ACTIVE',
    'haryono.exec@ajinomoto.co.id',
    '0811-2233-4455',
    '119801001',
    'Pemantau Eksekutif KPI Matriks Multi-Skill dan Kesiapan Kompetensi Tenaga Kerja Pabrik.',
    false,
    false
)
ON CONFLICT (username) DO UPDATE SET
    name = EXCLUDED.name,
    nik = EXCLUDED.nik,
    role = EXCLUDED.role,
    department = EXCLUDED.department,
    divisi = EXCLUDED.divisi,
    scope_type = EXCLUDED.scope_type,
    scope_value = EXCLUDED.scope_value,
    status = EXCLUDED.status,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email,
    can_edit_competency = EXCLUDED.can_edit_competency,
    can_manage_users = EXCLUDED.can_manage_users,
    updated_at = NOW();

-- 3. TABEL KONFIGURASI SISTEM, SMTP EMAIL & APPROVAL E-SIGN
CREATE TABLE IF NOT EXISTS public.system_config (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'global_config',
    google_sheet_url TEXT DEFAULT '',
    esign_dept_manager_name VARCHAR(150) DEFAULT 'Mahmud Nurdiansyah',
    esign_dept_manager_nik VARCHAR(50) DEFAULT '122108091',
    esign_dept_manager_title VARCHAR(150) DEFAULT 'HR Development Department Manager',
    esign_factory_manager_name VARCHAR(150) DEFAULT 'Ir. Bambang Wijaya, M.M.',
    esign_factory_manager_title VARCHAR(150) DEFAULT 'Mojokerto Factory General Manager',
    threshold_dept_mgr INTEGER DEFAULT 4,
    threshold_asm_sm INTEGER DEFAULT 3,
    threshold_ll_foreman INTEGER DEFAULT 2,
    target_percent_dept_mgr NUMERIC DEFAULT 0.30,
    target_percent_asm_sm NUMERIC DEFAULT 0.30,
    target_percent_ll_foreman NUMERIC DEFAULT 0.30,
    smtp_host VARCHAR(150) DEFAULT 'smtp.gmail.com',
    smtp_port INTEGER DEFAULT 587,
    smtp_secure BOOLEAN DEFAULT false,
    smtp_user VARCHAR(150) DEFAULT '',
    smtp_pass VARCHAR(255) DEFAULT '',
    smtp_from VARCHAR(150) DEFAULT 'hr.multiskill@ajinomoto.co.id',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Konfigurasi Awal
INSERT INTO public.system_config (id) VALUES ('global_config')
ON CONFLICT (id) DO NOTHING;

-- 4. TABEL LOG AUDIT AKTIVITAS & RIWAYAT EMAIL SISTEM
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    username VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    details TEXT,
    ip_address VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS public.email_logs (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    sender VARCHAR(100) NOT NULL,
    recipient TEXT NOT NULL,
    subject VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    error_message TEXT
);

-- 5. PENGATURAN ROW LEVEL SECURITY (RLS) UNTUK INTEGRASI WEB & API
ALTER TABLE public.${tableName} ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public all access on ${tableName}" ON public.${tableName} FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access on users_accounts" ON public.users_accounts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access on system_config" ON public.system_config FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access on activity_logs" ON public.activity_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access on email_logs" ON public.email_logs FOR ALL USING (true) WITH CHECK (true);

-- 6. VIEW DASHBOARD SUMMARY
CREATE OR REPLACE VIEW public.v_${tableName}_summary AS
SELECT 
    tahun,
    bulan,
    divisi,
    department,
    COUNT(*) AS total_karyawan,
    COUNT(CASE WHEN result = 'MS' THEN 1 END) AS total_ms,
    COUNT(CASE WHEN result = 'US' THEN 1 END) AS total_us,
    ROUND((COUNT(CASE WHEN result = 'MS' THEN 1 END)::NUMERIC / NULLIF(COUNT(*), 0) * 100), 1) AS ms_rate_percent,
    ROUND(AVG(total_score), 2) AS rata_rata_score
FROM public.${tableName}
GROUP BY tahun, bulan, divisi, department;
`;
}

// -------------------------------------------------------------
// Google Apps Script (GAS) Generator for Google Sheets Synchronization
// -------------------------------------------------------------
export function generateGoogleAppsScriptForSheets(): string {
  return `/**
 * =========================================================================
 * PT AJINOMOTO INDONESIA - MOJOKERTO FACTORY
 * GOOGLE APPS SCRIPT: TWO-WAY SYNC MULTI-SKILL SYSTEM & GOOGLE SHEETS
 * =========================================================================
 * 
 * CARA PEMASANGAN:
 * 1. Buka Google Sheet Master Multi-Skill Anda.
 * 2. Klik menu 'Extensions' (Ekstensi) -> 'Apps Script'.
 * 3. Hapus kode bawaan dan tempel seluruh kode di bawah ini.
 * 4. Simpan (Ctrl+S) lalu jalankan fungsi 'createMultiSkillSheetTemplate()' untuk membuat format kolom otomatis.
 */

// Konfigurasi Header Kolom Matriks Multi-Skill
var SKILL_CODES = [
  "FI-1 / H-1", "FI-1 / H-2", "FI-1 / H-4", "FI-1 / H-5,6", "FI-2 / Production", "FI-2 / Supporting",
  "FP-1 / EMP", "FP-1 / Masako Bulk", "FP-1 / Liquid", "FP-2 / Packaging", "FP-2 / Warehouse",
  "QC / Chemical Analysis", "QC / Microbiology", "QA / Food Safety", "Engineering / Mechanical",
  "Engineering / Electrical", "Engineering / Automation & PLC", "Utility / Boiler & Steam",
  "Utility / Water Treatment (WTP)", "Utility / Waste Water (WWTP)", "HSE / K3 & Environmental"
];

/**
 * 1. Fungsi Membuat Sheet Baru dengan Format Standar Multi-Skill Ajinomoto
 */
function createMultiSkillSheetTemplate() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = "MULTI_SKILL_MASTER";
  var sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  } else {
    sheet.clear();
  }
  
  var baseHeaders = [
    "No", "Emp ID", "Emp Name", "Divisi", "Department", "Section", "Grade", "Job Grade",
    "Jabatan", "Gender", "Tanggal Pensiun", "PIC", "Tahun", "Bulan", "Job Category",
    "Total Score", "Standard", "Result", "Gap"
  ];
  
  var fullHeaders = baseHeaders.concat(SKILL_CODES);
  
  // Tulis Header
  sheet.getRange(1, 1, 1, fullHeaders.length).setValues([fullHeaders]);
  
  // Format Header
  var headerRange = sheet.getRange(1, 1, 1, fullHeaders.length);
  headerRange.setBackground("#B91C1C"); // Ajinomoto Red
  headerRange.setFontColor("#FFFFFF");
  headerRange.setFontWeight("bold");
  headerRange.setHorizontalAlignment("center");
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(3);
  
  // Tulis Baris Contoh Karyawan
  var sampleRow = [
    1, "AJN-MJK-0101", "Ahmad Fadhil Kurniawan", "Produksi MSG & Seasoning", "Fermentation Department",
    "Inoculum & Media Section", "M4", "JG-11", "Department Manager Fermentation", "L", "14 Nov 2038",
    "Rudi Hartono", 2026, 8, "Dept. Manager up", 11, 4, "MS", 7
  ];
  
  // Checklist skills sample
  for (var i = 0; i < SKILL_CODES.length; i++) {
    sampleRow.push(i < 11 ? 1 : 0);
  }
  
  sheet.getRange(2, 1, 1, sampleRow.length).setValues([sampleRow]);
  
  SpreadsheetApp.getUi().alert("Template Multi-Skill Ajinomoto berhasil dibuat pada sheet: " + sheetName);
}

/**
 * 2. Web App API Endpoint untuk integrasi realtime (GET)
 */
function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("MULTI_SKILL_MASTER") || ss.getActiveSheet();
  var data = sheet.getDataRange().getValues();
  
  if (data.length < 2) {
    return ContentService.createTextOutput(JSON.stringify({ success: true, count: 0, data: [] }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  var headers = data[0];
  var rows = [];
  
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var emp = {
      rowIndex: r + 1,
      no: row[0],
      empId: String(row[1] || ''),
      empName: String(row[2] || ''),
      divisi: String(row[3] || ''),
      department: String(row[4] || ''),
      section: String(row[5] || ''),
      grade: String(row[6] || ''),
      jobGrade: String(row[7] || ''),
      jabatan: String(row[8] || ''),
      gender: String(row[9] || 'L'),
      tanggalPensiun: String(row[10] || ''),
      pic: String(row[11] || ''),
      tahun: Number(row[12]) || 2026,
      bulan: Number(row[13]) || 8,
      jobCategory: String(row[14] || ''),
      totalScore: Number(row[15]) || 0,
      standard: Number(row[16]) || 0,
      result: String(row[17] || 'US'),
      gap: Number(row[18]) || 0,
      skills: {}
    };
    
    for (var c = 19; c < headers.length; c++) {
      var skillCode = headers[c];
      var val = row[c];
      emp.skills[skillCode] = (val === 1 || val === "1" || val === true || String(val).toLowerCase() === "true" || String(val).toLowerCase() === "v");
    }
    
    rows.push(emp);
  }
  
  var response = {
    success: true,
    count: rows.length,
    timestamp: new Date().toISOString(),
    data: rows
  };
  
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}
`;
}


// -------------------------------------------------------------
// Supabase User Accounts Management & Synchronization
// -------------------------------------------------------------
export const SUPABASE_USERS_TABLE = 'users_accounts';

/**
 * Test or check if users_accounts table exists in Supabase
 */
export async function testSupabaseUsersTable(config: SupabaseConfig): Promise<{ success: boolean; message: string; count?: number }> {
  if (!config.url || !config.anonKey) {
    return { success: false, message: 'Supabase URL dan Anon Key belum dikonfigurasi.' };
  }

  const client = getSupabaseClient(config);
  try {
    if (client) {
      const { count, error } = await client
        .from(SUPABASE_USERS_TABLE)
        .select('*', { count: 'exact', head: true });

      if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('does not exist')) {
          return {
            success: false,
            message: `Tabel "${SUPABASE_USERS_TABLE}" belum dibuat di Supabase. Jalankan script SQL DDL di SQL Editor Supabase.`
          };
        }
        return { success: false, message: `Error Supabase Users: ${error.message}` };
      }

      return {
        success: true,
        message: `Tabel "${SUPABASE_USERS_TABLE}" aktif di Supabase!`,
        count: count ?? 0
      };
    }

    return { success: false, message: 'Gagal menginisialisasi klien Supabase.' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Gagal terhubung ke Supabase.' };
  }
}

/**
 * Fetch all user accounts directly from Supabase users_accounts table
 */
export async function fetchSupabaseUsers(config: SupabaseConfig): Promise<{ success: boolean; message: string; users: UserAccount[] }> {
  if (!config.url || !config.anonKey) {
    return { success: false, message: 'Supabase belum dikonfigurasi.', users: [] };
  }

  try {
    const client = getSupabaseClient(config);
    if (!client) {
      return { success: false, message: 'Klien Supabase tidak tersedia.', users: [] };
    }

    const { data, error } = await client
      .from(SUPABASE_USERS_TABLE)
      .select('*');

    if (error) {
      return {
        success: false,
        message: `Gagal mengambil akun pengguna dari Supabase: ${error.message}`,
        users: []
      };
    }

    if (!Array.isArray(data) || data.length === 0) {
      return {
        success: true,
        message: 'Tabel users_accounts di Supabase masih kosong.',
        users: []
      };
    }

    const parsedUsers: UserAccount[] = data.map((r: any) => ({
      username: (r.username || '').toString().trim(),
      password: r.password ? (r.password || '').toString() : 'password123',
      name: (r.name || r.username || '').toString().trim(),
      role: (r.role || 'PIC').toString().trim(),
      department: (r.department || '').toString().trim(),
      divisi: (r.divisi || '').toString().trim(),
      scopeType: (r.scope_type || r.scopeType || 'ALL') as UserScopeType,
      scopeValue: (r.scope_value || r.scopeValue || '').toString().trim(),
      status: (r.status || 'ACTIVE') as 'ACTIVE' | 'INACTIVE',
      email: (r.email || '').toString().trim(),
      phone: (r.phone || '').toString().trim(),
      nik: (r.nik || '').toString().trim(),
      avatarUrl: (r.avatar_url || r.avatarUrl || '').toString().trim(),
      bio: (r.bio || '').toString().trim(),
      signatureImage: (r.signature_image || r.signatureImage || '').toString().trim(),
      canEditCompetency: r.can_edit_competency !== undefined ? Boolean(r.can_edit_competency) : true,
      canManageUsers: r.can_manage_users !== undefined ? Boolean(r.can_manage_users) : (r.username === 'hr_admin'),
      createdAt: r.created_at || new Date().toISOString(),
      updatedAt: r.updated_at || new Date().toISOString(),
      lastLogin: r.last_login || null
    }));

    return {
      success: true,
      message: `Berhasil memuat ${parsedUsers.length} akun pengguna dari Supabase.`,
      users: parsedUsers
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Gagal mengambil data user Supabase: ${err.message || 'Kesalahan jaringan'}`,
      users: []
    };
  }
}

/**
 * Push / Upsert a single User Account into Supabase
 */
export async function pushUserToSupabase(
  config: SupabaseConfig,
  user: UserAccount
): Promise<{ success: boolean; message: string; user?: UserAccount }> {
  if (!config.url || !config.anonKey) {
    return { success: false, message: 'Supabase belum dikonfigurasi.' };
  }

  const client = getSupabaseClient(config);
  if (!client) {
    return { success: false, message: 'Klien Supabase tidak tersedia.' };
  }

  try {
    const payload = {
      username: user.username.trim().toLowerCase(),
      password: user.password || 'password123',
      name: user.name,
      role: user.role,
      department: user.department,
      divisi: user.divisi || 'Human Resources & Corporate Service',
      scope_type: user.scopeType || 'ALL',
      scope_value: user.scopeValue || user.department,
      status: user.status || 'ACTIVE',
      email: user.email || '',
      phone: user.phone || '',
      nik: user.nik || '',
      avatar_url: user.avatarUrl || '',
      bio: user.bio || '',
      signature_image: user.signatureImage || '',
      can_edit_competency: user.canEditCompetency !== undefined ? user.canEditCompetency : true,
      can_manage_users: user.canManageUsers !== undefined ? user.canManageUsers : (user.username.toLowerCase() === 'hr_admin'),
      last_login: user.lastLogin || null,
      updated_at: new Date().toISOString()
    };

    const { error } = await client
      .from(SUPABASE_USERS_TABLE)
      .upsert(payload, { onConflict: 'username' });

    if (error) {
      return { success: false, message: `Gagal menyimpan user ke Supabase: ${error.message}` };
    }

    return {
      success: true,
      message: `Akun "${user.name}" (@${user.username}) berhasil disimpan ke Supabase.`,
      user
    };
  } catch (err: any) {
    return { success: false, message: `Gagal menyimpan user ke Supabase: ${err.message || 'Error jaringan'}` };
  }
}

/**
 * Batch Push / Sync all user accounts to Supabase
 */
export async function pushAllUsersToSupabase(
  config: SupabaseConfig,
  users: UserAccount[]
): Promise<{ success: boolean; message: string; count?: number }> {
  if (!config.url || !config.anonKey) {
    return { success: false, message: 'Supabase belum dikonfigurasi.' };
  }

  const client = getSupabaseClient(config);
  if (!client) {
    return { success: false, message: 'Klien Supabase tidak tersedia.' };
  }

  try {
    const payload = users.map((u) => ({
      username: u.username.trim().toLowerCase(),
      password: u.password || 'password123',
      name: u.name,
      role: u.role,
      department: u.department,
      divisi: u.divisi || 'Human Resources & Corporate Service',
      scope_type: u.scopeType || 'ALL',
      scope_value: u.scopeValue || u.department,
      status: u.status || 'ACTIVE',
      email: u.email || '',
      phone: u.phone || '',
      nik: u.nik || '',
      avatar_url: u.avatarUrl || '',
      bio: u.bio || '',
      signature_image: u.signatureImage || '',
      can_edit_competency: u.canEditCompetency !== undefined ? u.canEditCompetency : true,
      can_manage_users: u.canManageUsers !== undefined ? u.canManageUsers : (u.username.toLowerCase() === 'hr_admin'),
      last_login: u.lastLogin || null,
      updated_at: new Date().toISOString()
    }));

    const { error } = await client
      .from(SUPABASE_USERS_TABLE)
      .upsert(payload, { onConflict: 'username' });

    if (error) {
      return { success: false, message: `Gagal sinkronisasi batch user ke Supabase: ${error.message}` };
    }

    return {
      success: true,
      message: `Berhasil mensinkronkan ${users.length} akun pengguna ke Supabase table "${SUPABASE_USERS_TABLE}".`,
      count: users.length
    };
  } catch (err: any) {
    return { success: false, message: `Gagal sinkronisasi user ke Supabase: ${err.message}` };
  }
}

/**
 * Delete a user account from Supabase
 */
export async function deleteUserFromSupabase(
  config: SupabaseConfig,
  username: string
): Promise<{ success: boolean; message: string }> {
  if (!config.url || !config.anonKey) {
    return { success: false, message: 'Supabase belum dikonfigurasi.' };
  }

  if (username.toLowerCase() === 'hr_admin') {
    return { success: false, message: 'Akun Super Administrator Utama (hr_admin) dilindungi.' };
  }

  const client = getSupabaseClient(config);
  if (!client) {
    return { success: false, message: 'Klien Supabase tidak tersedia.' };
  }

  try {
    const { error } = await client
      .from(SUPABASE_USERS_TABLE)
      .delete()
      .eq('username', username.trim().toLowerCase());

    if (error) {
      return { success: false, message: `Gagal menghapus user di Supabase: ${error.message}` };
    }

    return { success: true, message: `Akun @${username} berhasil dihapus dari Supabase.` };
  } catch (err: any) {
    return { success: false, message: `Gagal menghapus user di Supabase: ${err.message}` };
  }
}

/**
 * Direct Login / Authenticate against Supabase users_accounts
 */
export async function authenticateUserSupabase(
  config: SupabaseConfig,
  username: string,
  password: string
): Promise<{ success: boolean; message?: string; user?: UserAccount }> {
  if (!config.url || !config.anonKey) {
    return { success: false, message: 'Supabase belum dikonfigurasi.' };
  }

  const client = getSupabaseClient(config);
  if (!client) {
    return { success: false, message: 'Klien Supabase tidak tersedia.' };
  }

  try {
    const clean = username.trim().toLowerCase();
    const { data, error } = await client
      .from(SUPABASE_USERS_TABLE)
      .select('*')
      .or(`username.ilike.${clean},email.ilike.${clean},nik.eq.${clean}`)
      .limit(1);

    if (error) {
      return { success: false, message: error.message };
    }

    if (!data || data.length === 0) {
      return { success: false, message: 'Akun tidak ditemukan di database Supabase.' };
    }

    const record = data[0];
    if (record.password !== password) {
      return { success: false, message: 'Kata sandi salah. Silakan coba lagi.' };
    }

    if (record.status === 'INACTIVE') {
      return { success: false, message: 'Akun ini dinonaktifkan oleh administrator.' };
    }

    // Update last login in background
    client
      .from(SUPABASE_USERS_TABLE)
      .update({ last_login: new Date().toISOString() })
      .eq('username', record.username)
      .then(() => {});

    const user: UserAccount = {
      username: record.username,
      password: record.password,
      name: record.name,
      role: record.role,
      department: record.department,
      divisi: record.divisi || '',
      scopeType: (record.scope_type || 'ALL') as UserScopeType,
      scopeValue: record.scope_value || '',
      status: (record.status || 'ACTIVE') as 'ACTIVE' | 'INACTIVE',
      email: record.email || '',
      phone: record.phone || '',
      nik: record.nik || '',
      avatarUrl: record.avatar_url || '',
      bio: record.bio || '',
      signatureImage: record.signature_image || '',
      canEditCompetency: record.can_edit_competency !== undefined ? Boolean(record.can_edit_competency) : true,
      canManageUsers: record.can_manage_users !== undefined ? Boolean(record.can_manage_users) : (record.username === 'hr_admin'),
      lastLogin: new Date().toISOString(),
      createdAt: record.created_at || new Date().toISOString(),
      updatedAt: record.updated_at || new Date().toISOString()
    };

    return { success: true, message: 'Login Supabase berhasil.', user };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Gagal otentikasi ke Supabase.' };
  }
}

// -------------------------------------------------------------
// Google Sheets User Accounts Import & Parser
// -------------------------------------------------------------
export function parseRowsToUsers(rawRows: string[][]): { users: UserAccount[]; errors: string[] } {
  const errors: string[] = [];
  if (!rawRows || rawRows.length === 0) {
    return { users: [], errors: ['File / Sheet kosong.'] };
  }

  // Find header row containing username / name / role
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
    const rowStr = rawRows[i].map((c) => normalizeHeaderName(c)).join(' ');
    if (rowStr.includes('username') || rowStr.includes('nama') || rowStr.includes('role') || rowStr.includes('departemen')) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx === -1) headerIdx = 0;

  const headerRow = rawRows[headerIdx];
  const colMap: Record<string, number> = {};

  headerRow.forEach((col, idx) => {
    const norm = normalizeHeaderName(col);
    if (['username', 'user', 'iduser', 'userid', 'akun'].includes(norm)) colMap['username'] = idx;
    else if (['password', 'katasandi', 'pass', 'pwd'].includes(norm)) colMap['password'] = idx;
    else if (['name', 'nama', 'namalengkap', 'fullname', 'pengguna'].includes(norm)) colMap['name'] = idx;
    else if (['role', 'jabatan', 'peran', 'akses', 'hakakses'].includes(norm)) colMap['role'] = idx;
    else if (['department', 'departemen', 'dept'].includes(norm)) colMap['department'] = idx;
    else if (['divisi', 'division', 'div'].includes(norm)) colMap['divisi'] = idx;
    else if (['scopetype', 'tipeakses', 'scope', 'cakupan'].includes(norm)) colMap['scopeType'] = idx;
    else if (['scopevalue', 'nilaiakses', 'targetakses', 'departemenakses'].includes(norm)) colMap['scopeValue'] = idx;
    else if (['status', 'statusakun', 'state'].includes(norm)) colMap['status'] = idx;
    else if (['email', 'surel', 'mail'].includes(norm)) colMap['email'] = idx;
    else if (['phone', 'telepon', 'nohp', 'hp', 'telp', 'wa'].includes(norm)) colMap['phone'] = idx;
    else if (['nik', 'nip', 'nopegawai'].includes(norm)) colMap['nik'] = idx;
    else if (['bio', 'biografi', 'keterangan', 'deskripsi'].includes(norm)) colMap['bio'] = idx;
    else if (['caneditcompetency', 'editkompetensi', 'bolehisi'].includes(norm)) colMap['canEditCompetency'] = idx;
    else if (['canmanageusers', 'kelolauser', 'admin'].includes(norm)) colMap['canManageUsers'] = idx;
  });

  if (colMap['username'] === undefined && colMap['name'] === undefined) {
    return { users: [], errors: ['Kolom Username atau Nama tidak terdeteksi pada baris header.'] };
  }

  const dataRows = rawRows.slice(headerIdx + 1);
  const parsedUsers: UserAccount[] = [];

  dataRows.forEach((row, idx) => {
    if (!row || row.every((c) => !c || c.trim() === '')) return;

    let rawUsername = (colMap['username'] !== undefined ? row[colMap['username']] : '')?.trim();
    const rawName = (colMap['name'] !== undefined ? row[colMap['name']] : '')?.trim();

    if (!rawUsername && rawName) {
      rawUsername = rawName.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 15);
    }

    if (!rawUsername && !rawName) return;

    const username = (rawUsername || `user_${idx + 1}`).toLowerCase();
    const name = rawName || username;
    const password = (colMap['password'] !== undefined ? row[colMap['password']] : '')?.trim() || 'password123';
    const role = (colMap['role'] !== undefined ? row[colMap['role']] : '')?.trim() || 'PIC Departemen';
    const department = (colMap['department'] !== undefined ? row[colMap['department']] : '')?.trim() || 'Fermentation Department';
    const divisi = (colMap['divisi'] !== undefined ? row[colMap['divisi']] : '')?.trim() || 'Production FI (MSG)';

    let rawScope = (colMap['scopeType'] !== undefined ? row[colMap['scopeType']] : 'DEPARTMENT')?.trim().toUpperCase();
    let scopeType: UserScopeType = 'DEPARTMENT';
    if (rawScope === 'ALL' || rawScope.includes('SEMUA')) scopeType = 'ALL';
    else if (rawScope === 'DIVISI') scopeType = 'DIVISI';
    else if (rawScope === 'PIC') scopeType = 'PIC';

    const scopeValue = (colMap['scopeValue'] !== undefined ? row[colMap['scopeValue']] : '')?.trim() || (scopeType === 'ALL' ? 'Semua Departemen' : department);

    let rawStatus = (colMap['status'] !== undefined ? row[colMap['status']] : 'ACTIVE')?.trim().toUpperCase();
    let status: 'ACTIVE' | 'INACTIVE' = rawStatus === 'INACTIVE' || rawStatus === 'NONAKTIF' || rawStatus === '0' ? 'INACTIVE' : 'ACTIVE';

    const email = (colMap['email'] !== undefined ? row[colMap['email']] : '')?.trim();
    const phone = (colMap['phone'] !== undefined ? row[colMap['phone']] : '')?.trim();
    const nik = (colMap['nik'] !== undefined ? row[colMap['nik']] : '')?.trim();
    const bio = (colMap['bio'] !== undefined ? row[colMap['bio']] : '')?.trim();

    const rawCanEdit = colMap['canEditCompetency'] !== undefined ? row[colMap['canEditCompetency']]?.trim().toLowerCase() : 'true';
    const canEditCompetency = rawCanEdit === 'true' || rawCanEdit === '1' || rawCanEdit === 'ya' || rawCanEdit === 'yes';

    const rawCanManage = colMap['canManageUsers'] !== undefined ? row[colMap['canManageUsers']]?.trim().toLowerCase() : (username === 'hr_admin' ? 'true' : 'false');
    const canManageUsers = rawCanManage === 'true' || rawCanManage === '1' || rawCanManage === 'ya' || rawCanManage === 'yes' || username === 'hr_admin';

    parsedUsers.push({
      username,
      password,
      name,
      role,
      department,
      divisi,
      scopeType,
      scopeValue,
      status,
      email,
      phone,
      nik,
      bio,
      canEditCompetency,
      canManageUsers,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  });

  return { users: parsedUsers, errors };
}

/**
 * Fetch and Parse User Accounts from Google Sheet
 */
export async function fetchGoogleSheetUsers(sheetUrl: string): Promise<SyncResponse<UserAccount[]>> {
  if (!sheetUrl || !sheetUrl.trim()) {
    return { success: false, message: 'URL Google Sheet belum diisi.' };
  }

  let csvText = '';
  const gvizUrl = buildGoogleSheetCsvUrl(sheetUrl, 'gviz');
  try {
    const res1 = await fetch(gvizUrl);
    if (res1.ok) {
      const text = await res1.text();
      if (text && !text.includes('<!DOCTYPE html>') && !text.includes('<html') && !text.includes('Sign in to your Google Account')) {
        csvText = text;
      }
    }
  } catch (_) {}

  if (!csvText) {
    const exportUrl = buildGoogleSheetCsvUrl(sheetUrl, 'export');
    try {
      const res2 = await fetch(exportUrl);
      if (res2.ok) {
        const text = await res2.text();
        if (text && !text.includes('<!DOCTYPE html>') && !text.includes('<html') && !text.includes('Sign in to your Google Account')) {
          csvText = text;
        }
      }
    } catch (_) {}
  }

  if (!csvText) {
    return {
      success: false,
      message: 'Tidak dapat mengunduh data Sheet. Pastikan link Google Sheet dibuka untuk publik ("Siapa saja yang memiliki link dapat melihat").'
    };
  }

  const rawRows = parseCsvString(csvText);
  const { users, errors } = parseRowsToUsers(rawRows);

  if (!users.length) {
    return {
      success: false,
      message: 'Tidak ditemukan baris akun pengguna yang valid pada spreadsheet tersebut.',
      errors
    };
  }

  return {
    success: true,
    message: `Berhasil menarik ${users.length} akun pengguna dari Google Sheet.`,
    data: users,
    users: users,
    count: users.length
  };
}

/**
 * Sync Google Sheets Users directly to Supabase
 */
export async function syncGoogleSheetsUsersDirectToSupabase(
  sheetUrl: string,
  config: SupabaseConfig
): Promise<SyncResponse<UserAccount[]>> {
  const sheetRes = await fetchGoogleSheetUsers(sheetUrl);
  if (!sheetRes.success || !sheetRes.data || sheetRes.data.length === 0) {
    return {
      success: false,
      message: `Gagal membaca akun dari Google Sheets: ${sheetRes.message}`
    };
  }

  const fetchedUsers = sheetRes.data;
  const pushRes = await pushAllUsersToSupabase(config, fetchedUsers);
  if (!pushRes.success) {
    return {
      success: false,
      message: `Akun berhasil dibaca dari Google Sheets (${fetchedUsers.length} akun), namun gagal diunggah ke Supabase: ${pushRes.message}`
    };
  }

  return {
    success: true,
    message: `Sukses sinkronisasi! ${fetchedUsers.length} akun pengguna dari Google Sheets berhasil disimpan ke Supabase table "${SUPABASE_USERS_TABLE}".`,
    data: fetchedUsers,
    count: fetchedUsers.length
  };
}

/**
 * Generator for Google Apps Script to create dedicated USER_ACCOUNTS sheet tab in Google Sheets
 */
export function generateGoogleAppsScriptForUsersManagement(): string {
  return `/**
 * =========================================================================
 * PT AJINOMOTO INDONESIA - MOJOKERTO FACTORY
 * GOOGLE APPS SCRIPT: USER ACCOUNTS & MANAGEMENT SHEET CREATOR & SYNC
 * =========================================================================
 * 
 * CARA PEMASANGAN:
 * 1. Buka Google Spreadsheet Anda.
 * 2. Klik menu 'Extensions' (Ekstensi) -> 'Apps Script'.
 * 3. Salin & tempel kode di bawah ini.
 * 4. Simpan (Ctrl+S) lalu jalankan fungsi 'createUsersManagementSheetTemplate()'.
 * 5. Sheet baru bernama 'USER_ACCOUNTS' akan otomatis dibuat dan siap digunakan!
 */

/**
 * 1. Fungsi Membuat Tab Sheet Baru Khusus Manajemen Akun Pengguna Ajinomoto
 */
function createUsersManagementSheetTemplate() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = "USER_ACCOUNTS";
  var sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  } else {
    sheet.clear();
  }
  
  var headers = [
    "No",
    "Username",
    "Password",
    "Nama Lengkap",
    "Role / Hak Akses",
    "Departemen",
    "Divisi",
    "Scope Type",
    "Scope Value",
    "Status",
    "Email",
    "No Telepon",
    "NIK",
    "Bio",
    "Can Edit Competency",
    "Can Manage Users",
    "Last Login",
    "Updated At"
  ];
  
  // Tulis Header
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // Format Header dengan Gaya Ajinomoto Burgundy Red
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground("#B91C1C"); // Ajinomoto Red
  headerRange.setFontColor("#FFFFFF");
  headerRange.setFontWeight("bold");
  headerRange.setHorizontalAlignment("center");
  headerRange.setVerticalAlignment("middle");
  sheet.setRowHeight(1, 38);
  
  // Freeze baris header dan kolom username
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(2);
  
  // Baris Data Contoh Akun Master
  var sampleUsers = [
    [
      1,
      "hr_admin",
      "password123",
      "Mahmud Nurdiansyah",
      "HR Development Admin",
      "Human Resources Development",
      "Human Resources & Corporate Service",
      "ALL",
      "Semua Departemen",
      "ACTIVE",
      "mahmudnurdiansyah4@gmail.com",
      "0819-1932-7912",
      "122108091",
      "Super Administrator Multi-Skill Monitoring & Pengembangan Kompetensi Karyawan PT Ajinomoto Indonesia Mojokerto Factory.",
      "TRUE",
      "TRUE",
      "",
      new Date().toISOString()
    ],
    [
      2,
      "fermentasi_pic",
      "fermentasi123",
      "Budi Santoso, S.T.",
      "PIC Departemen Fermentasi",
      "Fermentation Department",
      "Production FI (MSG)",
      "DEPARTMENT",
      "Fermentation Department",
      "ACTIVE",
      "budi.santoso@ajinomoto.co.id",
      "0812-3456-7890",
      "121904102",
      "Person-in-Charge Pemantauan & Evaluasi Matriks Multi-Skill Bagian Proses Fermentasi MSG.",
      "TRUE",
      "FALSE",
      "",
      new Date().toISOString()
    ],
    [
      3,
      "packaging_pic",
      "packaging123",
      "Siti Rahmawati",
      "PIC Packaging & Filling",
      "Packaging Department",
      "Production FP (Food Products)",
      "DEPARTMENT",
      "Packaging Department",
      "ACTIVE",
      "siti.rahmawati@ajinomoto.co.id",
      "0813-9876-5432",
      "122005214",
      "Supervisor & PIC Multi-Skill Pemantauan Keahlian Packaging & Filling Food Products Mojokerto Factory.",
      "TRUE",
      "FALSE",
      "",
      new Date().toISOString()
    ],
    [
      4,
      "qa_pic",
      "qa123456",
      "Agus Setiawan, S.Si.",
      "Quality Assurance PIC",
      "Quality Assurance",
      "Technical & QA",
      "DEPARTMENT",
      "Quality Assurance",
      "ACTIVE",
      "agus.setiawan@ajinomoto.co.id",
      "0815-6789-0123",
      "121803119",
      "Penanggung Jawab Kompetensi Analis & Matriks Laboratorium Quality Assurance & Control.",
      "TRUE",
      "FALSE",
      "",
      new Date().toISOString()
    ],
    [
      5,
      "eng_supervisor",
      "eng12345",
      "Hendra Wijaya",
      "Section Supervisor Maintenance",
      "Engineering & Maintenance",
      "Engineering & Utility",
      "DEPARTMENT",
      "Engineering & Maintenance",
      "ACTIVE",
      "hendra.wijaya@ajinomoto.co.id",
      "0821-4567-8901",
      "121702088",
      "Supervisor Divisi Pemeliharaan Mesin & Utilitas Pabrik Ajinomoto Mojokerto.",
      "TRUE",
      "FALSE",
      "",
      new Date().toISOString()
    ],
    [
      6,
      "mgmt_viewer",
      "viewer123",
      "Ir. Haryono",
      "Executive Management Auditor",
      "Factory Executive Office",
      "Factory Management",
      "ALL",
      "Semua Departemen",
      "ACTIVE",
      "haryono.exec@ajinomoto.co.id",
      "0811-2233-4455",
      "119801001",
      "Pemantau Eksekutif KPI Matriks Multi-Skill dan Kesiapan Kompetensi Tenaga Kerja Pabrik.",
      "FALSE",
      "FALSE",
      "",
      new Date().toISOString()
    ]
  ];
  
  // Tulis data sampel
  sheet.getRange(2, 1, sampleUsers.length, headers.length).setValues(sampleUsers);
  
  // Auto-fit kolom
  for (var c = 1; c <= headers.length; c++) {
    sheet.autoResizeColumn(c);
  }
  
  // Validasi Dropdown Scope Type (Kolom H / 8)
  var scopeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["ALL", "DIVISI", "DEPARTMENT", "PIC"], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange("H2:H100").setDataValidation(scopeRule);
  
  // Validasi Dropdown Status (Kolom J / 10)
  var statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["ACTIVE", "INACTIVE"], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange("J2:J100").setDataValidation(statusRule);
  
  // Validasi Boolean (Kolom O & P / 15 & 16)
  var boolRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["TRUE", "FALSE"], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange("O2:P100").setDataValidation(boolRule);
  
  SpreadsheetApp.getUi().alert("Sheet Manajemen Akun Pengguna ('USER_ACCOUNTS') berhasil dibuat!");
}

/**
 * 2. Web App API Endpoint untuk mengambil data akun secara realtime (GET)
 */
function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("USER_ACCOUNTS") || ss.getActiveSheet();
  var data = sheet.getDataRange().getValues();
  
  if (data.length < 2) {
    return ContentService.createTextOutput(JSON.stringify({ success: true, count: 0, users: [] }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  var users = [];
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    if (!row[1] && !row[3]) continue;
    
    users.push({
      no: row[0],
      username: String(row[1] || '').trim(),
      password: String(row[2] || 'password123').trim(),
      name: String(row[3] || '').trim(),
      role: String(row[4] || 'PIC').trim(),
      department: String(row[5] || '').trim(),
      divisi: String(row[6] || '').trim(),
      scopeType: String(row[7] || 'DEPARTMENT').trim(),
      scopeValue: String(row[8] || '').trim(),
      status: String(row[9] || 'ACTIVE').trim(),
      email: String(row[10] || '').trim(),
      phone: String(row[11] || '').trim(),
      nik: String(row[12] || '').trim(),
      bio: String(row[13] || '').trim(),
      canEditCompetency: String(row[14]).toUpperCase() === 'TRUE',
      canManageUsers: String(row[15]).toUpperCase() === 'TRUE',
      lastLogin: String(row[16] || ''),
      updatedAt: String(row[17] || '')
    });
  }
  
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    sheet: "USER_ACCOUNTS",
    count: users.length,
    timestamp: new Date().toISOString(),
    users: users
  })).setMimeType(ContentService.MimeType.JSON);
}
`;
}

/**
 * Download sample CSV template for User Accounts Management
 */
export function downloadSampleUsersCsv(): void {
  const headers = [
    'No',
    'Username',
    'Password',
    'Nama Lengkap',
    'Role / Hak Akses',
    'Departemen',
    'Divisi',
    'Scope Type',
    'Scope Value',
    'Status',
    'Email',
    'No Telepon',
    'NIK',
    'Bio',
    'Can Edit Competency',
    'Can Manage Users'
  ];

  const sample1 = [
    '1',
    'hr_admin',
    'password123',
    'Mahmud Nurdiansyah',
    'HR Development Admin',
    'Human Resources Development',
    'Human Resources & Corporate Service',
    'ALL',
    'Semua Departemen',
    'ACTIVE',
    'mahmudnurdiansyah4@gmail.com',
    '0819-1932-7912',
    '122108091',
    'Super Administrator Multi-Skill Monitoring Ajinomoto Mojokerto',
    'TRUE',
    'TRUE'
  ];

  const sample2 = [
    '2',
    'fermentasi_pic',
    'fermentasi123',
    'Budi Santoso, S.T.',
    'PIC Departemen Fermentasi',
    'Fermentation Department',
    'Production FI (MSG)',
    'DEPARTMENT',
    'Fermentation Department',
    'ACTIVE',
    'budi.santoso@ajinomoto.co.id',
    '0812-3456-7890',
    '121904102',
    'PIC Matriks Multi-Skill Bagian Fermentasi',
    'TRUE',
    'FALSE'
  ];

  const csvContent = [
    headers.join(','),
    sample1.join(','),
    sample2.join(',')
  ].join('\r\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Template_User_Accounts_Ajinomoto.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Generate Supabase SQL DDL specifically for users_accounts table
 */
export function generateSupabaseSqlForUsersTable(): string {
  return `-- =========================================================================
-- SUPABASE POSTGRESQL DDL: TABEL MASTER AKUN PENGGUNA (users_accounts)
-- Multi-Skill Monitoring System - PT Ajinomoto Indonesia
-- Salin dan jalankan seluruh script ini di Supabase -> SQL Editor -> Run
-- =========================================================================

-- 1. Buat Tabel users_accounts
CREATE TABLE IF NOT EXISTS public.users_accounts (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL DEFAULT 'password123',
  name VARCHAR(255) NOT NULL,
  role VARCHAR(100) NOT NULL DEFAULT 'PIC Departemen',
  department VARCHAR(255) DEFAULT '',
  divisi VARCHAR(255) DEFAULT '',
  scope_type VARCHAR(50) DEFAULT 'ALL',
  scope_value VARCHAR(255) DEFAULT '',
  status VARCHAR(20) DEFAULT 'ACTIVE',
  email VARCHAR(255) DEFAULT '',
  phone VARCHAR(50) DEFAULT '',
  nik VARCHAR(50) DEFAULT '',
  avatar_url TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  signature_image TEXT DEFAULT '',
  can_edit_competency BOOLEAN DEFAULT TRUE,
  can_manage_users BOOLEAN DEFAULT FALSE,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Buat Index Pencarian Cepat
CREATE INDEX IF NOT EXISTS idx_users_accounts_username ON public.users_accounts(username);
CREATE INDEX IF NOT EXISTS idx_users_accounts_email ON public.users_accounts(email);
CREATE INDEX IF NOT EXISTS idx_users_accounts_role ON public.users_accounts(role);
CREATE INDEX IF NOT EXISTS idx_users_accounts_dept ON public.users_accounts(department);

-- 3. Aktifkan Row Level Security (RLS)
ALTER TABLE public.users_accounts ENABLE ROW LEVEL SECURITY;

-- 4. Buat Kebijakan Akses (Policy)
DROP POLICY IF EXISTS "Allow full access for authenticated and anon" ON public.users_accounts;
CREATE POLICY "Allow full access for authenticated and anon" ON public.users_accounts
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 5. Insert Akun Default Awal
INSERT INTO public.users_accounts (
  username, password, name, role, department, divisi, scope_type, scope_value, status, email, phone, nik, bio, can_edit_competency, can_manage_users
) VALUES
  ('hr_admin', 'password123', 'Mahmud Nurdiansyah', 'HR Development Admin', 'Human Resources Development', 'Human Resources & Corporate Service', 'ALL', 'Semua Departemen', 'ACTIVE', 'mahmudnurdiansyah4@gmail.com', '0819-1932-7912', '122108091', 'Super Administrator Multi-Skill Monitoring Ajinomoto Mojokerto', TRUE, TRUE),
  ('fermentasi_pic', 'fermentasi123', 'Budi Santoso, S.T.', 'PIC Departemen Fermentasi', 'Fermentation Department', 'Production FI (MSG)', 'DEPARTMENT', 'Fermentation Department', 'ACTIVE', 'budi.santoso@ajinomoto.co.id', '0812-3456-7890', '121904102', 'PIC Matriks Multi-Skill Bagian Fermentasi', TRUE, FALSE),
  ('packaging_pic', 'packaging123', 'Siti Rahmawati', 'PIC Packaging & Filling', 'Packaging Department', 'Production FP (Food Products)', 'DEPARTMENT', 'Packaging Department', 'ACTIVE', 'siti.rahmawati@ajinomoto.co.id', '0813-9876-5432', '122005214', 'PIC Matriks Multi-Skill Bagian Packaging & Filling', TRUE, FALSE),
  ('qa_pic', 'qa123456', 'Agus Setiawan, S.Si.', 'Quality Assurance PIC', 'Quality Assurance', 'Technical & QA', 'DEPARTMENT', 'Quality Assurance', 'ACTIVE', 'agus.setiawan@ajinomoto.co.id', '0815-6789-0123', '121803119', 'PIC Mutu Laboratorium & Analis Kimia-Mikro', TRUE, FALSE),
  ('eng_supervisor', 'eng12345', 'Hendra Wijaya', 'Section Supervisor Maintenance', 'Engineering & Maintenance', 'Engineering & Utility', 'DEPARTMENT', 'Engineering & Maintenance', 'ACTIVE', 'hendra.wijaya@ajinomoto.co.id', '0821-4567-8901', '121702088', 'Supervisor Pemeliharaan Mesin & Utilitas', TRUE, FALSE),
  ('mgmt_viewer', 'viewer123', 'Ir. Haryono', 'Executive Management Auditor', 'Factory Executive Office', 'Factory Management', 'ALL', 'Semua Departemen', 'ACTIVE', 'haryono.exec@ajinomoto.co.id', '0811-2233-4455', '119801001', 'Pemantau Eksekutif KPI Matriks Multi-Skill', FALSE, FALSE)
ON CONFLICT (username) DO NOTHING;
`;
}

/**
 * Download sample CSV template for Employees Multi-Skill matrix import
 */
export function downloadSampleImportCsv(): void {
  const headers = [
    'No',
    'EMP ID',
    'Nama Karyawan',
    'Divisi',
    'Departemen',
    'Section',
    'Grade',
    'Job Grade',
    'Jabatan',
    'Gender',
    'Tanggal Pensiun',
    'PIC',
    'Tahun',
    'Bulan',
    'FI-1 / H-1',
    'FI-1 / H-2',
    'FI-1 / H-4',
    'FI-1 / H-5,6',
    'FI-2 / Production',
    'FI-2 / Supporting',
    'FP-1 / EMP',
    'FP-1 / Masako Bulk',
    'FP-1 / Liquid',
    'FP-2 / Packaging',
    'FP-2 / Warehouse',
    'QC / Chemical Analysis',
    'QC / Microbiology',
    'QA / Food Safety',
    'Engineering / Mechanical',
    'Engineering / Electrical',
    'Engineering / Automation & PLC',
    'Utility / Boiler & Steam',
    'Utility / Water Treatment (WTP)',
    'Utility / Waste Water (WWTP)',
    'HSE / K3 & Environmental'
  ];

  const sample1 = [
    '1',
    '122108091',
    'Mahmud Nurdiansyah',
    'Production FI (MSG)',
    'Fermentation Department',
    'Section Fermentasi Utama',
    'IV-A',
    'Senior Operator',
    'Leader Line Fermentation',
    'L',
    '2045-12-31',
    'Budi Santoso',
    '2026',
    '2',
    '1', '1', '1', '1', '1', '0', '0', '0', '0', '0', '0', '0', '0', '0', '1', '0', '0', '0', '0', '0', '1'
  ];

  const sample2 = [
    '2',
    '122005214',
    'Siti Rahmawati',
    'Production FP (Food Products)',
    'Packaging Department',
    'Section Packing Masako',
    'III-B',
    'Operator',
    'Operator Packaging Line',
    'P',
    '2048-06-15',
    'Siti Rahmawati',
    '2026',
    '2',
    '0', '0', '0', '0', '0', '0', '1', '1', '1', '1', '0', '0', '0', '1', '0', '0', '0', '0', '0', '0', '1'
  ];

  const csvContent = [
    headers.join(','),
    sample1.join(','),
    sample2.join(',')
  ].join('\r\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Ajinomoto_MultiSkill_Template_Data.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}


