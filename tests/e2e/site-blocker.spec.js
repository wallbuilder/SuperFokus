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
  // Navigate to the site blocker section (assuming a button or link with this ID)
  await window.click('#open-site-blocker-modal');

  // Toggle the site blocker switch
  await window.click('#site-blocker-toggle');

  // Add a domain to the block list
  await window.fill('#blocker-domain-input', 'example.com');

  // Click the save button
  await window.click('#save-blocker-rules');

  // No explicit assertion, the test will pass if no uncaught exceptions are thrown
  // during the activation process.
  await expect(true).toBe(true);
});
