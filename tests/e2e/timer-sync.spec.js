const { _electron: electron } = require('@playwright/test');
const { test, expect } = require('@playwright/test');

test.describe('Timer Play/Pause Synchronization E2E Tests', () => {
  let electronApp;
  let window;

  test.beforeEach(async () => {
    // Launch the electron app
    electronApp = await electron.launch({ args: ['src/main/main.js', '--no-single-instance'] });

    // Get the first window that the app opens (Main Window)
    window = await electronApp.firstWindow();
  });

  test.afterEach(async () => {
    // Close the app cleanly
    if (electronApp) {
      await electronApp.close();
    }
  });

  test('Sync play/pause state between main window and mini-timer window', async () => {
    // 2. Start the POMO timer in the main window
    // Click the Pomo Style button on the home screen
    await window.click('.home-btn[data-mode="pomo-style"]');
    // Click the start button
    await window.click('#start-pomo-btn');

    // 3. Wait for the mini-timer window to open
    const miniWindow = await electronApp.waitForEvent('window');
    await expect(miniWindow).toHaveTitle('Pomo Timer');

    // 4. Access the play-pause button `#play-pause-btn` in the mini-timer window
    const playPauseBtn = miniWindow.locator('#play-pause-btn');
    const miniTimerDisplay = miniWindow.locator('#timer');

    // 5. Click the play-pause button in the mini-timer window to pause it.
    await playPauseBtn.click();

    // Verify the main window's timer updates to the paused state
    const pausePomoBtn = window.locator('#pause-pomo-btn');
    await expect(pausePomoBtn).toHaveText('Resume ▶');
    const pomoTimerDisplay = window.locator('#pomo-timer-display');
    await expect(pomoTimerDisplay).toHaveClass(/paused/);

    // Verify mini-timer display has paused styling and play-pause button shows resume icon
    await expect(miniTimerDisplay).toHaveClass(/paused/);
    await expect(playPauseBtn).toHaveAttribute('title', 'Resume');
    await expect(playPauseBtn.locator('svg path')).toHaveAttribute('d', 'M8 5v14l11-7z');

    // 6. Click "Resume ▶" on `#pause-pomo-btn` in the main window.
    await pausePomoBtn.click();

    // Verify the mini-timer window's play-pause button updates back to the running state
    // (shows pause icon and doesn't have the paused styling)
    await expect(playPauseBtn).toHaveAttribute('title', 'Pause');
    await expect(playPauseBtn.locator('svg path')).toHaveAttribute('d', 'M6 19h4V5H6v14zm8-14v14h4V5h-4z');
    await expect(miniTimerDisplay).not.toHaveClass(/paused/);

    // Verify main window has running styling
    await expect(pausePomoBtn).toHaveText('Pause ▐▐');
    await expect(pomoTimerDisplay).not.toHaveClass(/paused/);

    // 7. Click "Pause ▐▐" on `#pause-pomo-btn` in the main window.
    await pausePomoBtn.click();

    // Verify the mini-timer window updates to the paused state
    await expect(miniTimerDisplay).toHaveClass(/paused/);
    await expect(playPauseBtn).toHaveAttribute('title', 'Resume');
    await expect(playPauseBtn.locator('svg path')).toHaveAttribute('d', 'M8 5v14l11-7z');

    // 8. Click the play-pause button in the mini-timer window to resume.
    await playPauseBtn.click();

    // Verify the main window updates to the running state
    await expect(pausePomoBtn).toHaveText('Pause ▐▐');
    await expect(pomoTimerDisplay).not.toHaveClass(/paused/);

    // Verify mini-timer window updates to running state
    await expect(playPauseBtn).toHaveAttribute('title', 'Pause');
    await expect(playPauseBtn.locator('svg path')).toHaveAttribute('d', 'M6 19h4V5H6v14zm8-14v14h4V5h-4z');
    await expect(miniTimerDisplay).not.toHaveClass(/paused/);

    // 9. Click the start/stop button `#start-pomo-btn` in the main window to stop the timer.
    await window.click('#start-pomo-btn');

    // Verify the mini-timer window is closed or hidden
    await expect.poll(async () => {
      return await electronApp.evaluate(({ BrowserWindow }) => {
        const timerWin = BrowserWindow.getAllWindows().find(w => w.getTitle() === 'Pomo Timer');
        return timerWin ? timerWin.isVisible() : false;
      });
    }).toBe(false);
  });
});
