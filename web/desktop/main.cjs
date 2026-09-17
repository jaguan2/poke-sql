const { app, BrowserWindow, protocol, session } = require('electron');
const path = require('node:path');
const { readFile } = require('node:fs/promises');

protocol.registerSchemesAsPrivileged([{ scheme: 'pokesql', privileges: {
  standard: true, secure: true, supportFetchAPI: true, corsEnabled: true,
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
      const mimeTypes = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.png': 'image/png', '.svg': 'image/svg+xml', '.sqlite': 'application/octet-stream' };
      const headers = new Headers({ 'Content-Type': mimeTypes[path.extname(filename)] ?? 'application/octet-stream' });
      headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-src 'none'");
      return new Response(content, { headers });
    } catch { return new Response('Not found', { status: 404 }); }
  });
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: !details.url.startsWith('pokesql://app/') && !details.url.startsWith('devtools:') });
  });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
