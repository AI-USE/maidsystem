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
  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:5174');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }
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

const pendingApprovals = new Map();

io.on('connection', (socket) => {
  const deviceId = socket.id;

  socket.on('REQUEST_PAIRING', (data) => {
      pendingApprovals.set(deviceId, {
          id: deviceId,
          name: data.name || `DEVICE_${deviceId.substring(0, 4)}`,
          socket: socket
      });
      updatePendingApprovals();
  });

  socket.on('disconnect', () => {
    devices.delete(deviceId);
    pendingApprovals.delete(deviceId);
    updateDeviceList();
    updatePendingApprovals();
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

  socket.on('CONNECTION_MSG', (data) => {
    if (mainWindow) {
        mainWindow.webContents.send('CONNECTION_MSG_RECEIVED', {
            deviceId,
            text: data.text
        });
    }
  });

  socket.on('HEARTBEAT', (data) => {
      if (devices.has(deviceId)) {
          devices.get(deviceId).lastSeen = Date.now();
          updateDeviceList();
      }
  });
});

function updateDeviceList() {
    if (mainWindow) {
        mainWindow.webContents.send('DEVICES_UPDATED', Array.from(devices.values()));
    }
}

function updatePendingApprovals() {
    if (mainWindow) {
        const list = Array.from(pendingApprovals.values()).map(p => ({ id: p.id, name: p.name }));
        mainWindow.webContents.send('PENDING_APPROVALS_UPDATED', list);
    }
}

ipcMain.on('APPROVE_PAIRING', (event, deviceId) => {
    const pending = pendingApprovals.get(deviceId);
    if (pending) {
        devices.set(deviceId, {
            id: deviceId,
            name: pending.name,
            online: true,
            activeApp: 'IDLE'
        });
        pending.socket.emit('PAIRING_RESULT', { success: true });
        pendingApprovals.delete(deviceId);
        updateDeviceList();
        updatePendingApprovals();
    }
});

ipcMain.on('REJECT_PAIRING', (event, deviceId) => {
    const pending = pendingApprovals.get(deviceId);
    if (pending) {
        pending.socket.emit('PAIRING_RESULT', { success: false });
        pendingApprovals.delete(deviceId);
        updatePendingApprovals();
    }
});

ipcMain.on('REMOVE_DEVICE', (event, deviceId) => {
    if (devices.has(deviceId)) {
        devices.delete(deviceId);
        updateDeviceList();
    }
});

ipcMain.on('SEND_REMOTE_COMMAND', (event, { targetId, command }) => {
  if (targetId === 'all') {
    io.emit('ADMIN_REMOTE_CTRL', command);
  } else {
    io.to(targetId).emit('ADMIN_REMOTE_CTRL', command);
  }
});

// UDP Discovery Listener
const udpSocket = dgram.createSocket('udp4');
udpSocket.on('error', (err) => {
  console.error(`UDP socket error:\n${err.stack}`);
  udpSocket.close();
});

udpSocket.on('message', (msg, rinfo) => {
  if (msg.toString() === 'MAD_OS_DISCOVERY') {
    const ack = Buffer.from('MAD_OS_MASTER_ACK');
    udpSocket.send(ack, rinfo.port, rinfo.address);
  }
});

try {
    udpSocket.bind(3031, () => {
        console.log('UDP Discovery Listener bound to port 3031');
    });
} catch (err) {
    console.error('Failed to bind UDP socket:', err);
}

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error('Port 3030 is already in use');
  } else {
    console.error('Server error:', e);
  }
});

server.listen(3030, () => {
  console.log('Master Server listening on port 3030');
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
