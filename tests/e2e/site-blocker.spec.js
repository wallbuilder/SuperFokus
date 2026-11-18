const { _electron: electron } = require('@playwright/test');
const { test, expect } = require('@playwright/test');

test.describe('Site Blocker E2E Tests', () => {
  let electronApp;
  let window;

  test.beforeEach(async () => {
    electronApp = await electron.launch({ args: ['src/main/main.js', '--no-single-instance'] });
    window = await electronApp.firstWindow();
  });

  test.afterEach(async () => {
    if (electronApp) {
      await electronApp.close();
      electronApp = null;
    }
  });

  test('Site Blocker activates without errors on first turn-on after app start', async () => {
    // Open the sidebar
    await window.click('#menu-toggle');

    // Navigate to the site blocker section
    await window.click('[data-modal="modal-site-blocker"]');

    // Ensure the site blocker switch starts unchecked on fresh app launch (when alwaysRun is false)
    const checkbox = window.locator('#site-blocker-enabled');
    await expect(checkbox).not.toBeChecked();

    // Turn on the site blocker switch for the first time
    await window.click('label.toggle-switch:has(#site-blocker-enabled) .slider');
    await expect(checkbox).toBeChecked();

    // Add a domain to the block list
    await window.fill('#domain-list', 'example.com');

    // Click the save button
    await window.click('#save-blocker-btn');

    // Assertion that the status display contains 'Domains blocked'
    const statusDisplay = window.locator('#blocker-status-display');
    await expect(statusDisplay).toContainText('Domains blocked');
  });

  test('Site Blocker works on first turn-on after app restart even if previously active without alwaysRun', async () => {
    // Restart app after previous test left blocker active (with alwaysRun = false)
    await electronApp.close();
    electronApp = await electron.launch({ args: ['src/main/main.js', '--no-single-instance'] });
    window = await electronApp.firstWindow();

    await window.click('#menu-toggle');
    await window.click('[data-modal="modal-site-blocker"]');

    const checkbox = window.locator('#site-blocker-enabled');
    // Must reset to unchecked on startup since alwaysRun was false
    await expect(checkbox).not.toBeChecked();

    // Turn on the site blocker for the first time upon starting the app
    await window.click('label.toggle-switch:has(#site-blocker-enabled) .slider');
    await expect(checkbox).toBeChecked();

    await window.fill('#domain-list', 'example.com\nyoutube.com');
    await window.click('#save-blocker-btn');

    const statusDisplay = window.locator('#blocker-status-display');
    await expect(statusDisplay).toContainText('Domains blocked');
  });
});
