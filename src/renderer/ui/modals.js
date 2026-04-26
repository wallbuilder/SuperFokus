// --- Custom Modal Alert Replacement ---
const customAlertModal = document.getElementById('custom-alert-modal');
const customAlertMsgEl = document.getElementById('custom-alert-message');
const customAlertOkBtn = document.getElementById('custom-alert-ok');

function customAlert(message, options = {}) {
    return new Promise((resolve) => {
        const modal = customAlertModal || document.getElementById('custom-alert-modal');
        const msgEl = customAlertMsgEl || document.getElementById('custom-alert-message');
        const okBtn = customAlertOkBtn || document.getElementById('custom-alert-ok');
        let previousActive = document.activeElement;
        msgEl.textContent = message;
        modal.classList.add('active');
        modal.style.display = 'flex';
        okBtn.focus();
        function closeModal() {
            modal.classList.remove('active');
            setTimeout(() => { modal.style.display = 'none'; }, 300);
            okBtn.removeEventListener('click', onOk);
            modal.removeEventListener('keydown', onKey);
            if (previousActive && typeof previousActive.focus === 'function') {
                previousActive.focus();
            }
            resolve();
        }
        function onOk() { closeModal(); }
        function onKey(e) { if (e.key === 'Enter' || e.key === 'Escape') closeModal(); }
        okBtn.addEventListener('click', onOk);
        modal.addEventListener('keydown', onKey);
    });
}

// --- Side Menu & Modals ---
const menuToggleBtn = document.getElementById('menu-toggle');
const sideMenu = document.getElementById('side-menu');
const menuIcon = menuToggleBtn.querySelector('.icon');

function toggleSidebar() {
    const extraModeModal = document.getElementById('choose-extra-mode');
    if (extraModeModal && extraModeModal.classList.contains('active')) {
        return; // Sidebar lockout
    }
    const isOpen = sideMenu.classList.toggle('open');
    menuIcon.innerText = isOpen ? '✕' : '☰';
    menuIcon.style.transform = isOpen ? 'rotate(90deg)' : 'rotate(0deg)';
}

function closeSidebar() {
    if (sideMenu.classList.contains('open')) {
        toggleSidebar();
    }
}


menuToggleBtn.addEventListener('click', toggleSidebar);

// Sidebar click-outside-to-close logic
window.addEventListener('click', (e) => {
    const sidebarOpen = sideMenu.classList.contains('open');
    if (!sidebarOpen) return;
    const isSidebar = sideMenu.contains(e.target);
    const isToggle = menuToggleBtn.contains(e.target);
    if (!isSidebar && !isToggle) {
        closeSidebar();
    }
});

// Modal Logic
const modalOverlays = document.querySelectorAll('.modal-overlay');
const menuItems = document.querySelectorAll('.menu-item');
const modalCloses = document.querySelectorAll('.modal-close');

menuItems.forEach(item => {
    item.addEventListener('click', () => {
        const modalId = item.getAttribute('data-modal');
        const modal = document.getElementById(modalId);
        if (modal) {
            // Close other modals first to prevent stacking
            modalOverlays.forEach(m => m.classList.remove('active'));
            modal.classList.add('active');
        }
    });
});

export { customAlert, closeSidebar, toggleSidebar };