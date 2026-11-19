import { isCaptureReceipt } from "./validation";
import type { CaptureReceipt } from "./types";

const PREFIX = "pokesql:pc-pending:";

// One key per verified reward avoids read/modify/write races between tabs.
// This outbox bridges the existing game saves and the separate collection DB.
export function queueCapture(receipt: CaptureReceipt): void {
  try {
    const key = PREFIX + receipt.id;
    if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(receipt));
  } catch { /* The in-memory queue remains available; the UI reports failed saves. */ }
}

export function pendingCaptures(): CaptureReceipt[] {
  const receipts: CaptureReceipt[] = [];
  try {
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (!key?.startsWith(PREFIX)) continue;
      try {
        const receipt: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
        if (isCaptureReceipt(receipt) && key === PREFIX + receipt.id) receipts.push(receipt);
      } catch { /* Preserve unreadable original bytes instead of replacing them. */ }
    }
  } catch { /* IndexedDB may still work when localStorage is blocked. */ }
  return receipts;
}

export function acknowledgeCapture(receipt: CaptureReceipt): void {
  try {
    const key = PREFIX + receipt.id;
    const stored: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
    if (isCaptureReceipt(stored) && stored.id === receipt.id) localStorage.removeItem(key);
  } catch { /* Re-reading a committed reward is safe and idempotent. */ }
}
