const channelId = '2886044'; // e.g., '123456'
const readApiKey = 'VBGILPEUI9QYI7BV'; // e.g., 'READ123API456KEY'

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
        document.getElementById('result').textContent = `${usage.toFixed(2)} kWh used from ${start} to ${end}`;
    } catch (error) {
        document.getElementById('result').textContent = 'Error fetching data';
    }
}

// Initialize latest reading
fetchLatest();
setInterval(fetchLatest, 60000); // Update every minute

// Event listener for calculate button
document.getElementById('calcButton').addEventListener('click', () => {
    const start = document.getElementById('startDate').value;
    const end = document.getElementById('endDate').value;
    if (start && end) {
        calculateUsage(start, end);
    } else {
        document.getElementById('result').textContent = 'Please select both dates';
    }
});