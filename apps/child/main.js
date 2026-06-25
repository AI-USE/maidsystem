const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const dgram = require('dgram');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

let mainWindow;
let isAllowExit = false;
let kioskMode = true;

const CONFIG_PATH = path.join(app.getPath('userData'), 'mados_config.json');

let PASSWORDS = {
  exit: process.env.MADOS_PASS_EXIT || 'MADREST104',
  event: process.env.MADOS_PASS_EVENT || 'EVT_TRIGGER_99',
  admin: process.env.MADOS_PASS_ADMIN || 'ADMIN_DASH'
};

function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            const data = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

            // Environment variables take precedence if they exist
            PASSWORDS.exit = process.env.MADOS_PASS_EXIT || data.passwords?.exit || PASSWORDS.exit;
            PASSWORDS.event = process.env.MADOS_PASS_EVENT || data.passwords?.event || PASSWORDS.event;
            PASSWORDS.admin = process.env.MADOS_PASS_ADMIN || data.passwords?.admin || PASSWORDS.admin;

            if (data.kiosk !== undefined) kioskMode = data.kiosk;
            console.log('Config loaded into memory:', PASSWORDS);
        }
    } catch (err) {
        console.error('Failed to load config:', err);
    }
}

function saveConfig() {
    try {
        const data = { passwords: PASSWORDS, kiosk: kioskMode };
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(data));
    } catch (err) {
        console.error('Failed to save config:', err);
    }
}

loadConfig();

function createWindow() {
  mainWindow = new BrowserWindow({
    fullscreen: true,
    kiosk: kioskMode,
    alwaysOnTop: true,
    frame: false,
    backgroundColor: '#0f0f11',
    webPreferences: {
      nodeIntegration: false,
      contextBridge: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }

  mainWindow.on('close', (e) => {
    if (!isAllowExit) {
      e.preventDefault();
      mainWindow.webContents.send('SHOW_EXIT_MODAL');
    }
  });

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  setupShortcuts();
}

function setupShortcuts() {
    if (kioskMode) {
        // Disable common escape shortcuts
        globalShortcut.register('Alt+F4', () => console.log('Shortcut blocked: Alt+F4'));
        globalShortcut.register('CommandOrControl+W', () => console.log('Shortcut blocked: Ctrl+W'));
        // We can't easily block Ctrl+Alt+Del from Electron level, but kiosk mode helps on Windows
    }
}

ipcMain.on('VERIFY_PASSWORD', (event, password) => {
  console.log('Verifying password:', password, 'against:', PASSWORDS);
  if (password === PASSWORDS.exit) {
    isAllowExit = true;
    app.quit();
  } else if (password === PASSWORDS.event) {
    event.reply('PASSWORD_ACTION', 'TRIGGER_EVENT');
  } else if (password === PASSWORDS.admin) {
    event.reply('PASSWORD_ACTION', 'SHOW_SETUP');
  } else {
    event.reply('PASSWORD_RESULT', false);
  }
});

ipcMain.on('SET_KIOSK', (event, enabled) => {
    kioskMode = enabled;
    if (mainWindow) {
        mainWindow.setKiosk(enabled);
        if (enabled) {
            setupShortcuts();
        } else {
            globalShortcut.unregisterAll();
        }
    }
    saveConfig();
});

ipcMain.on('UPDATE_CONFIG', (event, config) => {
    console.log('Updating config in main process:', config);
    if (config.passwords) {
        // Only update if environment variables are NOT set
        PASSWORDS.exit = process.env.MADOS_PASS_EXIT || config.passwords.exit;
        PASSWORDS.event = process.env.MADOS_PASS_EVENT || config.passwords.event;
        PASSWORDS.admin = process.env.MADOS_PASS_ADMIN || config.passwords.admin;
    }
    if (config.kiosk !== undefined) {
        kioskMode = config.kiosk;
        if (mainWindow) {
            mainWindow.setKiosk(kioskMode);
            if (kioskMode) setupShortcuts();
            else globalShortcut.unregisterAll();
        }
    }
    saveConfig();
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

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});
