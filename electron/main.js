/**
 * Medsuite-eT — Electron Main Process
 * Starts an Express+SQLite server and loads the Vite-built frontend.
 */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const { createServer } = require('./server.js');

let mainWindow;
let serverInstance;

const isDev = !app.isPackaged;

async function startServer() {
  const userDataPath = app.getPath('userData');
  const expressApp = createServer(userDataPath);

  return new Promise((resolve) => {
    const server = expressApp.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      console.log(`Medsuite-eT offline server running on 127.0.0.1:${port}`);
      serverInstance = server;
      resolve(port);
    });
  });
}

async function createWindow() {
  const port = await startServer();
  const apiBase = `http://127.0.0.1:${port}/api/index.php`;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Medsuite-eT Pharmacy',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:8080');
    mainWindow.webContents.openDevTools();
  } else {
    const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
    mainWindow.loadFile(indexPath);
  }

  // Inject API base URL into page context before React app initializes
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(`
      window.__MEDSUITE_API_BASE__ = '${apiBase}';
    `);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (serverInstance) serverInstance.close();
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});
