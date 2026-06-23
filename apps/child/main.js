const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const dgram = require('dgram');

let mainWindow;
let isAllowExit = false;
const EXIT_PASSWORD = 'MADREST104';

function createWindow() {
  mainWindow = new BrowserWindow({
    fullscreen: true,
    kiosk: true,
    alwaysOnTop: true,
    frame: false,
    backgroundColor: '#000000',
    webPreferences: {
      nodeIntegration: false,
      contextBridge: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const isDev = process.env.NODE_ENV === 'development';
  const startUrl = isDev
    ? (process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173')
    : `file://${path.join(__dirname, 'dist/index.html')}`;

  mainWindow.loadURL(startUrl);

  mainWindow.on('close', (e) => {
    if (!isAllowExit) {
      e.preventDefault();
      mainWindow.webContents.send('SHOW_EXIT_MODAL');
    }
  });

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}

ipcMain.on('VERIFY_EXIT_PASSWORD', (event, password) => {
  if (password === EXIT_PASSWORD) {
    isAllowExit = true;
    app.quit();
  } else {
    event.reply('EXIT_PASSWORD_RESULT', false);
  }
});

const udpSocket = dgram.createSocket('udp4');
ipcMain.on('START_DISCOVERY', (event) => {
  const message = Buffer.from('MAD_OS_DISCOVERY');
  udpSocket.setBroadcast(true);

  const discoveryInterval = setInterval(() => {
    udpSocket.send(message, 3031, '255.255.255.255');
  }, 5000);

  udpSocket.on('message', (msg, rinfo) => {
    if (msg.toString() === 'MAD_OS_MASTER_ACK') {
      const masterUrl = `http://${rinfo.address}:3030`;
      event.reply('MASTER_FOUND', masterUrl);
    }
  });

  app.on('will-quit', () => {
    clearInterval(discoveryInterval);
    udpSocket.close();
  });
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
