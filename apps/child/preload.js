const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  send: (channel, data) => {
    const validChannels = ['VERIFY_PASSWORD', 'START_DISCOVERY', 'SET_KIOSK', 'UPDATE_CONFIG'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  on: (channel, func) => {
    const validChannels = [
        'SHOW_EXIT_MODAL',
        'PASSWORD_RESULT',
        'PASSWORD_ACTION',
        'MASTER_FOUND'
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  },
  removeListener: (channel, func) => {
    ipcRenderer.removeListener(channel, func);
  }
});
