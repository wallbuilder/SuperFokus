const { _electron: electron } = require('@playwright/test');
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Sound Settings E2E Tests', () => {
  let electronApp = null;
  let window = null;

  test.beforeEach(async () => {
    // Launch the Electron app using Playwright
    electronApp = await electron.launch({ args: ['src/main/main.js', '--no-single-instance'] });
    window = await electronApp.firstWindow();
  });

  test.afterEach(async () => {
    // Ensure the Electron app is closed cleanly to prevent zombie processes
    if (electronApp) {
      try {
        await electronApp.close();
      } catch (err) {
        console.error('Error closing Electron app:', err);
      }
    }
  });

  test('Sound Settings and Custom Upload Flow', async () => {
    // 1. Open the customization modal: click #menu-toggle, then click [data-modal="modal-customization"]
    await window.click('#menu-toggle');
    await window.click('[data-modal="modal-customization"]');

    // 2. Go to the "Sounds" tab: click .tab-btn[data-tab="tab-sounds"]
    await window.click('.tab-btn[data-tab="tab-sounds"]');

    // Robust clean up: delete any existing custom notifications that might have persisted from previous runs
    const deleteButtons = window.locator('#custom-notifs-container button');
    const count = await deleteButtons.count();
    for (let i = 0; i < count; i++) {
      await window.locator('#custom-notifs-container button').first().click();
      await window.waitForTimeout(200);
    }

    // 3. Verify switching sound packs updates configurations:
    // - Check #sound-pack-selector value (it should default to "classic" or similar)
    const soundPackSelector = window.locator('#sound-pack-selector');
    await expect(soundPackSelector).toBeVisible();
    await expect(soundPackSelector).toHaveValue('classic');

    // - Change the selected sound pack (e.g. select "nature")
    await window.selectOption('#sound-pack-selector', 'nature');

    // - Verify #notification-sound-selector options update (e.g. contain nature options)
    const notifSelector = window.locator('#notification-sound-selector');
    await expect(notifSelector).toBeVisible();
    const natureOption = notifSelector.locator('option[value="nature-notif-1"]');
    await expect(natureOption).toBeAttached();
    await expect(natureOption).toHaveText('Nature Notification 1');

    // - Switch back to "classic" sound pack
    await window.selectOption('#sound-pack-selector', 'classic');
    const classicOption = notifSelector.locator('option[value="classic-notif-1"]');
    await expect(classicOption).toBeAttached();
    await expect(classicOption).toHaveText('Classic Notification 1');

    // 4. Test custom chime upload:
    // - Determine the path to a test audio file, such as assets/sounds/nature-notif-1.mp3 in the workspace
    const filePath = path.resolve(__dirname, '../../assets/sounds/nature-notif-1.mp3');

    // - Setup a file chooser listener in Playwright:
    const fileChooserPromise = window.waitForEvent('filechooser');

    // - Click the upload button #upload-chime-btn
    await window.click('#upload-chime-btn');

    // - Wait for the file chooser and set the file path to assets/sounds/nature-notif-1.mp3
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(filePath);

    // - Verify the newly uploaded chime is successfully added to the custom notifications list (e.g. check that #custom-notifs-container contains text "Custom Notification 1")
    const customContainer = window.locator('#custom-notifs-container');
    await expect(customContainer).toContainText('Custom Notification 1');

    // - Verify that the notification selector #notification-sound-selector option is set to custom-notif-0 (or the last custom notif index)
    await expect(notifSelector).toHaveValue('custom-notif-0');

    // 5. Clean up:
    // - Click the "Delete" button inside #custom-notifs-container next to the custom notification to remove it
    await window.click('#custom-notifs-container button');

    // - Verify it was removed
    await expect(customContainer).not.toContainText('Custom Notification 1');

    // - Close the customization modal and close the Electron app cleanly
    await window.click('#modal-customization .modal-close');
    await electronApp.close();
    electronApp = null; // Set to null so afterEach does not try to close it again
  });
});
