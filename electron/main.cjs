/**
 * Medsuite-eT — Electron Main Process
 * Starts an Express+SQLite server and loads the Vite-built frontend.
 */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const { createServer } = require('./server.cjs');

let mainWindow;
let serverInstance;

const isDev = !app.isPackaged;

async function startServer() {
  const userDataPath = app.getPath('userData');
  const expressApp = await createServer(userDataPath);

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
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      ...(isDev
        ? {}
        : { additionalArguments: [`--medsuite-api-base=${apiBase}`] }),
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:8080');
    mainWindow.webContents.openDevTools();
  } else {
    // Serve the built frontend from the embedded server so absolute asset
    // paths, client-side routing and the service worker work correctly.
    mainWindow.loadURL(`http://127.0.0.1:${port}`);
  }

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
