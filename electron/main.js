import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

// Fix for minimize freezing issue
app.commandLine.appendSwitch('disable-renderer-backgrounding');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    resizable: true, // Ensuring window can be resized
    webPreferences: {
      backgroundThrottling: false, // Additional fix for minimize freezing
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    // Load from Vite dev server
    win.loadURL('http://localhost:3000');
    win.webContents.openDevTools();
  } else {
    // Load built index.html
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
