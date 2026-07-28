const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const dgram = require('dgram');

let mainWindow;
const devices = new Map(); // Indexed by persistent deviceId
const socketMap = new Map(); // socket.id -> deviceId
const activeDeliveries = new Map(); // itemCode -> { deviceId, roomCode, itemCode, itemName, intervalId, socketId }

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

let actualPort = 3030;
ipcMain.on('GET_LOCAL_IP', (event) => {
    event.reply('LOCAL_IP_RESULT', { ip: getLocalIP(), port: actualPort });
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
          devices.get(pDeviceId).puzzleState = state.puzzleState || 'idle';
          devices.get(pDeviceId).isPaused = state.isPaused || false;
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

    if (data.text && data.text.includes('OVERRIDE_SUBMITTED:')) {
        try {
            const passMatch = data.text.match(/Submitted Passcode proposal:\s*"([^"]+)"/);
            const passcode = passMatch ? passMatch[1] : '';
            if (pDeviceId && devices.has(pDeviceId)) {
                devices.get(pDeviceId).submittedPasscode = passcode;
                updateDeviceList();
            }
        } catch (e) {
            console.error('Error parsing override passcode proposal:', e);
        }
    }

    if (data.text && data.text.includes('MAID_DELIVERY_REQUEST:')) {
        try {
            const roomMatch = data.text.match(/Room:\s*"([^"]+)"/);
            const itemMatch = data.text.match(/Item:\s*"([^"]+)"/);
            const nameMatch = data.text.match(/ItemName:\s*"([^"]+)"/);

            const roomCode = roomMatch ? roomMatch[1] : '';
            const itemCode = itemMatch ? itemMatch[1] : '';
            const itemName = nameMatch ? nameMatch[1] : '';

            if (activeDeliveries.has(itemCode)) {
                clearInterval(activeDeliveries.get(itemCode).intervalId);
            }

            const announceText = `配達要請、部屋${roomCode}、物品${itemName}。`;
            playDiscordTts(announceText);

            const intervalId = setInterval(() => {
                console.log(`Looping delivery request for item: ${itemCode}`);
                playDiscordTts(announceText);
            }, 8000);

            activeDeliveries.set(itemCode, {
                deviceId: pDeviceId,
                roomCode,
                itemCode,
                itemName,
                intervalId,
                socketId: sid
            });

            if (mainWindow) {
                mainWindow.webContents.send('MAID_DELIVERY_ACTIVE', {
                    deviceId: pDeviceId,
                    roomCode,
                    itemCode,
                    itemName
                });
            }
        } catch (e) {
            console.error('Error parsing delivery request:', e);
        }
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

ipcMain.on('CLEAR_MAID_DELIVERY', (event, { itemCode }) => {
    console.log(`CLEAR_MAID_DELIVERY received for item: ${itemCode}`);
    if (activeDeliveries.has(itemCode)) {
        const delivery = activeDeliveries.get(itemCode);
        clearInterval(delivery.intervalId);

        // Notify Discord Voice bot
        playDiscordTts(`物品${delivery.itemName}、配備完了しました。`);

        // Notify connected Child terminal that this item is cleared
        io.to(delivery.socketId).emit('ADMIN_REMOTE_CTRL', {
            type: 'MAID_DELIVERY_CLEARED',
            payload: { itemCode }
        });

        activeDeliveries.delete(itemCode);

        // Notify master renderer to update lists
        if (mainWindow) {
            mainWindow.webContents.send('MAID_DELIVERY_CLEARED_SUCCESS', { itemCode });
        }
    }
});

ipcMain.on('CLEAR_ALL_MAID_DELIVERIES', (event) => {
    for (const [itemCode, delivery] of activeDeliveries.entries()) {
        clearInterval(delivery.intervalId);
    }
    activeDeliveries.clear();
    if (mainWindow) {
        mainWindow.webContents.send('MAID_DELIVERY_RESET');
    }
});

