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
