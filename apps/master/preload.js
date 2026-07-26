const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  send: (channel, data) => {
    const validChannels = ['SEND_REMOTE_COMMAND', 'GET_LOCAL_IP', 'APPROVE_PAIRING', 'REJECT_PAIRING', 'REMOVE_DEVICE'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  on: (channel, func) => {
    const validChannels = ['DEVICES_UPDATED', 'CAMERA_FRAME_RECEIVED', 'CONNECTION_MSG_RECEIVED', 'LOCAL_IP_RESULT', 'PENDING_APPROVALS_UPDATED'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  },
  removeListener: (channel, func) => {
    ipcRenderer.removeListener(channel, func);
  }
});
