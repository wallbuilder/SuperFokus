const { _electron: electron } = require('@playwright/test');
const { test, expect } = require('@playwright/test');

test('Fokus Stats Dashboard rendering and metrics update after focus session completes', async () => {
  let electronApp = null;
  try {
    // 1. Launch the Electron app using Playwright
    electronApp = await electron.launch({ args: ['src/main/main.js', '--no-single-instance'] });
    const window = await electronApp.firstWindow();

    // 2. Open the Fokus Stats panel: click #menu-toggle, then click [data-modal="modal-focus-stats"]
    await window.click('#menu-toggle');
    await window.click('[data-modal="modal-focus-stats"]');

    // 3. Verify that the modal #modal-focus-stats opens and the canvas #statsChart is visible
    const statsModal = window.locator('#modal-focus-stats');
    await expect(statsModal).toHaveClass(/active/);
    const statsChart = window.locator('#statsChart');
    await expect(statsChart).toBeVisible();

    // 4. Read the initial completed rounds value from #stat-rounds (store this count)
    const initialRoundsText = await window.locator('#stat-rounds').innerText();
    const initialRounds = parseInt(initialRoundsText.trim(), 10) || 0;

    // 5. Close the Fokus Stats panel (#modal-focus-stats .modal-close)
    await window.click('#modal-focus-stats .modal-close');

    // Close the sidebar menu so home button is clickable without overlay blocking
    const sideMenu = window.locator('#side-menu');
    if (await sideMenu.evaluate(el => el.classList.contains('open'))) {
      await window.click('#menu-toggle');
    }

    // 6. Configure a very short Pomo work session:
    // - Click Pomo Style mode on the home screen
    await window.click('.home-btn[data-mode="pomo-style"]');

    // - Remove the default Break phase from the sequence list (click the second remove button inside #pomo-sequence-list)
    const removeBtns = window.locator('#pomo-sequence-list .remove-btn');
    await removeBtns.nth(1).click();

    // - Change the remaining Work phase duration to "5" and unit select to "secs"
    const remainingInput = window.locator('#pomo-sequence-list input[type="number"]');
    await remainingInput.fill('5');
    await remainingInput.dispatchEvent('change');

    const remainingSelect = window.locator('#pomo-sequence-list select');
    await remainingSelect.selectOption('secs');
    await remainingSelect.dispatchEvent('change');

    // - Click the start button #start-pomo-btn
    await window.click('#start-pomo-btn');

    // 7. Wait for the focus session to complete.
    // Wait for the new window to open, then wait for it to close.
    let timerWindowClosed = false;
    try {
      const timerWindow = await electronApp.waitForEvent('window', { timeout: 5000 });
      await expect(timerWindow).toHaveTitle('Pomo Timer');
      await timerWindow.waitForEvent('close', { timeout: 15000 });
      timerWindowClosed = true;
    } catch (e) {
      console.log('No separate timer window detected or it closed, waiting for start-btn state instead');
    }

    // Also wait for the start button to revert to start state
    const startBtn = window.locator('#start-pomo-btn');
    await expect(startBtn).toHaveClass(/start-btn/, { timeout: 15000 });

    // 8. Open the Fokus Stats panel again
    await window.click('#menu-toggle');
    await window.click('[data-modal="modal-focus-stats"]');

    // 9. Verify completed rounds and session history log
    const finalRoundsText = await window.locator('#stat-rounds').innerText();
    const finalRounds = parseInt(finalRoundsText.trim(), 10) || 0;
    expect(finalRounds).toBe(initialRounds + 1);

    const sessionHistoryLog = window.locator('#session-history-log');
    await expect(sessionHistoryLog).toContainText('Pomo Work');

    // 10. Close the Fokus Stats panel
    await window.click('#modal-focus-stats .modal-close');

    // Close the Electron app cleanly
    await electronApp.close();
    electronApp = null;
  } finally {
    if (electronApp) {
      try {
        await electronApp.close();
      } catch (err) {
        console.error('Error closing electronApp:', err);
      }
    }
  }
});
