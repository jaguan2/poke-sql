import type { Page } from '@playwright/test';
import type { Collection } from '../../src/features/pc/types';

export function collectionSnapshot(page: Page): Promise<Collection> {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('pokesql-collection-v1', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(['captures', 'metadata'], 'readonly');
      const captures = tx.objectStore('captures').getAll();
      const metadata = tx.objectStore('metadata').get('state');
      tx.oncomplete = () => { db.close(); resolve({ ...metadata.result, captures: captures.result }); };
      tx.onabort = tx.onerror = () => { db.close(); reject(tx.error); };
    };
  }));
}
