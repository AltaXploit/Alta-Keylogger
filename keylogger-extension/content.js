let isMonitoring = false;

// ============================================
// 1. Periodically fetch monitoring state from background
// ============================================
function fetchState() {
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
        if (response) {
            isMonitoring = response.active;
            console.log('Monitoring state:', isMonitoring);
        }
    });
}
fetchState();
setInterval(fetchState, 5000); // repeat every 5 seconds (handles background restarts)

// ============================================
// 2. Listen for direct state updates from background
// ============================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'MONITORING_STATE') {
        isMonitoring = message.active;
        console.log('Monitoring set to:', isMonitoring);
    }
});

// ============================================
// 3. Notify background that this content script is ready
// ============================================
chrome.runtime.sendMessage({ type: 'CONTENT_SCRIPT_READY' });

// ============================================
// 4. Capture all keystrokes (global)
// ============================================
window.addEventListener('keydown', (event) => {
    if (!isMonitoring) return;
    if (['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) return;

    const activeElement = document.activeElement;
    const elementInfo = {
        tag: activeElement.tagName,
        type: activeElement.type || '',
        name: activeElement.name || '',
        id: activeElement.id || '',
        placeholder: activeElement.placeholder || '',
        isContentEditable: activeElement.isContentEditable || false
    };

    chrome.runtime.sendMessage({
        type: 'KEYSTROKE_CAPTURED',
        data: {
            key: event.key,
            timestamp: Date.now(),
            url: window.location.href,
            element: elementInfo,
            shiftKey: event.shiftKey,
            ctrlKey: event.ctrlKey,
            altKey: event.altKey
        }
    });
}, true); // use capture to get event before page scripts

// ============================================
// 5. Capture copy events
// ============================================
document.addEventListener('copy', (event) => {
    if (!isMonitoring) return;
    const selection = window.getSelection().toString();
    if (!selection) return;

    chrome.runtime.sendMessage({
        type: 'CLIPBOARD_CAPTURED',
        data: {
            action: 'copy',
            content: selection,
            timestamp: Date.now(),
            url: window.location.href
        }
    });
    console.log('📋 Copy captured:', selection.substring(0, 50));
}, true);

// ============================================
// 6. Capture paste events
// ============================================
document.addEventListener('paste', (event) => {
    if (!isMonitoring) return;
    let pastedText = '';
    if (event.clipboardData) {
        pastedText = event.clipboardData.getData('text/plain');
    } else if (window.clipboardData) {
        pastedText = window.clipboardData.getData('Text');
    }
    if (!pastedText) return;

    const activeElement = document.activeElement;
    const elementInfo = {
        tag: activeElement.tagName,
        type: activeElement.type || '',
        name: activeElement.name || '',
        id: activeElement.id || '',
        placeholder: activeElement.placeholder || ''
    };

    chrome.runtime.sendMessage({
        type: 'CLIPBOARD_CAPTURED',
        data: {
            action: 'paste',
            content: pastedText,
            timestamp: Date.now(),
            url: window.location.href,
            element: elementInfo
        }
    });
    console.log('📋 Paste captured:', pastedText.substring(0, 50));
}, true);