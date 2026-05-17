const electron = require('electron');
console.log('in test-main.js: type of electron:', typeof electron);
console.log('app is:', electron.app ? 'defined' : 'undefined');
app.quit();
