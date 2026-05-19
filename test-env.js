const electron = require('electron');
console.log('process.type:', process.type);
console.log('process.versions.electron:', process.versions.electron);
console.log('electron keys:', Object.keys(electron));
process.exit(0);