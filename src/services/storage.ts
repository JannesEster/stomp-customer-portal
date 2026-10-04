import type { StoredFile } from '../types';

/**
 * Where design data and uploaded files live. The real store and upload limits
 * are open questions, so the portal only ever talks to this interface.
 */
export interface StorageProvider {
  loadData<T>(key: string): Promise<T | null>;
  saveData<T>(key: string, value: T): Promise<void>;
  saveFile(file: File): Promise<StoredFile>;
  /** A URL the browser can display, or null if the file is gone. */
  getFileUrl(fileId: string): Promise<string | null>;
  deleteFile(fileId: string): Promise<void>;
}

const DATA_PREFIX = 'stomp-portal:';
const DB_NAME = 'stomp-portal-files';
const STORE = 'files';

interface FileRecord {
  meta: StoredFile;
  blob: Blob;
}

/**
 * Mock: JSON data in localStorage, file blobs in IndexedDB (localStorage is
 * too small for photos and videos). Everything stays in this browser.
 */
export class LocalStorageProvider implements StorageProvider {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private urlCache = new Map<string, string>();

  async loadData<T>(key: string): Promise<T | null> {
    const raw = window.localStorage.getItem(DATA_PREFIX + key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async saveData<T>(key: string, value: T): Promise<void> {
    window.localStorage.setItem(DATA_PREFIX + key, JSON.stringify(value));
  }

  async saveFile(file: File): Promise<StoredFile> {
    const meta: StoredFile = {
      id: crypto.randomUUID(),
      name: file.name,
      type: file.type,
      size: file.size,
    };
    const record: FileRecord = { meta, blob: file };
    await this.request((store) => store.put(record, meta.id), 'readwrite');
    return meta;
  }

  async getFileUrl(fileId: string): Promise<string | null> {
    const cached = this.urlCache.get(fileId);
    if (cached) return cached;
    const record = await this.request<FileRecord | undefined>((store) => store.get(fileId));
    if (!record) return null;
    const url = URL.createObjectURL(record.blob);
    this.urlCache.set(fileId, url);
    return url;
  }

  async deleteFile(fileId: string): Promise<void> {
    const cached = this.urlCache.get(fileId);
    if (cached) {
      URL.revokeObjectURL(cached);
      this.urlCache.delete(fileId);
    }
    await this.request((store) => store.delete(fileId), 'readwrite');
  }

  private openDb(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const open = indexedDB.open(DB_NAME, 1);
        open.onupgradeneeded = () => open.result.createObjectStore(STORE);
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(open.error);
      });
    }
    return this.dbPromise;
  }

  private async request<T>(
    run: (store: IDBObjectStore) => IDBRequest,
    mode: IDBTransactionMode = 'readonly',
  ): Promise<T> {
    const db = await this.openDb();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = run(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result as T);
      tx.onerror = () => reject(tx.error);
    });
  }
}
