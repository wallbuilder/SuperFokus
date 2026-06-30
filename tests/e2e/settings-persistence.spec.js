const { _electron: electron } = require('@playwright/test');
const { test, expect } = require('@playwright/test');

test('Settings Persistence Across Application Restarts', async () => {
  let electronApp = null;
  let electronApp2 = null;
  
  try {
    // 1. Launch the Electron app using Playwright
    electronApp = await electron.launch({ args: ['src/main/main.js', '--no-single-instance'] });
    const window = await electronApp.firstWindow();
    
    // 2. Open the customization modal
    await window.click('#menu-toggle');
    await window.click('[data-modal="modal-customization"]');
    
    // 3. Select the "Cyber - Green" theme and modify custom toggle state dropdowns
    await window.click('#theme-radio-cyber-green');
    await window.selectOption('#custom-toggle-state-1', 'cyber-green');
    await window.selectOption('#custom-toggle-state-2', 'cyber-blue');
    await expect(window.locator('#custom-toggle-state-1')).toHaveValue('cyber-green');
    await expect(window.locator('#custom-toggle-state-2')).toHaveValue('cyber-blue');
    await window.waitForTimeout(200); // Allow event handlers to complete
    
    // 4. Click the "Save Theme Settings" button
    await window.click('#save-theme-settings-btn');
    
    // 5. Go to the "Advanced" tab in the customization modal
    await window.click('.tab-btn[data-tab="tab-advanced"]');
    
    // 6. Toggle the "Hide timer display in all modes" setting to checked
    const checkbox = window.locator('#hide-timer-toggle');
    if (!(await checkbox.isChecked())) {
      await window.click('label.toggle-switch:has(#hide-timer-toggle) .slider');
    }
    
    // 7. Close the customization modal
    await window.click('#modal-customization .modal-close');
    
    // 8. Navigate to the repeating reminders configuration screen
    await window.click('.home-btn[data-mode="repeating-reminders"]');
    
    // 9. Add a custom repeating reminder preset
    await window.fill('#reminder-interval', '10');
    await window.fill('#reminder-rounds', '7');
    await window.selectOption('#reminder-popups-count', '5');
    
    await window.click('#save-repeating-preset-btn');
    await window.fill('#repeating-preset-name-input', 'E2ETestPreset');
    await window.click('#confirm-save-repeating-preset-btn');
    
    // 10. Close the Electron app cleanly
    await electronApp.close();
    electronApp = null; // Reset to indicate it closed successfully
    
    // 11. Launch the Electron app again
    electronApp2 = await electron.launch({ args: ['src/main/main.js', '--no-single-instance'] });
    const window2 = await electronApp2.firstWindow();
    
    // Handle the confirm dialog when deleting the preset during cleanup
    window2.on('dialog', async dialog => {
      await dialog.accept();
    });
    
    // 12. Verify that the settings successfully persisted
    // - Verify theme class on body
    const body = window2.locator('body');
    await expect(body).toHaveClass(/cyber-green-mode/);
    
    // - Open customization modal, Advanced tab, verify hide-timer-toggle is checked
    await window2.click('#menu-toggle');
    await window2.click('[data-modal="modal-customization"]');
    await window2.click('.tab-btn[data-tab="tab-advanced"]');
    const checkbox2 = window2.locator('#hide-timer-toggle');
    await expect(checkbox2).toBeChecked();
    
    // - Go to Themes tab, verify custom toggle state dropdowns are preserved
    await window2.click('.tab-btn[data-tab="tab-themes"]');
    const sel1_2 = window2.locator('#custom-toggle-state-1');
    const sel2_2 = window2.locator('#custom-toggle-state-2');
    await expect(sel1_2).toHaveValue('cyber-green');
    await expect(sel2_2).toHaveValue('cyber-blue');
    
    // - Close customization modal
    await window2.click('#modal-customization .modal-close');
    
    // - Navigate to repeating reminders, select the custom preset and verify rounds & popup count
    await window2.click('.home-btn[data-mode="repeating-reminders"]');
    const selectPreset = window2.locator('#repeating-presets');
    await selectPreset.selectOption('custom-preset-E2ETestPreset');
    await expect(window2.locator('#reminder-interval')).toHaveValue('10');
    await expect(window2.locator('#reminder-rounds')).toHaveValue('7');
    await expect(window2.locator('#reminder-popups-count')).toHaveValue('5');
    
    // 13. Clean up the settings
    // - Delete custom preset (the dialog event handler registered above will auto-confirm)
    await window2.click('#delete-repeating-preset-btn');
    
    // - Reset theme back to "light" and custom toggle states to defaults
    await window2.click('#menu-toggle');
    await window2.click('[data-modal="modal-customization"]');
    await window2.click('#theme-radio-light');
    await window2.selectOption('#custom-toggle-state-1', 'light');
    await window2.selectOption('#custom-toggle-state-2', 'dark');
    await expect(window2.locator('#custom-toggle-state-1')).toHaveValue('light');
    await expect(window2.locator('#custom-toggle-state-2')).toHaveValue('dark');
    await window2.waitForTimeout(200); // Allow event handlers to complete
    await window2.click('#save-theme-settings-btn');
    
    // - Uncheck hide-timer-toggle in Advanced
    await window2.click('.tab-btn[data-tab="tab-advanced"]');
    const cb2 = window2.locator('#hide-timer-toggle');
    if (await cb2.isChecked()) {
      await window2.click('label.toggle-switch:has(#hide-timer-toggle) .slider');
    }
    
    // - Close customization modal
    await window2.click('#modal-customization .modal-close');
    
    // Close the app cleanly
    await electronApp2.close();
    electronApp2 = null;
    
  } finally {
    // Ensure all launched apps are closed to prevent zombie processes
    if (electronApp) {
      try {
        await electronApp.close();
      } catch (err) {
        console.error('Error closing electronApp:', err);
      }
    }
    if (electronApp2) {
      try {
        await electronApp2.close();
      } catch (err) {
        console.error('Error closing electronApp2:', err);
      }
    }
  }
});
