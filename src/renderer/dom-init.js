/**
 * DOM Element Initialization Logic
 * Extracted from renderer.js to reduce file size.
 */

export function initializeDomElements(setupWorkflowEventListeners, setupWorkflowPresetsEventListeners) {
  try {
    // Workflow elements
    window.workflowStack = document.getElementById('workflow-stack');
    window.workflowStackPlaceholder = document.getElementById('workflow-stack-placeholder');
    window.workflowTotalDurationEl = document.getElementById('workflow-total-duration');
    
    // Other elements that might be accessed early
    window.workflowPaletteItems = document.querySelectorAll('.workflow-palette-item');
    
    // Dynamically inject the Break block into the palette if it hasn't been added to the HTML
    if (window.workflowPaletteItems && window.workflowPaletteItems.length > 0) {
        const paletteContainer = window.workflowPaletteItems[0].parentNode;
        const hasBreak = Array.from(window.workflowPaletteItems).some(el => el.dataset.type === 'break');
        if (!hasBreak && paletteContainer) {
            const breakItem = document.createElement('div');
            breakItem.className = 'workflow-palette-item';
            breakItem.dataset.type = 'break';
            breakItem.draggable = true;
            breakItem.innerHTML = '<strong>Break ⛾</strong><br><small>Drag to add</small>';
            paletteContainer.appendChild(breakItem);
            window.workflowPaletteItems = document.querySelectorAll('.workflow-palette-item');
        }
    }

    // Set up workflow event listeners
    if (typeof setupWorkflowEventListeners === 'function') {
        setupWorkflowEventListeners();
    }

    // Set up workflow presets event listeners
    if (typeof setupWorkflowPresetsEventListeners === 'function') {
        setupWorkflowPresetsEventListeners();
    }
  } catch (error) {
    console.error('[Startup] Error initializing DOM elements:', error);
  }
}

export function initializeButtonListeners(initializeRepeatingButtonListeners) {
  try {
    if (typeof initializeRepeatingButtonListeners === 'function') {
        initializeRepeatingButtonListeners();
    }
  } catch (error) {
    console.error('[Startup] Error initializing button listeners:', error);
  }
}

