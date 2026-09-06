import { Employee } from '../types';

const DB_NAME = 'MSM_STORAGE_DB';
const DB_VERSION = 1;
const STORE_NAME = 'employees_store';
const RECORD_KEY = 'authoritative_employees_list';

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error || new Error('Failed to open IndexedDB'));
    };
  });
}

/**
 * Save employees to IndexedDB without any 5MB localStorage limit restrictions.
 * Can store tens of thousands of records safely.
 */
export async function saveEmployeesToIndexedDB(employees: Employee[]): Promise<boolean> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(employees, RECORD_KEY);

      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  } catch (err) {
    console.warn('[IndexedDB] Save employees failed:', err);
    return false;
  }
}

/**
 * Retrieve stored employees list from IndexedDB.
 */
export async function getEmployeesFromIndexedDB(): Promise<Employee[] | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(RECORD_KEY);

      req.onsuccess = () => {
        const result = req.result;
        if (Array.isArray(result) && result.length > 0) {
          resolve(result);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    console.warn('[IndexedDB] Get employees failed:', err);
    return null;
  }
}

/**
 * Clear employees store from IndexedDB
 */
export async function clearEmployeesIndexedDB(): Promise<boolean> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(RECORD_KEY);

      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  } catch (err) {
    console.warn('[IndexedDB] Clear employees failed:', err);
    return false;
  }
}
