const electron = require('electron');
console.log('in index.js: type of electron:', typeof electron);
console.log('in index.js: electron keys:', Object.keys(electron));
electron.app.quit();