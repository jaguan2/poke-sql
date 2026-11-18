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
