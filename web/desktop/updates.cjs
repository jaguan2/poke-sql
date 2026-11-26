// Updates stay in the main process. The renderer keeps its local-only session,
// CSP and lack of Node/preload access.
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const MAX_SETUP_BYTES = 10 * 1024 * 1024;

function startUpdates(updater, notify, logger = console, report = () => {}) {
  updater.autoDownload = true;
  updater.autoInstallOnAppQuit = true;
  updater.autoRunAppAfterInstall = false;
  updater.allowPrerelease = false;
  updater.allowDowngrade = false;
  updater.disableWebInstaller = false;
  updater.logger = logger;
  let stopped = false;
  let announcedVersion;
  let running;
  let manualCheck = false;
  let downloading = false;
  const warn = error => logger.warn('PokéSQL update unavailable; the installed app remains usable.', error);
  const onError = error => {
    warn(error);
    if (!stopped && !announcedVersion) report({ kind: 'failed', visible: manualCheck || downloading });
    downloading = false;
  };
  const onAvailable = () => {
    if (stopped) return;
    downloading = true;
    report({ kind: 'downloading' });
  };
  const onProgress = ({ total, percent }) => {
    // The updater also emits progress for the small web installer. A full
    // payload fallback can be silent, so only show a bar with verified scope.
    if (stopped || !downloading || !(total > MAX_SETUP_BYTES) || !Number.isFinite(percent)) return;
    report({ kind: 'downloading', progress: Math.min(0.99, Math.max(0, percent / 100)) });
  };
  const onDownloaded = info => {
    if (stopped || info.version === announcedVersion) return;
    announcedVersion = info.version;
    downloading = false;
    report({ kind: 'ready' });
    Promise.resolve().then(() => { if (!stopped) return notify(info.version); }).catch(warn);
  };
  updater.on('error', onError);
  updater.on('update-available', onAvailable);
  updater.on('download-progress', onProgress);
  updater.on('update-downloaded', onDownloaded);
  const check = (manual = false) => {
    if (stopped || announcedVersion || running) return running;
    manualCheck = manual;
    if (manual) report({ kind: 'checking' });
    running = Promise.resolve().then(async () => {
      if (stopped) return;
      const result = await updater.checkForUpdates();
      if (result?.downloadPromise) await result.downloadPromise;
      else if (!stopped && manual) report({ kind: 'current' });
    }).catch(() => {
      // electron-updater reports check and download errors through its event.
    }).finally(() => {
      running = undefined;
      manualCheck = false;
    });
    return running;
  };
  check();
  const timer = setInterval(check, CHECK_INTERVAL_MS);
  timer.unref();
  const stop = () => {
    stopped = true;
    clearInterval(timer);
    updater.off('update-available', onAvailable);
    updater.off('download-progress', onProgress);
    updater.off('update-downloaded', onDownloaded);
    // Keep the error listener until process exit: a request may still be ending.
  };
  return { check, stop };
}

module.exports = { startUpdates };
