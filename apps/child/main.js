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
  admin: process.env.MADOS_PASS_ADMIN || 'ADMIN_DASH',
  setup: process.env.MADOS_PASS_SETUP || 'ADMIN_SETUP'
};

function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            const data = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

            // User-configured values in file take precedence over environment variables
            PASSWORDS.exit = data.passwords?.exit || process.env.MADOS_PASS_EXIT || PASSWORDS.exit;
            PASSWORDS.event = data.passwords?.event || process.env.MADOS_PASS_EVENT || PASSWORDS.event;
            PASSWORDS.admin = data.passwords?.admin || process.env.MADOS_PASS_ADMIN || PASSWORDS.admin;
            PASSWORDS.setup = data.passwords?.setup || process.env.MADOS_PASS_SETUP || PASSWORDS.setup;

            if (data.kiosk !== undefined) kioskMode = data.kiosk;
            console.log('Config loaded into memory (Priority: Config File > Env):', PASSWORDS);
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
  // Re-read env vars just in case they were updated in the environment (unlikely but possible if using a watch tool)
  const exitPass = process.env.MADOS_PASS_EXIT || PASSWORDS.exit;
  const eventPass = process.env.MADOS_PASS_EVENT || PASSWORDS.event;
  const adminPass = process.env.MADOS_PASS_ADMIN || PASSWORDS.admin;
  const setupPass = process.env.MADOS_PASS_SETUP || PASSWORDS.setup;

  console.log('Verifying password:', password, 'against:', { exitPass, eventPass, adminPass, setupPass });

  if (password === exitPass) {
    isAllowExit = true;
    app.exit(0);
  } else if (password === eventPass) {
    event.reply('PASSWORD_ACTION', 'TRIGGER_EVENT');
  } else if (password === adminPass) {
    event.reply('PASSWORD_ACTION', 'BOOT_ADMIN_DESKTOP');
  } else if (password === setupPass) {
    event.reply('PASSWORD_ACTION', 'SHOW_SETUP');
  } else {
    event.reply('PASSWORD_RESULT', false);
  }
});

ipcMain.on('VERIFY_SETUP_PASSWORD', (event, password) => {
  const setupPass = process.env.MADOS_PASS_SETUP || PASSWORDS.setup;
  console.log('Verifying setup password:', password, 'against:', setupPass);
  if (password === setupPass) {
    event.reply('PASSWORD_ACTION', 'SHOW_SETUP');
  } else {
    event.reply('PASSWORD_RESULT', false);
  }
});

ipcMain.on('EXIT_APP', () => {
  isAllowExit = true;
  app.exit(0);
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
        // Explicit UI updates ALWAYS take precedence
        PASSWORDS.exit = config.passwords.exit || PASSWORDS.exit;
        PASSWORDS.event = config.passwords.event || PASSWORDS.event;
        PASSWORDS.admin = config.passwords.admin || PASSWORDS.admin;
        PASSWORDS.setup = config.passwords.setup || PASSWORDS.setup;
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
    const data = msg.toString();
    if (data.startsWith('MAD_OS_MASTER_ACK')) {
      const port = data.split(':')[1] || '3030';
      const masterUrl = `http://${rinfo.address}:${port}`;
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