ipcMain.on('SEND_REMOTE_COMMAND', (event, { targetId, command }) => {
  if (command.type === 'PUZZLE_STOP' || command.type === 'PUZZLE_RESTART' || command.type === 'PUZZLE_START') {
    // Clean all deliveries
    for (const [itemCode, delivery] of activeDeliveries.entries()) {
        clearInterval(delivery.intervalId);
    }
    activeDeliveries.clear();

    // Reset all submitted passcodes
    for (const d of devices.values()) {
        d.submittedPasscode = undefined;
    }
    updateDeviceList();

    if (mainWindow) {
        mainWindow.webContents.send('MAID_DELIVERY_RESET');
    }
  }

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
    const ack = Buffer.from(`MAD_OS_MASTER_ACK:${actualPort}`);
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

function startServer(port) {
  server.listen(port, '0.0.0.0', () => {
    actualPort = port;
    console.log(`Master Server successfully listening on 0.0.0.0:${port}`);
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} is in use, trying ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });
}

startServer(3030);

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ==========================================
// Discord Bot & Speech Synthesis (TTS) Integration
// ==========================================
const { Client, GatewayIntentBits } = require('discord.js');
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource
} = require('@discordjs/voice');

let discordClient = null;
let voiceConnection = null;
let audioPlayer = null;
let discordConfig = {
  token: '',
  channelId: ''
};

let emergencyActive = false;
let emergencyInterval = null;
let emergencyText = '';

// Built-in announcements for escape room events
const defaultTriggers = {
  PREPARE: '謎解き準備が完了しました。端末のスタートボタンを押してゲームを開始してください。',
  START: 'ゲームスタート。ミッションを開始します。制限時間は7分です。',
  TIMER_6: '残り時間、6分です。',
  TIMER_5: '残り時間、5分です。',
  TIMER_4: '残り時間、4分です。',
  TIMER_3: '残り時間、3分です。',
  TIMER_2: '残り時間、2分です。',
  TIMER_1: '残り時間、1分です。急いで暗号を解読してください。',
  TIMER_10S: '10',
  TIMER_9S: '9',
  TIMER_8S: '8',
  TIMER_7S: '7',
  TIMER_6S: '6',
  TIMER_5S: '5',
  TIMER_4S: '4',
  TIMER_3S: '3',
  TIMER_2S: '2',
  TIMER_1S: '1',
  FINISH: '制限時間終了。ゲームオーバーです。システムを強制停止します。',
  STOP: '解説が終了しました。お疲れ様でした。',
  RETIRE: '警告、警告。{name}がリタイアしました。',
  CANCEL_RETIRE: 'リタイアが遠隔解除されました。ゲームを継続します。'
};

// Start, stop, or reconfigure Discord Bot connection
function updateDiscordClient(config) {
  discordConfig = { ...discordConfig, ...config };

  if (!discordConfig.token) {
    console.log('No Bot Token provided, shutting down Discord connection.');
    if (discordClient) {
      discordClient.destroy();
      discordClient = null;
    }
    sendDiscordStatus('DISCONNECTED');
    return;
  }

  if (discordClient) {
    discordClient.destroy();
  }

  sendDiscordStatus('CONNECTING');

  discordClient = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessages
    ]
  });

  discordClient.on('ready', async () => {
    console.log(`Discord Bot successfully logged in as: ${discordClient.user.tag}`);
    sendDiscordStatus('CONNECTED');
    joinVoice(discordConfig.channelId);
  });

  discordClient.on('error', (err) => {
    console.error('Discord Client error event:', err);
    sendDiscordStatus('ERROR');
  });

  discordClient.login(discordConfig.token).catch(err => {
    console.error('Failed to login to Discord:', err);
    sendDiscordStatus('ERROR');
  });
}

