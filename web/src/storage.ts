const DB_NAME = "pokesql-workspace-v1";

async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    let blocked = false;
    request.onupgradeneeded = () => request.result.createObjectStore("workspace");
    request.onsuccess = () => {
      // A blocked open can still succeed later, after the promise rejected.
      // Close that otherwise orphaned connection instead of leaking it.
      if (blocked) { request.result.close(); return; }
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => { blocked = true; reject(new Error("Local storage is blocked by another tab.")); };
  });
}

export async function loadSnapshot(): Promise<Uint8Array | undefined> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("workspace", "readonly");
      const request = tx.objectStore("workspace").get("database");
      tx.oncomplete = () => resolve(request.result instanceof Uint8Array ? request.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}

export async function saveSnapshot(bytes: Uint8Array): Promise<void> {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("workspace", "readwrite");
      tx.objectStore("workspace").put(bytes, "database");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}

export function readLocal<T>(key: string, fallback: T, validate: (value: unknown) => value is T): T {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(`pokesql:${key}`) ?? "null");
    return validate(value) ? value : fallback;
  } catch { return fallback; }
}

export function writeLocal(key: string, value: unknown): boolean {
  try { localStorage.setItem(`pokesql:${key}`, JSON.stringify(value)); return true; }
  catch { return false; }
}

export const isString = (v: unknown): v is string => typeof v === "string";
export const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(isString);
