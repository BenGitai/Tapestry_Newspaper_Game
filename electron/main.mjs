// Desktop shell: opens the game in its own window. No browser UI, no Node access
// for the page. In development it loads the Vite dev server; in a build it loads
// dist/index.html from disk.
//
// Later this process is also where server-side work lives in the packaged game
// (save files, Steamworks). The Anthropic API key is never passed to the page.
import { app, BrowserWindow, Menu, shell } from 'electron';
import { join } from 'node:path';

const devUrl = process.env.VITE_DEV_SERVER_URL;
// `npm run techdemo` opens straight into the summarizer tech demo.
const hash = process.argv.includes('--techdemo') ? 'techdemo' : '';

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    title: 'Tapestry Newspaper Game',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  win.once('ready-to-show', () => win.show());

  // The game never navigates or opens windows. Real links go to the system browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!devUrl || !url.startsWith(devUrl)) e.preventDefault();
  });

  // F11 toggles fullscreen. Dev tools only in development.
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      e.preventDefault();
    } else if (devUrl && input.control && input.shift && input.key.toLowerCase() === 'i') {
      win.webContents.toggleDevTools();
      e.preventDefault();
    }
  });

  if (devUrl) win.loadURL(hash ? `${devUrl}#${hash}` : devUrl);
  else win.loadFile(join(import.meta.dirname, '..', 'dist', 'index.html'), hash ? { hash } : {});
}

Menu.setApplicationMenu(null);

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