// Connect the bot to the specified voice channel
function joinVoice(channelId) {
  if (!discordClient || !channelId) return;

  try {
    const channel = discordClient.channels.cache.get(channelId);
    if (!channel || channel.type !== 2) { // 2 is GuildVoice
      console.error('Voice channel not found or is not a GuildVoice channel.');
      return;
    }

    voiceConnection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: false
    });

    audioPlayer = createAudioPlayer();
    voiceConnection.subscribe(audioPlayer);
    console.log(`Joined Discord Voice Channel: "${channel.name}"`);
  } catch (err) {
    console.error('Failed to join Discord voice channel:', err);
  }
}

// Play TTS stream directly into the Discord Voice connection
function playDiscordTts(text) {
  if (!audioPlayer || !text) {
    console.log('Discord audio player is not connected, skipped playing TTS.');
    return;
  }

  try {
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=ja&client=tw-ob`;
    const resource = createAudioResource(ttsUrl);
    audioPlayer.play(resource);
    console.log(`Dispatched Voice TTS to channel: "${text}"`);
  } catch (err) {
    console.error('Failed to play Discord TTS stream:', err);
  }
}

function sendDiscordStatus(status) {
  if (mainWindow) {
    mainWindow.webContents.send('DISCORD_STATUS_UPDATE', { status });
  }
}

// IPC Listener hooks for Discord and config settings
ipcMain.on('UPDATE_DISCORD_CONFIG', (event, config) => {
  updateDiscordClient(config);
});

ipcMain.on('TRIGGER_DISCORD_TTS', (event, { triggerKey, fallbackText, variables }) => {
  if (emergencyActive && triggerKey !== 'RETIRE' && triggerKey !== 'CANCEL_RETIRE') {
    console.log(`TTS trigger "${triggerKey}" blocked because emergency state is active.`);
    return;
  }

  let template = defaultTriggers[triggerKey] || fallbackText;
  if (template) {
    if (variables) {
      for (const [key, val] of Object.entries(variables)) {
        template = template.replace(new RegExp(`{${key}}`, 'g'), val);
      }
    }
    playDiscordTts(template);
  }
});

ipcMain.on('SET_EMERGENCY_STATE', (event, { active, name }) => {
  console.log(`SET_EMERGENCY_STATE received: active = ${active}, name = ${name}`);

  if (active) {
    emergencyActive = true;

    if (audioPlayer) {
      try {
        audioPlayer.stop();
      } catch (err) {
        console.error('Failed to stop audio player on emergency:', err);
      }
    }

    const devName = name || '端末';
    emergencyText = `警告、警告。${devName}がリタイアしました。親機での解除を待機しています。`;

    if (emergencyInterval) {
      clearInterval(emergencyInterval);
    }

    playDiscordTts(emergencyText);

    // Loop/Repeat every 8 seconds to continuously broadcast the emergency warning
    emergencyInterval = setInterval(() => {
      if (emergencyActive) {
        console.log(`Looping emergency Discord TTS: "${emergencyText}"`);
        playDiscordTts(emergencyText);
      }
    }, 8000);

  } else {
    emergencyActive = false;
    if (emergencyInterval) {
      clearInterval(emergencyInterval);
      emergencyInterval = null;
    }

    if (audioPlayer) {
      try {
        audioPlayer.stop();
      } catch (err) {
        console.error('Failed to stop audio player on emergency clearance:', err);
      }
    }

    console.log('Emergency state cleared on Discord Voice Bot.');
  }
});

let resultsLoopInterval = null;

ipcMain.on('START_RESULTS_LOOP', (event) => {
    console.log('START_RESULTS_LOOP received.');
    if (resultsLoopInterval) clearInterval(resultsLoopInterval);

    playDiscordTts("お疲れ様でした。これより成功者と、おしかった人を発表します。");
    resultsLoopInterval = setInterval(() => {
        playDiscordTts("お疲れ様でした。これより成功者と、おしかった人を発表します。");
    }, 8000);
});

ipcMain.on('STOP_RESULTS_LOOP', (event) => {
    console.log('STOP_RESULTS_LOOP received.');
    if (resultsLoopInterval) {
        clearInterval(resultsLoopInterval);
        resultsLoopInterval = null;
    }
});
