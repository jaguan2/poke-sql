const { app, BrowserWindow, dialog, Menu, protocol, session } = require('electron');
const path = require('node:path');
const { readFile } = require('node:fs/promises');
const { parseByteRange } = require('./byte-range.cjs');
const { startUpdates } = require('./updates.cjs');

if (process.platform === 'win32') app.setAppUserModelId('com.pokesql.app');

protocol.registerSchemesAsPrivileged([{ scheme: 'pokesql', privileges: {
  standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true,
} }]);

const testing = process.env.POKESQL_TEST === '1';
if (testing && process.env.POKESQL_TEST_DATA) app.setPath('userData', process.env.POKESQL_TEST_DATA);
let window;
// Each renderer keeps its own SQLite snapshot. A second process using the same
// profile could overwrite saved changes with a stale copy.
const primaryInstance = app.requestSingleInstanceLock();
if (!primaryInstance) app.quit();
app.on('second-instance', () => {
  if (!window || window.isDestroyed()) return;
  if (window.isMinimized()) window.restore();
  if (!testing) window.show();
  window.focus();
});

function createWindow() {
  window = new BrowserWindow({
    width: 1280, height: 860, minWidth: 760, minHeight: 600,
    title: 'PokéSQL', backgroundColor: '#16181d', show: false,
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
  });
  window.removeMenu();
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (url !== 'pokesql://app/index.html') event.preventDefault();
  });
  window.once('ready-to-show', () => { if (!testing) window.show(); });
  window.loadURL('pokesql://app/index.html');
}

function configureUpdates(window) {
  const { autoUpdater } = require('electron-updater');
  const menu = Menu.buildFromTemplate([{ label: '&Updates', submenu: [
    { id: 'check', label: 'Check for updates', click: () => void updates.check(true) },
  ] }]);
  window.setMenu(menu);
  const checkItem = menu.getMenuItemById('check');
  const titles = { checking: 'Checking for updates…', current: 'Up to date', downloading: 'Downloading update…', ready: 'Update ready', failed: 'Update unavailable' };
  const updates = startUpdates(autoUpdater, version => {
    if (window.isDestroyed()) return;
    return dialog.showMessageBox(window, { type: 'info', title: 'PokéSQL update ready',
      message: `PokéSQL ${version} is ready to install.`,
      detail: 'Finish your work, then close PokéSQL normally. The update will install after you close it. Your saved SQL, database edits and Pokédex progress stay on this device.',
      buttons: ['Keep working'], defaultId: 0, noLink: true });
  }, console, status => {
    if (window.isDestroyed()) return;
    const downloading = status.kind === 'downloading';
    checkItem.enabled = !downloading && status.kind !== 'checking' && status.kind !== 'ready';
    checkItem.label = status.kind === 'failed' ? 'Retry update check' : 'Check for updates';
    if (status.kind !== 'failed' || status.visible) window.setTitle(`PokéSQL — ${titles[status.kind]}`);
    window.setProgressBar(downloading ? status.progress ?? 2 : -1);
  });
  app.once('before-quit', updates.stop);
}

app.whenReady().then(() => {
  if (!primaryInstance) return;
  const root = path.resolve(__dirname, '../dist');
  protocol.handle('pokesql', async request => {
    const url = new URL(request.url);
    if (url.hostname !== 'app' || request.method !== 'GET') return new Response('Not found', { status: 404 });
    let requested;
    try { requested = decodeURIComponent(url.pathname); } catch { return new Response('Invalid path', { status: 400 }); }
    const filename = path.resolve(root, '.' + (requested === '/' ? '/index.html' : requested));
    const relative = path.relative(root, filename);
    if (relative.startsWith('..') || path.isAbsolute(relative)) return new Response('Not found', { status: 404 });
    try {
      const content = await readFile(filename);
      const mimeTypes = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.sqlite': 'application/octet-stream', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.txt': 'text/plain; charset=utf-8' };
      const headers = new Headers({ 'Content-Type': mimeTypes[path.extname(filename)] ?? 'application/octet-stream' });
      headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-src 'none'");
      if (['.mp3', '.wav'].includes(path.extname(filename))) {
        headers.set('Accept-Ranges', 'bytes');
        const rangeHeader = request.headers.get('Range');
        if (rangeHeader) {
          const range = parseByteRange(rangeHeader, content.length);
          if (!range) {
            headers.set('Content-Range', `bytes */${content.length}`);
            return new Response(null, { status: 416, headers });
          }
          headers.set('Content-Range', `bytes ${range.start}-${range.end}/${content.length}`);
          headers.set('Content-Length', String(range.end - range.start + 1));
          return new Response(content.subarray(range.start, range.end + 1), { status: 206, headers });
        }
        headers.set('Content-Length', String(content.length));
      }
      return new Response(content, { headers });
    } catch { return new Response('Not found', { status: 404 }); }
  });
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: !details.url.startsWith('pokesql://app/') && !details.url.startsWith('devtools:') });
  });
  createWindow();
  if (app.isPackaged && process.platform === 'win32' && !testing && !process.env.PORTABLE_EXECUTABLE_FILE) {
    configureUpdates(window);
  }
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
