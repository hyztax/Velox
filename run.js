const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

// GPU crash fix
app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();

// Disable sandbox to allow Node.js in renderer
app.commandLine.appendSwitch('no-sandbox');

let mainWindow;
let splash;

function createWindow() {
  // Splash screen
  splash = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    alwaysOnTop: true,
    transparent: true
  });
  splash.loadFile('splash.html');

  // Main window
mainWindow = new BrowserWindow({
  width: 1200,
  height: 800,
  fullscreen: true,
  show: false,
  autoHideMenuBar: true,
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,   // MUST be true
    nodeIntegration: false    // MUST be false
  }
});


  mainWindow.loadFile('main.html');

  mainWindow.once('ready-to-show', () => {
    if (splash) splash.destroy();
    mainWindow.show();
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if ((input.key === 'F12') || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
      event.preventDefault();
    }
  });

  mainWindow.webContents.on('console-message', (event) => {
    event.preventDefault();
  });
}

// Auto-updater setup
autoUpdater.autoDownload = true;

autoUpdater.on('update-available', () => {
  if (mainWindow) mainWindow.webContents.send('update-available');
});

autoUpdater.on('update-downloaded', () => {
  if (mainWindow) mainWindow.webContents.send('update-downloaded');
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Ready',
    message: 'Update downloaded. The app will restart to install.'
  }).then(() => {
    autoUpdater.quitAndInstall(true, true);
  });
});

// IPC from renderer
ipcMain.on('check-for-updates', () => {
  autoUpdater.checkForUpdatesAndNotify();
});

// Open links externally from renderer via IPC fallback
ipcMain.on('open-external', (event, url) => {
  if (url && typeof url === 'string') shell.openExternal(url);
});

// Only check for updates if packaged
app.whenReady().then(() => {
  createWindow();
  if (!app.isPackaged) {
    console.log("Dev mode: auto-updates skipped");
  } else {
    autoUpdater.checkForUpdatesAndNotify();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
