const { _electron: electron } = require('@playwright/test');
const { test, expect } = require('@playwright/test');

let electronApp;
let window;

test.beforeAll(async () => {
  // Launch the electron app
  electronApp = await electron.launch({ args: ['src/main/main.js', '--no-single-instance'] });

  // Get the first window that the app opens
  window = await electronApp.firstWindow();
});

test.afterAll(async () => {
  // Close the app
  await electronApp.close();
});

test('Site Blocker activates without errors', async () => {
  // Open the sidebar
  await window.click('#menu-toggle');

  // Navigate to the site blocker section (assuming a button or link with this ID)
  await window.click('[data-modal="modal-site-blocker"]');

  // Toggle the site blocker switch if not already enabled
  const checkbox = window.locator('#site-blocker-enabled');
  if (!(await checkbox.isChecked())) {
    await window.click('label.toggle-switch:has(#site-blocker-enabled) .slider');
  }

  // Add a domain to the block list
  await window.fill('#domain-list', 'example.com');

  // Click the save button
  await window.click('#save-blocker-btn');

  // Assertion that the status display contains 'Domains blocked'
  const statusDisplay = await window.locator('#blocker-status-display');
  await expect(statusDisplay).toContainText('Domains blocked');
});