export function initializeCustomSoundpackListeners(
    updateCustomNotifsUI, updateCustomAmbientUI, updateCustomPackUI, 
    updateSoundSelectors, loadFileAsDataURL, saveCustomSoundPack, deleteCustomSoundPack
) {
    let tempCustomNotifFiles = [];
    let tempCustomAmbientFiles = [];

    const customNotifUploadBtn = document.getElementById('custom-notif-upload-btn');
    const customNotifUploadInput = document.getElementById('custom-notif-upload');
    const customNotifPreview = document.getElementById('custom-notif-preview');

    const customAmbientUploadBtn = document.getElementById('custom-ambient-upload-btn');
    const customAmbientUploadInput = document.getElementById('custom-ambient-upload');
    const customAmbientPreview = document.getElementById('custom-ambient-preview');

    const saveCustomPackBtn = document.getElementById('save-custom-pack-btn');
    const customPackNameInput = document.getElementById('custom-pack-name');
    const customPacksSelector = document.getElementById('custom-packs-selector');
    const deleteCustomPackBtn = document.getElementById('delete-custom-pack-btn');
    
    // Initial UI updates after elements are confirmed to exist
    updateCustomNotifsUI();
    updateCustomAmbientUI();
    updateCustomPackUI();
    updateSoundSelectors();

    // Custom Notification Upload
    if (customNotifUploadBtn && customNotifUploadInput && customNotifPreview) {
        customNotifUploadBtn.addEventListener('click', () => customNotifUploadInput.click());
        customNotifUploadInput.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            for (const file of files) {
                const dataUrl = await loadFileAsDataURL(file);
                tempCustomNotifFiles.push(dataUrl);
            }
            renderTempCustomSounds(tempCustomNotifFiles, customNotifPreview, 'notif');
            e.target.value = ''; // Clear input
        });
    }

    // Custom Ambient Upload
    if (customAmbientUploadBtn && customAmbientUploadInput && customAmbientPreview) {
        customAmbientUploadBtn.addEventListener('click', () => customAmbientUploadInput.click());
        customAmbientUploadInput.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            for (const file of files) {
                const dataUrl = await loadFileAsDataURL(file);
                tempCustomAmbientFiles.push(dataUrl);
            }
            renderTempCustomSounds(tempCustomAmbientFiles, customAmbientPreview, 'ambient');
            e.target.value = ''; // Clear input
        });
    }

    // Save Custom Soundpack
    if (saveCustomPackBtn && customPackNameInput) {
        saveCustomPackBtn.addEventListener('click', async () => {
            const packName = customPackNameInput.value.trim();
            if (packName) {
                await saveCustomSoundPack(packName, tempCustomNotifFiles, tempCustomAmbientFiles);
                tempCustomNotifFiles.length = 0;
                tempCustomAmbientFiles.length = 0;
                renderTempCustomSounds(tempCustomNotifFiles, customNotifPreview, 'notif');
                renderTempCustomSounds(tempCustomAmbientFiles, customAmbientPreview, 'ambient');
                customPackNameInput.value = '';
            } else {
                alert('Please enter a name for your custom soundpack.');
            }
        });
    }

    // Delete Custom Soundpack
    if (deleteCustomPackBtn && customPacksSelector) {
        deleteCustomPackBtn.addEventListener('click', async () => {
            const packName = customPacksSelector.value;
            await deleteCustomSoundPack(packName);
        });
    }

    // Load Custom Soundpack into main selector
    if (customPacksSelector) {
        customPacksSelector.addEventListener('change', (e) => {
            const packName = e.target.value;
            if (packName && packName !== 'none') {
                const mainSoundPackSelector = document.getElementById('sound-pack-selector');
                if (mainSoundPackSelector) {
                    mainSoundPackSelector.value = packName;
                    mainSoundPackSelector.dispatchEvent(new Event('change'));
                }
            }
        });
    }

    function renderTempCustomSounds(files, previewContainer, type) {
        previewContainer.innerHTML = '';
        if (files.length === 0) {
            const emptyMsg = document.createElement('small');
            emptyMsg.style.color = 'var(--timer-subtext)';
            emptyMsg.innerText = `No custom ${type} sounds added yet.`;
            previewContainer.appendChild(emptyMsg);
            return;
        }

        files.forEach((fileDataUrl, index) => {
            const fileDiv = document.createElement('div');
            fileDiv.style.display = 'flex';
            fileDiv.style.alignItems = 'center';
            fileDiv.style.gap = '8px';
            fileDiv.style.background = 'var(--input-bg)';
            fileDiv.style.padding = '5px 10px';
            fileDiv.style.borderRadius = '5px';
            fileDiv.style.border = '1px solid var(--border-color)';

            const fileName = `Custom ${type === 'notif' ? 'Notification' : 'Ambient'} ${index + 1}`;
            const fileNameSpan = document.createElement('span');
            fileNameSpan.innerText = fileName;
            fileNameSpan.style.flex = '1';
            fileNameSpan.style.fontSize = '0.85rem';

            const playBtn = document.createElement('button');
            playBtn.className = 'action-btn';
            playBtn.style.margin = '0';
            playBtn.style.padding = '4px 8px';
            playBtn.style.background = 'var(--header-grad-1)';
            playBtn.style.width = 'auto';
            playBtn.innerText = 'Play';
            playBtn.onclick = () => {
                const audio = new Audio(fileDataUrl);
                audio.play().catch(e => console.error('Error playing custom sound:', e));
            };

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'action-btn';
            deleteBtn.style.margin = '0';
            deleteBtn.style.padding = '4px 8px';
            deleteBtn.style.background = '#e74c3c';
            deleteBtn.style.width = 'auto';
            deleteBtn.innerText = '✕';
            deleteBtn.onclick = () => {
                if (type === 'notif') {
                    tempCustomNotifFiles.splice(index, 1);
                    renderTempCustomSounds(tempCustomNotifFiles, customNotifPreview, 'notif');
                } else {
                    tempCustomAmbientFiles.splice(index, 1);
                    renderTempCustomSounds(tempCustomAmbientFiles, customAmbientPreview, 'ambient');
                }
            };

            fileDiv.appendChild(fileNameSpan);
            fileDiv.appendChild(playBtn);
            fileDiv.appendChild(deleteBtn);
            previewContainer.appendChild(fileDiv);
        });
    }
}
