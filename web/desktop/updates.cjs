// Updates stay in the main process. The renderer keeps its local-only session,
// CSP and lack of Node/preload access.
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

function startUpdates(updater, notify, logger = console) {
  updater.autoDownload = true;
  updater.autoInstallOnAppQuit = true;
  updater.autoRunAppAfterInstall = false;
  updater.allowPrerelease = false;
  updater.allowDowngrade = false;
  updater.disableWebInstaller = false;
  updater.logger = logger;
  let stopped = false;
  let announcedVersion;
  const onError = error => logger.warn('PokéSQL update unavailable; the installed app remains usable.', error);
  const onDownloaded = info => {
    if (stopped || info.version === announcedVersion) return;
    announcedVersion = info.version;
    Promise.resolve().then(() => { if (!stopped) return notify(info.version); }).catch(onError);
  };
  updater.on('error', onError);
  updater.on('update-downloaded', onDownloaded);
  const check = () => {
    // electron-updater emits check/download failures through the error listener.
    // Consume the rejected check promise as well, without blocking app startup.
    if (!stopped) void updater.checkForUpdates().then(result => result?.downloadPromise).catch(() => {});
  };
  check();
  const timer = setInterval(check, CHECK_INTERVAL_MS);
  timer.unref();
  return () => {
    stopped = true;
    clearInterval(timer);
    updater.off('update-downloaded', onDownloaded);
    // Keep the error listener until process exit: a request may still be ending.
  };
}

module.exports = { startUpdates };
