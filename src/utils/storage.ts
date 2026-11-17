import type { RecordedClip } from '../types/recorder';

const DB_NAME = 'framezero_clips_db';
const DB_VERSION = 2;
const STORE_NAME = 'clips';
const CHUNKS_STORE = 'recording_chunks';

interface StoredClipRecord extends Omit<RecordedClip, 'blobUrl'> {
  blob: Blob;
}

interface StoredChunkRecord {
  key: string;
  sessionId: string;
  seq: number;
  chunk: Blob;
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
      if (!db.objectStoreNames.contains(CHUNKS_STORE)) {
        const chunkStore = db.createObjectStore(CHUNKS_STORE, { keyPath: 'key' });
        chunkStore.createIndex('sessionId', 'sessionId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function appendChunkToDB(
  sessionId: string,
  seq: number,
  chunk: Blob
): Promise<void> {
  const db = await openDB();
  const record: StoredChunkRecord = {
    key: `${sessionId}_${String(seq).padStart(8, '0')}`,
    sessionId,
    seq,
    chunk,
  };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(CHUNKS_STORE, 'readwrite');
    tx.objectStore(CHUNKS_STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function assembleChunksFromDB(
  sessionId: string,
  mimeType: string
): Promise<Blob | null> {
  const db = await openDB();
  const records = await new Promise<StoredChunkRecord[]>((resolve, reject) => {
    const tx = db.transaction(CHUNKS_STORE, 'readonly');
    const index = tx.objectStore(CHUNKS_STORE).index('sessionId');
    const req = index.getAll(IDBKeyRange.only(sessionId));
    req.onsuccess = () => resolve(req.result as StoredChunkRecord[]);
    req.onerror = () => reject(req.error);
  });
  db.close();

  if (records.length === 0) return null;
  records.sort((a, b) => a.seq - b.seq);
  return new Blob(
    records.map((r) => r.chunk),
    { type: mimeType }
  );
}

export async function clearSessionChunksFromDB(sessionId: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(CHUNKS_STORE, 'readwrite');
    const store = tx.objectStore(CHUNKS_STORE);
    const index = store.index('sessionId');
    const req = index.getAllKeys(IDBKeyRange.only(sessionId));
    req.onsuccess = () => {
      const keys = req.result;
      for (const k of keys) {
        store.delete(k);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
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
