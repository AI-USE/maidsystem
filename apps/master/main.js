const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const dgram = require('dgram');

let mainWindow;
const devices = new Map(); // Indexed by persistent deviceId
const socketMap = new Map(); // socket.id -> deviceId

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
    const ips = [];

    // Common interface name patterns for Wi-Fi and Ethernet
    const priorityPatterns = [/wi-fi/i, /wlan/i, /ethernet/i, /eth/i, /en\d+/i];
    const virtualPatterns = [/virtual/i, /vbox/i, /vmware/i, /vethernet/i, /loopback/i];

    for (const name of Object.keys(interfaces)) {
        const isVirtual = virtualPatterns.some(p => p.test(name));
        if (isVirtual) continue;

        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                const priority = priorityPatterns.findIndex(p => p.test(name));
                ips.push({
                    address: iface.address,
                    priority: priority === -1 ? 99 : priority
                });
            }
        }
    }

    if (ips.length === 0) return '127.0.0.1';

    // Sort by priority (lower is better)
    ips.sort((a, b) => a.priority - b.priority);
    return ips[0].address;
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
  const sid = socket.id;

  socket.on('REQUEST_PAIRING', (data) => {
      const pDeviceId = data.id || sid; // Fallback to socket id if old client
      socketMap.set(sid, pDeviceId);

      // Auto-approve if already in devices list
      if (devices.has(pDeviceId)) {
          const device = devices.get(pDeviceId);
          device.online = true;
          device.socketId = sid;
          socket.emit('PAIRING_RESULT', { success: true });
          updateDeviceList();
          return;
      }

      pendingApprovals.set(sid, {
          id: sid,
          persistentId: pDeviceId,
          name: data.name || `DEVICE_${sid.substring(0, 4)}`,
          socket: socket
      });
      updatePendingApprovals();
  });

  socket.on('disconnect', () => {
    const pDeviceId = socketMap.get(sid);
    if (pDeviceId && devices.has(pDeviceId)) {
        devices.get(pDeviceId).online = false;
    }
    socketMap.delete(sid);
    pendingApprovals.delete(sid);
    updateDeviceList();
    updatePendingApprovals();
  });

  socket.on('APP_STATE_CHANGED', (state) => {
      const pDeviceId = socketMap.get(sid);
      if (pDeviceId && devices.has(pDeviceId)) {
          devices.get(pDeviceId).activeApp = state.appId;
          updateDeviceList();
      }
  });

  socket.on('CAMERA_FRAME', (data) => {
    const pDeviceId = socketMap.get(sid);
    if (mainWindow && pDeviceId) {
        mainWindow.webContents.send('CAMERA_FRAME_RECEIVED', {
            deviceId: pDeviceId,
            frame: data.frame
        });
    }
  });

  socket.on('CONNECTION_MSG', (data) => {
    const pDeviceId = socketMap.get(sid);
    if (mainWindow && pDeviceId) {
        mainWindow.webContents.send('CONNECTION_MSG_RECEIVED', {
            deviceId: pDeviceId,
            text: data.text
        });
    }
  });

  socket.on('HEARTBEAT', (data) => {
      const pDeviceId = socketMap.get(sid);
      if (pDeviceId && devices.has(pDeviceId)) {
          devices.get(pDeviceId).lastSeen = Date.now();
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

ipcMain.on('APPROVE_PAIRING', (event, sid) => {
    const pending = pendingApprovals.get(sid);
    if (pending) {
        const pId = pending.persistentId;
        devices.set(pId, {
            id: pId,
            socketId: sid,
            name: pending.name,
            online: true,
            activeApp: 'IDLE'
        });
        pending.socket.emit('PAIRING_RESULT', { success: true });
        pendingApprovals.delete(sid);
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
    const device = devices.get(targetId);
    if (device && device.socketId) {
        io.to(device.socketId).emit('ADMIN_REMOTE_CTRL', command);
    }
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

server.listen(3030, '0.0.0.0', () => {
  console.log('Master Server listening on 0.0.0.0:3030');
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
