const { app, powerMonitor, ipcMain, powerSaveBlocker, Menu } = require('electron');
const timerService = require('./TimerService');

class MacOptimizationService {
    constructor() {
        this.powerBlockerId = null;
        this.sleepTime = null;
    }

    init(mainWindow) {
        if (process.platform !== 'darwin') return;

        this.mainWindow = mainWindow;

        // 1. App Nap / Power Save Blocker & Dock Badging
        this.setupPowerSaveBlocker();

        // 2. Dock & Menu Integration
        this.setupDockAndMenu();

        // 3. Sleep & Wake Handling
        this.setupSleepWakeHandling();
    }

    setupPowerSaveBlocker() {
        // Update on IPC events for timers
        ipcMain.on('start-timer', () => {
            this.updateState();
            if (!this.pollingInterval) {
                this.pollingInterval = setInterval(() => this.updateState(), 1000);
            }
        });
        ipcMain.on('stop-timer', () => this.handleTimerChange());
        ipcMain.on('pause-timer', () => this.handleTimerChange());
        ipcMain.on('resume-timer', () => {
            this.updateState();
            if (!this.pollingInterval) {
                this.pollingInterval = setInterval(() => this.updateState(), 1000);
            }
        });
    }

    handleTimerChange() {
        this.updateState();
        const timers = timerService.getTimers();
        const hasRunningTimer = Object.values(timers).some(t => t.isRunning);
        if (!hasRunningTimer && this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    updateState() {
        if (process.platform !== 'darwin') return;

        const ObjectValues = Object.values || (obj => Object.keys(obj).map(k => obj[k]));
        let timers;
        try {
            timers = timerService.getTimers();
        } catch (e) {
            return;
        }

        const timerList = ObjectValues(timers);
        const hasRunningTimer = timerList.some(t => t.isRunning);

        // Manage Power Save Blocker
        if (hasRunningTimer && this.powerBlockerId === null) {
            this.powerBlockerId = powerSaveBlocker.start('prevent-app-suspension');
        } else if (!hasRunningTimer && this.powerBlockerId !== null) {
            powerSaveBlocker.stop(this.powerBlockerId);
            this.powerBlockerId = null;
        }

        // Manage Dock Badging
        if (hasRunningTimer) {
            let minRemaining = null;
            for (const t of timerList) {
                if (t.isRunning) {
                    const remaining = Math.max(0, Math.round((t.endTime - Date.now()) / 1000));
                    if (minRemaining === null || remaining < minRemaining) {
                        minRemaining = remaining;
                    }
                }
            }
            if (minRemaining !== null) {
                const mins = Math.ceil(minRemaining / 60);
                app.dock.setBadge(mins > 0 ? `${mins}m` : '<1m');
            } else {
                app.dock.setBadge('');
            }
        } else {
            app.dock.setBadge('');
        }
    }

    setupDockAndMenu() {
        if (process.platform !== 'darwin') return;

        const dockMenu = Menu.buildFromTemplate([
            {
                label: 'Start Flow State',
                click: () => {
                    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                        this.mainWindow.webContents.send('start-flow-state-from-dock');
                    }
                }
            },
            {
                label: 'Pause All Timers',
                click: () => {
                    const timers = timerService.getTimers();
                    for (const id in timers) {
                        if (timers[id].isRunning) {
                            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                                this.mainWindow.webContents.send('pause-timer-from-dock', id);
                            }
                        }
                    }
                }
            }
        ]);
        app.dock.setMenu(dockMenu);
    }

    setupSleepWakeHandling() {
        if (process.platform !== 'darwin') return;

        powerMonitor.on('suspend', () => {
            this.sleepTime = Date.now();
        });

        powerMonitor.on('resume', () => {
            if (this.sleepTime) {
                // By doing this, we immediately force dock updates.
                // TimerService will automatically fast-forward because it calculates remaining time
                // against the fixed endTime absolute timestamp.
                this.updateState();
                this.sleepTime = null;
            }
        });
    }
}

module.exports = new MacOptimizationService();
