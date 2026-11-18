import { useEffect, useState } from "react";
import { utcDateKey } from "./daily";

export function useUtcDay(): string {
  const [, setDay] = useState(utcDateKey);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      const now = new Date();
      setDay(utcDateKey(now));
      clearTimeout(timer);
      const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
      timer = setTimeout(refresh, Math.max(1, midnight - now.getTime() + 25));
    };
    refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  // Other interactions can render before the midnight timer or after a system
  // clock adjustment. Always report the date at render time as well.
  return utcDateKey();
}
