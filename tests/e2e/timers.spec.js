const { _electron: electron } = require('@playwright/test');
const { test, expect } = require('@playwright/test');

let electronApp;
let window;

test.beforeAll(async () => {
  // Launch the electron app
  electronApp = await electron.launch({ args: ['.'] });

  // Get the first window that the app opens
  window = await electronApp.firstWindow();
});

test.afterAll(async () => {
  // Close the app
  await electronApp.close();
});

test('Pomo Timer Window Opens', async () => {
  // Select the Pomo Style mode
  await window.selectOption('select#mode-select', 'pomo-style');

  // Click the start button
  await window.click('button#start-pomo-btn');

  // Wait for the new window to open
  const newWindow = await electronApp.waitForEvent('window');

  // Expect the new window to have the correct title
  expect(await newWindow.title()).toBe('Pomo Timer');
});

test('Micro-Sprint Timer Window Opens', async () => {
    // Select the Micro-Sprint mode
    await window.selectOption('select#mode-select', 'micro-sprint');
  
    // Click the start button
    await window.click('button#start-sprint-btn');
  
    // Wait for the new window to open
    const newWindow = await electronApp.waitForEvent('window');
  
    // Expect the new window to have the correct title
    expect(await newWindow.title()).toBe('Micro-Sprint Timer');
});

test('Flow State Timer Window Opens', async () => {
    // Select the Flow State mode
    await window.selectOption('select#mode-select', 'flow-state');
  
    // Click the start button
    await window.click('button#start-flow-btn');
  
    // Wait for the new window to open
    const newWindow = await electronApp.waitForEvent('window');
  
    // Expect the new window to have the correct title
    expect(await newWindow.title()).toBe('Flow State Timer');
});
