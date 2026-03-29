function updateFakeStats() {
    document.getElementById('cpu').innerText = Math.floor(20 + Math.random() * 50) + '%';
    document.getElementById('ram').innerText = (0.8 + Math.random() * 1.5).toFixed(1) + ' GB';
    document.getElementById('ping').innerText = Math.floor(15 + Math.random() * 40) + ' ms';
    document.getElementById('dataSent').innerText = Math.floor(50 + Math.random() * 200) + ' KB';
}

chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
    const connEl = document.getElementById('connectionStatus');
    if (response?.connected) {
        connEl.innerText = 'Connected';
        connEl.className = 'status-value connected';
    } else {
        connEl.innerText = 'Disconnected';
        connEl.className = 'status-value disconnected';
    }
    document.getElementById('monitoringStatus').innerText = 'Active';
});

document.getElementById('detailsBtn').addEventListener('click', () => {
    alert('Detailed report is being generated...\n(This is a demo)');
});

updateFakeStats();
setInterval(updateFakeStats, 2000);