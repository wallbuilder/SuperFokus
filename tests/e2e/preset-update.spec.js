const { _electron: electron } = require('@playwright/test');
const { test, expect } = require('@playwright/test');

test.describe('Preset Update E2E Tests', () => {
  let electronApp;
  let window;

  test.beforeEach(async () => {
    electronApp = await electron.launch({ args: ['src/main/main.js', '--no-single-instance'] });
    window = await electronApp.firstWindow();
  });

  test.afterEach(async () => {
    await electronApp.close();
  });

  test('Pomo Timer Preset update flow', async () => {
    await window.click('.home-btn[data-mode="pomo-style"]');
    
    // Select built-in deep-work preset
    await window.selectOption('#pomo-presets', 'deep-work');
    
    const saveBtn = window.locator('#save-pomo-preset-btn');
    await expect(saveBtn).not.toHaveClass(/update-mode/);
    
    // Modify work duration to trigger deviation
    await window.fill('#pomo-sequence-list input[data-index="0"]', '51');
    await window.dispatchEvent('#pomo-sequence-list input[data-index="0"]', 'change');
    
    await expect(saveBtn).toHaveClass(/update-mode/);
    await expect(saveBtn).toHaveText('Update');
    
    // Click update
    await saveBtn.click();
    
    // Reverted style
    await expect(saveBtn).not.toHaveClass(/update-mode/);
    
    // Dropdown option updated to Custom: Deep Work - 50/10
    const select = window.locator('#pomo-presets');
    await expect(select).toHaveValue('custom-preset-Deep Work - 50/10');
  });

  test('Micro Sprint Preset update flow', async () => {
    await window.click('.home-btn[data-mode="micro-sprint"]');
    
    // Select quick-chores
    await window.selectOption('#sprint-presets', 'quick-chores');
    
    const saveBtn = window.locator('#save-sprint-preset-btn');
    await expect(saveBtn).not.toHaveClass(/update-mode/);
    
    // Modify tasks to trigger deviation
    await window.fill('#sprint-tasks', 'Clean desk\nCheck email\nStretch\nDrink water');
    await window.dispatchEvent('#sprint-tasks', 'input');
    
    await expect(saveBtn).toHaveClass(/update-mode/);
    
    // Click update
    await saveBtn.click();
    await expect(saveBtn).not.toHaveClass(/update-mode/);
    
    const select = window.locator('#sprint-presets');
    await expect(select).toHaveValue('custom-preset-Quick Chores');
  });

  test('Repeating Reminders Preset update flow', async () => {
    await window.click('.home-btn[data-mode="repeating-reminders"]');
    
    // Select concentration
    await window.selectOption('#repeating-presets', 'concentration');
    
    const saveBtn = window.locator('#save-repeating-preset-btn');
    await expect(saveBtn).not.toHaveClass(/update-mode/);
    
    // Modify seconds to trigger deviation
    await window.fill('#reminder-interval-seconds', '31');
    await window.dispatchEvent('#reminder-interval-seconds', 'input');
    
    await expect(saveBtn).toHaveClass(/update-mode/);
    
    // Click update
    await saveBtn.click();
    await expect(saveBtn).not.toHaveClass(/update-mode/);
    
    const select = window.locator('#repeating-presets');
    await expect(select).toHaveValue('custom-preset-Concentration - 30s');
  });
});
