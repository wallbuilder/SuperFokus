const { _electron: electron } = require('@playwright/test');
const { test, expect } = require('@playwright/test');

test.describe('Repeating Reminders E2E Tests', () => {
  let electronApp;
  let window;

  test.beforeEach(async () => {
    electronApp = await electron.launch({ args: ['src/main/main.js', '--no-single-instance'] });
    window = await electronApp.firstWindow();
  });

  test.afterEach(async () => {
    await electronApp.close();
  });

  test('Repeating Reminders supports up to 5 popups dropdown option', async () => {
    // Open the Repeating Reminders config screen
    await window.click('.home-btn[data-mode="repeating-reminders"]');

    // Check that the dropdown for popups count exists
    const selectLocator = window.locator('#reminder-popups-count');
    await expect(selectLocator).toBeVisible();

    // Verify option '5' is available
    const option5 = selectLocator.locator('option[value="5"]');
    await expect(option5).toHaveText('5');

    // Select option '5'
    await selectLocator.selectOption('5');
    const selectedValue = await selectLocator.inputValue();
    expect(selectedValue).toBe('5');
  });

  test('Repeating Reminders starts successfully and displays countdown', async () => {
    // Open the Repeating Reminders config screen
    await window.click('.home-btn[data-mode="repeating-reminders"]');

    // Fill interval (0 min, 5 sec) and rounds (3)
    await window.fill('#reminder-interval', '0');
    await window.fill('#reminder-interval-seconds', '5');
    await window.fill('#reminder-rounds', '3');

    // Click the start button
    await window.click('#start-repeating-btn');

    // Verify timer display is visible and countdown has started
    const timerDisplay = window.locator('#repeating-timer-display');
    await expect(timerDisplay).toBeVisible();

    const timeLeft = window.locator('#repeating-time-left');
    await expect(timeLeft).toHaveText('00:05');
  });
});
