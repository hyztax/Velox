const { contextBridge, shell } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openExternal: (url) => {
    if (url && typeof url === 'string') {
      // Open link in the default system browser
      shell.openExternal(url).catch(err => console.error('Failed to open link:', err));
    }
  }
});
