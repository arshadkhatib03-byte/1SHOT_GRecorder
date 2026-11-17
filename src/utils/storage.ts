import type { RecordedClip } from '../types/recorder';

const DB_NAME = 'framezero_clips_db';
const DB_VERSION = 1;
const STORE_NAME = 'clips';

interface StoredClipRecord extends Omit<RecordedClip, 'blobUrl'> {
  blob: Blob;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveClipToDB(
  clip: Omit<RecordedClip, 'blobUrl'>,
  blob: Blob
): Promise<RecordedClip> {
  const db = await openDB();
  const record: StoredClipRecord = { ...clip, blob };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  return {
    ...clip,
    blobUrl: URL.createObjectURL(blob),
  };
}

export async function getAllClipsFromDB(): Promise<RecordedClip[]> {
  const db = await openDB();
  const records = await new Promise<StoredClipRecord[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result as StoredClipRecord[]);
    req.onerror = () => reject(req.error);
  });
  db.close();

  return records
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(({ blob, ...meta }) => ({
      ...meta,
      blobUrl: URL.createObjectURL(blob),
    }));
}

export async function getClipBlobFromDB(id: string): Promise<Blob | null> {
  const db = await openDB();
  const record = await new Promise<StoredClipRecord | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve(req.result as StoredClipRecord | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return record?.blob ?? null;
}

export async function renameClipInDB(id: string, newName: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const existing = getReq.result as StoredClipRecord | undefined;
      if (existing) {
        existing.name = newName;
        store.put(existing);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function deleteClipFromDB(id: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
