// --- Electron App Setup ---
const { app, BrowserWindow } = require('electron');
const path = require('path');

// Workarounds for Windows GPU issues
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();

// Create the main application window
function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // your preload script
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile('index.html'); // your Velox HTML
  // win.webContents.openDevTools(); // optional: enable for debugging
}

// App lifecycle events
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
