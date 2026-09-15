export function prepareOffline(onStatus: (status: string) => void): () => void {
  let disposed = false;
  const report = (text: string) => { if (!disposed) onStatus(text); };
  if (location.protocol === "pokesql:") { report("Available offline"); return () => { disposed = true; }; }
  if (!import.meta.env.PROD) { report("Development mode"); return () => { disposed = true; }; }
  if (!("serviceWorker" in navigator)) { report("Offline caching unavailable"); return () => { disposed = true; }; }
  report("Preparing offline access…");
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).then(registration => {
    if (registration.active) report("Available offline");
    const track = () => {
      const installing = registration.installing;
      installing?.addEventListener("statechange", () => {
        if (installing.state === "activated") report("Available offline");
        if (installing.state === "installed" && registration.active) report("Update ready — reopen all PokéSQL tabs");
        if (installing.state === "redundant") report("Offline download failed — reload to retry");
      });
    };
    track();
    registration.addEventListener("updatefound", track);
    if (registration.waiting) report("Update ready — reopen all PokéSQL tabs");
  }).catch(() => report("Offline download failed — reload to retry"));
  return () => { disposed = true; };
}
