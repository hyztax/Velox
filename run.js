const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    fullscreen: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  const onlineURL = 'https://hyztax.github.io/Velox/';
  mainWindow.loadURL(onlineURL).catch(() => mainWindow.loadFile('index.html'));

  mainWindow.on('restore', () => mainWindow.reload());

  // Hide the desktop download button in the app
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(`
      const btn = document.querySelector('.download-btn');
      if (btn) btn.style.display = 'none';
    `).catch(console.error);
  });

  // Disable DevTools (F12 / Ctrl+Shift+I)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if ((input.key === 'F12') || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
      event.preventDefault();
    }
  });

  // Suppress console messages from renderer
  mainWindow.webContents.on('console-message', (event, level, message) => {
    // Uncomment below to debug
    // console.log('Renderer log:', level, message);
    event.preventDefault();
  });
}

// Auto-updater setup
autoUpdater.autoDownload = true;

autoUpdater.on('update-available', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Available',
    message: 'A new version of Velox is available. Downloading now...'
  });
  mainWindow.webContents.send('update-available');
});

autoUpdater.on('update-downloaded', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Ready',
    message: 'Update downloaded. The app will restart to install.'
  }).then(() => autoUpdater.quitAndInstall(true, true));
  mainWindow.webContents.send('update-downloaded');
});

// IPC: manual update check from renderer
ipcMain.on('check-for-updates', () => {
  autoUpdater.checkForUpdatesAndNotify();
});

// App ready
app.whenReady().then(() => {
  createWindow();
  autoUpdater.checkForUpdatesAndNotify();
});

// App lifecycle
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
