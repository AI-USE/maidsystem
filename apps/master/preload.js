const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  send: (channel, data) => {
    const validChannels = [
      'SEND_REMOTE_COMMAND',
      'GET_LOCAL_IP',
      'APPROVE_PAIRING',
      'REJECT_PAIRING',
      'REMOVE_DEVICE',
      'UPDATE_DISCORD_CONFIG',
      'TRIGGER_DISCORD_TTS',
      'SET_EMERGENCY_STATE',
      'CLEAR_MAID_DELIVERY',
      'CLEAR_ALL_MAID_DELIVERIES'
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  on: (channel, func) => {
    const validChannels = [
      'DEVICES_UPDATED',
      'CAMERA_FRAME_RECEIVED',
      'CONNECTION_MSG_RECEIVED',
      'LOCAL_IP_RESULT',
      'PENDING_APPROVALS_UPDATED',
      'DISCORD_STATUS_UPDATE',
      'MAID_DELIVERY_ACTIVE',
      'MAID_DELIVERY_CLEARED_SUCCESS',
      'MAID_DELIVERY_RESET'
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  },
  removeListener: (channel, func) => {
    ipcRenderer.removeListener(channel, func);
  }
});
