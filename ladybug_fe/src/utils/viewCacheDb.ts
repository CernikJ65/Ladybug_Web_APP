/**
 * IndexedDB helper pro persistenci File objektů napříč taby a okny.
 *
 * localStorage neumí binární data, takže soubory ukládáme do IDB
 * jako ArrayBuffer + metadata a při načtení z nich rekonstruujeme
 * validní File objekty.
 *
 * Soubor: ladybug_fe/src/utils/viewCacheDb.ts
 */

const DB_NAME = 'ladybug_view_cache_db';
const DB_VERSION = 1;
const STORE = 'files';

interface StoredFile {
  name: string;
  type: string;
  lastModified: number;
  data: ArrayBuffer;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Uloží File pod daným klíčem. Tiše ignoruje chyby (IDB může selhat). */
export async function idbSaveFile(key: string, file: File): Promise<void> {
  try {
    const db = await openDb();
    const data = await file.arrayBuffer();
    const record: StoredFile = {
      name: file.name,
      type: file.type,
      lastModified: file.lastModified,
      data,
    };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(record, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  } catch (e) {
    console.warn('[viewCacheDb] save failed for', key, e);
  }
}

/** Načte File podle klíče. Vrací null pokud neexistuje nebo při chybě. */
export async function idbLoadFile(key: string): Promise<File | null> {
  try {
    const db = await openDb();
    const record = await new Promise<StoredFile | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result as StoredFile | undefined);
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (!record) return null;
    return new File([record.data], record.name, {
      type: record.type,
      lastModified: record.lastModified,
    });
  } catch (e) {
    console.warn('[viewCacheDb] load failed for', key, e);
    return null;
  }
}

/** Smaže File podle klíče. Tiše ignoruje chyby. */
export async function idbDeleteFile(key: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  } catch (e) {
    console.warn('[viewCacheDb] delete failed for', key, e);
  }
}