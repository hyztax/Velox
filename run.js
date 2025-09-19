const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

// Workarounds for Windows GPU issues
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();

// Create main window
function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile('index.html');
}

// Auto-update setup
autoUpdater.autoDownload = true;

autoUpdater.on('update-available', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Available',
    message: 'A new version of Velox is available. Downloading now...'
  });
});

autoUpdater.on('update-downloaded', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Ready',
    message: 'Update downloaded. The app will restart to install.'
  }).then(() => {
    autoUpdater.quitAndInstall();
  });
});

// App ready
app.whenReady().then(() => {
  createWindow();

  // Dropbox feed URL MUST point to the YAML, not the EXE
  autoUpdater.setFeedURL({
    provider: 'generic',
    url: 'https://www.dropbox.com/s/yourYamlFileID/latest.yml?dl=1'
  });

  autoUpdater.checkForUpdatesAndNotify();
});

// App lifecycle
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
