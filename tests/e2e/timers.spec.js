const { _electron: electron } = require('@playwright/test');
const { test, expect } = require('@playwright/test');

let electronApp;
let window;

test.beforeEach(async () => {
  // Launch the electron app
  electronApp = await electron.launch({ args: ['src/main/main.js', '--no-single-instance'] });

  // Get the first window that the app opens
  window = await electronApp.firstWindow();
});

test.afterEach(async () => {
  // Close the app
  await electronApp.close();
});

test('Pomo Timer Window Opens', async () => {
  // Click the Pomo Style button on the home screen
  await window.click('.home-btn[data-mode="pomo-style"]');

  // Click the start button
  await window.click('button#start-pomo-btn');

  // Wait for the new window to open
  const newWindow = await electronApp.waitForEvent('window');

  // Expect the new window to have the correct title
  await expect(newWindow).toHaveTitle('Pomo Timer');
});

test('Micro-Sprint Timer Window Opens', async () => {
    // Click the Micro-Sprint button on the home screen
    await window.click('.home-btn[data-mode="micro-sprint"]');
  
    // Click the start button
    await window.click('button#start-sprint-btn');
  
    // Wait for the new window to open
    const newWindow = await electronApp.waitForEvent('window');
  
    // Expect the new window to have the correct title
    await expect(newWindow).toHaveTitle('Micro-Sprint Timer');
});

test('Flow State Timer Window Opens', async () => {
    // Click the Flow State button on the home screen
    await window.click('.home-btn[data-mode="flow-state"]');
  
    // Click the start button
    await window.click('button#start-flow-btn');
  
    // Wait for the new window to open
    const newWindow = await electronApp.waitForEvent('window');
  
    // Expect the new window to have the correct title
    await expect(newWindow).toHaveTitle('Flow State Timer');
});

test('Timer Window does not open when hide-timer setting is active', async () => {
  // Open the customization modal
  await window.click('#menu-toggle');
  await window.click('[data-modal="modal-customization"]');
  
  // Go to Advanced tab and toggle the checkbox to true
  await window.click('.tab-btn[data-tab="tab-advanced"]');
  const checkbox = window.locator('#hide-timer-toggle');
  if (!(await checkbox.isChecked())) {
    await window.click('label.toggle-switch:has(#hide-timer-toggle) .slider');
  }
  
  // Close the customization modal
  await window.click('#modal-customization .modal-close');
  
  // Close the sidebar
  await window.click('#menu-toggle');

  // Click the Pomo Style button on the home screen
  await window.click('.home-btn[data-mode="pomo-style"]');

  // Click the start button
  await window.click('button#start-pomo-btn');

  // Expect no window to be opened within 2 seconds
  let windowOpened = false;
  electronApp.once('window', () => { windowOpened = true; });
  await window.waitForTimeout(2000);
  expect(windowOpened).toBe(false);

  // Clean up: turn setting back off
  await window.click('#menu-toggle');
  await window.click('[data-modal="modal-customization"]');
  await window.click('.tab-btn[data-tab="tab-advanced"]');
  if (await checkbox.isChecked()) {
    await window.click('label.toggle-switch:has(#hide-timer-toggle) .slider');
  }
});
