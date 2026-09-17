export function prepareOffline(onStatus: (status: string) => void): () => void {
  let disposed = false;
  const cleanup: (() => void)[] = [];
  const report = (text: string) => { if (!disposed) onStatus(text); };
  if (location.protocol === "pokesql:") { report("Available offline"); return () => { disposed = true; }; }
  if (!import.meta.env.PROD) { report("Development mode"); return () => { disposed = true; }; }
  if (!("serviceWorker" in navigator)) { report("Offline caching unavailable"); return () => { disposed = true; }; }
  report("Preparing offline access…");
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).then(registration => {
    if (disposed) return;
    if (registration.active) report("Available offline");
    const track = () => {
      const installing = registration.installing;
      if (!installing) return;
      const changed = () => {
        if (installing.state === "activated") report("Available offline");
        if (installing.state === "installed" && registration.active) report("Update ready — reopen all PokéSQL tabs");
        if (installing.state === "redundant") report("Offline download failed — reload to retry");
      };
      installing.addEventListener("statechange", changed);
      cleanup.push(() => installing.removeEventListener("statechange", changed));
      changed();
    };
    track();
    registration.addEventListener("updatefound", track);
    cleanup.push(() => registration.removeEventListener("updatefound", track));
    if (registration.waiting) report("Update ready — reopen all PokéSQL tabs");
  }).catch(() => report("Offline download failed — reload to retry"));
  return () => { disposed = true; cleanup.forEach(remove => remove()); };
}
