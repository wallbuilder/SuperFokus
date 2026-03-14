const { ipcRenderer } = require('electron');

ipcRenderer.on('display-message', (event, message) => {
    document.getElementById('message-content').innerText = message;
});