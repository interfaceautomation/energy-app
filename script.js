const channelId = '2886044';
const readApiKey = 'VBGILPEUI9QYI7BV';

// Format date to MM-DD-YYYY
function formatDate(dateStr) {
    const [year, month, day] = dateStr.split('-');
    return `${month}-${day}-${year}`;
}

// Fetch and display latest kWh reading
async function fetchLatest() {
    try {
        const url = `https://api.thingspeak.com/channels/${channelId}/feeds/last.json?api_key=${readApiKey}`;
        const response = await fetch(url);
        const data = await response.json();
        const kwh = parseFloat(data.field1).toFixed(2);
        const timestamp = new Date(data.created_at).toLocaleString();
        document.getElementById('latest').textContent = `${kwh} kWh at ${timestamp}`;
    } catch (error) {
        document.getElementById('latest').textContent = 'Error fetching data';
    }
}

// Calculate usage for date range
async function calculateUsage(start, end) {
    try {
        const url = `https://api.thingspeak.com/channels/${channelId}/feeds.json?api_key=${readApiKey}&start=${start}T00:00:00&end=${end}T23:59:59`;
        const response = await fetch(url);
        const data = await response.json();
        const feeds = data.feeds;
        if (feeds.length < 2) {
            document.getElementById('result').textContent = 'Not enough data for the selected range';
            return;
        }
        const first = parseFloat(feeds[0].field1);
        const last = parseFloat(feeds[feeds.length - 1].field1);
        const usage = last - first;
        const formattedStart = formatDate(start);
        const formattedEnd = formatDate(end);
        document.getElementById('result').textContent = `${usage.toFixed(2)} kWh used from ${formattedStart} to ${formattedEnd}`;
        // Store usage for export
        window.lastUsage = { usage: usage.toFixed(2), start, end };
    } catch (error) {
        document.getElementById('result').textContent = 'Error fetching data';
    }
}

// Export usage calculation as text report
function exportData() {
    if (!window.lastUsage) {
        document.getElementById('result').textContent = 'Please calculate usage first';
        return;
    }
    const { usage, start, end } = window.lastUsage;
    const formattedStart = formatDate(start);
    const formattedEnd = formatDate(end);
    const reportContent = `665 D Street Sub Meter Power Usage Report\n\nUsage: ${usage} kWh\nFrom: ${formattedStart}\nTo: ${formattedEnd}`;
    const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    const filename = `usage-report-${start}-to-${end}.txt`;
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    document.getElementById('result').textContent = `Exported report to ${filename}`;
}

// Initialize latest reading
fetchLatest();
setInterval(fetchLatest, 60000); // Update every minute

// Event listeners for calculate button (click and touch)
const calcButton = document.getElementById('calcButton');
calcButton.addEventListener('click', () => {
    const start = document.getElementById('startDate').value;
    const end = document.getElementById('endDate').value;
    if (start && end) {
        calculateUsage(start, end);
    } else {
        document.getElementById('result').textContent = 'Please select both dates';
    }
});
calcButton.addEventListener('touchstart', (e) => {
    e.preventDefault();
    calcButton.click();
});

// Event listeners for export button (click and touch)
const exportButton = document.getElementById('exportButton');
exportButton.addEventListener('click', () => {
    exportData();
});
exportButton.addEventListener('touchstart', (e) => {
    e.preventDefault();
    exportButton.click();
});
