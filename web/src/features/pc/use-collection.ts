import { useCallback, useEffect, useRef, useState } from "react";
import { acknowledgeCapture, pendingCaptures, queueCapture } from "./pending";
import { updateCollection } from "./persistence";
import type { CaptureReceipt, Collection, CollectionCommand, LegacyImport } from "./types";

export function useCollection(readLegacy: () => LegacyImport) {
  const [collection, setCollection] = useState<Collection | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const pending = useRef(new Map<string, CaptureReceipt>());
  const channel = useRef<BroadcastChannel | null>(null);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const workCount = useRef(0);
  const enqueue = useCallback((work: () => Promise<boolean>) => {
    workCount.current++; setBusy(true);
    const result = chain.current.then(work, work).finally(() => {
      workCount.current--; if (!workCount.current) setBusy(false);
    });
    chain.current = result;
    return result;
  }, []);

  const flush = useCallback(async () => {
    for (const receipt of pendingCaptures()) pending.current.set(receipt.id, receipt);
    const receipts = [...pending.current.values()];
    try {
      const next = await updateCollection(readLegacy(), { type: "deposit", receipts });
      for (const receipt of receipts) { acknowledgeCapture(receipt); pending.current.delete(receipt.id); }
      setCollection(next); setError("");
      if (receipts.length) channel.current?.postMessage("changed");
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "PC storage is unavailable.");
      return false;
    } finally { setPendingCount(pending.current.size); }
  }, [readLegacy]);
  const retry = useCallback(() => enqueue(flush), [enqueue, flush]);
  const award = useCallback((receipt: CaptureReceipt) => {
    queueCapture(receipt); pending.current.set(receipt.id, receipt); setPendingCount(pending.current.size);
    return enqueue(flush);
  }, [enqueue, flush]);
  const command = useCallback((action: CollectionCommand) => enqueue(async () => {
    try {
      const next = await updateCollection(readLegacy(), action);
      setCollection(next); setError(""); channel.current?.postMessage("changed");
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "PC changes could not be saved.");
      return false;
    }
  }), [enqueue, readLegacy]);

  useEffect(() => {
    const connection = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("pokesql-pc");
    channel.current = connection;
    if (connection) connection.onmessage = () => { void retry(); };
    void retry();
    return () => { connection?.close(); channel.current = null; };
  }, [retry]);
  return { collection, error, busy, pendingCount, award, command, retry };
}
