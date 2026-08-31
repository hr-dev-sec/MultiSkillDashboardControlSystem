import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'server', 'data');
const EMPLOYEES_DB_FILE_PATH = path.join(DATA_DIR, 'employees_db.json');

export interface EmployeesDatabaseSchema {
  version: string;
  databaseName: string;
  lastUpdated: string;
  totalEmployees: number;
  employees: any[];
}

let inMemoryEmployeesDb: EmployeesDatabaseSchema | null = null;

export function initEmployeesDatabase(): EmployeesDatabaseSchema {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(EMPLOYEES_DB_FILE_PATH)) {
      const defaultDb: EmployeesDatabaseSchema = {
        version: '2.0',
        databaseName: 'PT Ajinomoto Indonesia - Employees Multi-Skill Database',
        lastUpdated: new Date().toISOString(),
        totalEmployees: 0,
        employees: []
      };
      fs.writeFileSync(EMPLOYEES_DB_FILE_PATH, JSON.stringify(defaultDb, null, 2), 'utf-8');
      inMemoryEmployeesDb = defaultDb;
      return defaultDb;
    }

    const raw = fs.readFileSync(EMPLOYEES_DB_FILE_PATH, 'utf-8');
    const parsed: EmployeesDatabaseSchema = JSON.parse(raw);
    if (!Array.isArray(parsed.employees)) {
      parsed.employees = [];
    }
    parsed.totalEmployees = parsed.employees.length;
    inMemoryEmployeesDb = parsed;
    return parsed;
  } catch (err) {
    console.error('[EmployeeDB] Error initializing employees database:', err);
    inMemoryEmployeesDb = {
      version: '2.0',
      databaseName: 'PT Ajinomoto Indonesia - Employees Multi-Skill Database',
      lastUpdated: new Date().toISOString(),
      totalEmployees: 0,
      employees: []
    };
    return inMemoryEmployeesDb;
  }
}

export function getEmployeesDatabase(): EmployeesDatabaseSchema {
  if (!inMemoryEmployeesDb) {
    return initEmployeesDatabase();
  }
  return inMemoryEmployeesDb;
}

export function persistEmployeesDatabase(employees: any[]): boolean {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    const db: EmployeesDatabaseSchema = {
      version: '2.0',
      databaseName: 'PT Ajinomoto Indonesia - Employees Multi-Skill Database',
      lastUpdated: new Date().toISOString(),
      totalEmployees: employees.length,
      employees
    };

    inMemoryEmployeesDb = db;
    const tempFile = `${EMPLOYEES_DB_FILE_PATH}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(db, null, 2), 'utf-8');
    fs.renameSync(tempFile, EMPLOYEES_DB_FILE_PATH);
    return true;
  } catch (err) {
    console.error('[EmployeeDB] Error persisting employees database:', err);
    return false;
  }
}

export function getAllEmployees(): any[] {
  const db = getEmployeesDatabase();
  return db.employees;
}
