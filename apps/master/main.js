const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const dgram = require('dgram');

let mainWindow;
const devices = new Map();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: '#0f0f11',
    webPreferences: {
      nodeIntegration: false,
      contextBridge: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const isDev = process.env.NODE_ENV === 'development';
  const startUrl = isDev
    ? (process.env.VITE_DEV_SERVER_URL || 'http://localhost:5174')
    : `file://${path.join(__dirname, 'dist/index.html')}`;

  mainWindow.loadURL(startUrl);
}

const os = require('os');
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

ipcMain.on('GET_LOCAL_IP', (event) => {
    event.reply('LOCAL_IP_RESULT', getLocalIP());
});

// Socket.io Server Setup
const serverApp = express();
const server = http.createServer(serverApp);
const io = new Server(server, {
  cors: { origin: "*" }
});

io.on('connection', (socket) => {
  const deviceId = socket.id;
  devices.set(deviceId, { id: deviceId, online: true, activeApp: 'IDLE' });

  updateDeviceList();

  socket.on('disconnect', () => {
    devices.delete(deviceId);
    updateDeviceList();
  });

  socket.on('APP_STATE_CHANGED', (state) => {
      if (devices.has(deviceId)) {
          devices.get(deviceId).activeApp = state.appId;
          updateDeviceList();
      }
  });

  socket.on('CAMERA_FRAME', (data) => {
    if (mainWindow) {
        mainWindow.webContents.send('CAMERA_FRAME_RECEIVED', {
            deviceId,
            frame: data.frame
        });
    }
  });
});

function updateDeviceList() {
    if (mainWindow) {
        mainWindow.webContents.send('DEVICES_UPDATED', Array.from(devices.values()));
    }
}

ipcMain.on('SEND_REMOTE_COMMAND', (event, { targetId, command }) => {
  if (targetId === 'all') {
    io.emit('ADMIN_REMOTE_CTRL', command);
  } else {
    io.to(targetId).emit('ADMIN_REMOTE_CTRL', command);
  }
});

// UDP Discovery Listener
const udpSocket = dgram.createSocket('udp4');
udpSocket.on('message', (msg, rinfo) => {
  if (msg.toString() === 'MAD_OS_DISCOVERY') {
    const ack = Buffer.from('MAD_OS_MASTER_ACK');
    udpSocket.send(ack, rinfo.port, rinfo.address);
  }
});
udpSocket.bind(3031);

server.listen(3030, () => {
  console.log('Master Server listening on port 3030');
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
