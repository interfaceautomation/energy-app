const channelId = '2886044';
const readApiKey = 'VBGILPEUI9QYI7BV';

// Validate YYYY-MM-DD format
function isValidDateFormat(dateStr) {
    return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

// Format date to MM-DD-YYYY
function formatDate(dateStr) {
    const [year, month, day] = dateStr.split('-');
    return `${month}-${day}-${year}`;
}

// Format date to YYYY-MM-DD for input
function formatDateForInput(date) {
    return date.toISOString().split('T')[0];
}

// Format date to ThingSpeak API timestamp (YYYY-MM-DDTHH:mm:ssZ)
function formatForThingSpeak(date) {
    return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

// Fetch and display latest kWh reading
async function fetchLatest() {
    try {
        const url = `https://api.thingspeak.com/channels/${channelId}/feeds/last.json?api_key=${readApiKey}`;
        const response = await fetch(url);
        const data = await response.json();
        const kwh = parseFloat(data.field1);
        if (isNaN(kwh)) throw new Error('Invalid kWh value');
        const utcDate = new Date(data.created_at);
        console.log('Raw created_at:', data.created_at, 'UTC Date:', utcDate);
        const dateStr = utcDate.toLocaleDateString('en-US', { timeZone: 'America/New_York' });
        const timeStr = utcDate.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour12: true });
        console.log('Eastern timestamp:', `${dateStr}, ${timeStr}`);
        document.getElementById('latest').textContent = `${kwh.toFixed(0)} kWh at ${dateStr}, ${timeStr}`;
    } catch (error) {
        console.error('fetchLatest error:', error);
        document.getElementById('latest').textContent = 'Error fetching data';
    }
}

// Calculate usage for date range
async function calculateUsage(start, end, isThisMonth = false) {
    try {
        // Validate date format
        if (!isValidDateFormat(start) || !isValidDateFormat(end)) {
            throw new Error('Invalid date format');
        }

        // Create start/end dates in Eastern Time
        const startDateET = new Date(`${start}T00:00:00-04:00`);
        let endDateET = isThisMonth ? new Date() : new Date(`${end}T23:59:59-04:00`);

        // Convert to UTC for ThingSpeak API
        const startDateUTC = new Date(startDateET);
        const endDateUTC = new Date(endDateET);

        // Query window: ±48 hours
        const startQueryStartUTC = new Date(startDateUTC.getTime() - 48 * 60 * 60 * 1000);
        const startQueryEndUTC = new Date(startDateUTC.getTime() + 48 * 60 * 60 * 1000);
        const endQueryStartUTC = new Date(endDateUTC.getTime() - 48 * 60 * 60 * 1000);
        const endQueryEndUTC = new Date(endDateUTC.getTime() + 48 * 60 * 60 * 1000);

        // Fetch feeds
        const startUrl = `https://api.thingspeak.com/channels/${channelId}/feeds.json?api_key=${readApiKey}&start=${formatForThingSpeak(startQueryStartUTC)}&end=${formatForThingSpeak(startQueryEndUTC)}&results=8000`;
        const endUrl = `https://api.thingspeak.com/channels/${channelId}/feeds.json?api_key=${readApiKey}&start=${formatForThingSpeak(endQueryStartUTC)}&end=${formatForThingSpeak(endQueryEndUTC)}&results=8000`;
        console.log('Start query URL:', startUrl);
        console.log('End query URL:', endUrl);

        // Fetch data
        const [startResponse, endResponse] = await Promise.all([fetch(startUrl), fetch(endUrl)]);
        const startData = await startResponse.json();
        const endData = await endResponse.json();
        console.log('Start API response: feeds count:', startData.feeds?.length);
        console.log('End API response: feeds count:', endData.feeds?.length);

        // Validate feeds
        if (!startData.feeds || startData.feeds.length === 0 || !endData.feeds || endData.feeds.length === 0) {
            document.querySelector('.result-date').textContent = 'No data available for selected range';
            document.querySelector('.result-usage').textContent = '0 kWh';
            console.warn('No feeds found: Start feeds:', startData.feeds?.length, 'End feeds:', endData.feeds?.length);
            return;
        }

        // Sort feeds
        startData.feeds.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        endData.feeds.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        // Find closest feeds
        const startFeed = startData.feeds.reduce((closest, feed) => {
            const diff = Math.abs(new Date(feed.created_at) - startDateUTC);
            const closestDiff = Math.abs(new Date(closest.created_at) - startDateUTC);
            return diff < closestDiff ? feed : closest;
        }, startData.feeds[0]);
        const endFeed = endData.feeds.reduce((closest, feed) => {
            const diff = Math.abs(new Date(feed.created_at) - endDateUTC);
            const closestDiff = Math.abs(new Date(closest.created_at) - endDateUTC);
            return diff < closestDiff ? feed : closest;
        }, endData.feeds[endData.feeds.length - 1]);

        // Validate kWh
        const startKwh = parseFloat(startFeed.field1);
        const endKwh = parseFloat(endFeed.field1);
        if (isNaN(startKwh) || isNaN(endKwh)) {
            document.querySelector('.result-date').textContent = 'Invalid kWh data';
            document.querySelector('.result-usage').textContent = '0 kWh';
            return;
        }

        // Log in ET
        const startTimeET = new Date(startFeed.created_at).toLocaleString('en-US', { timeZone: 'America/New_York' });
        const endTimeET = new Date(endFeed.created_at).toLocaleString('en-US', { timeZone: 'America/New_York' });
        console.log(`Selected start: ${startTimeET}, kWh: ${startKwh}`);
        console.log(`Selected end: ${endTimeET}, kWh: ${endKwh}`);

        // Calculate usage
        const usage = endKwh - startKwh;
        if (usage < 0) {
            document.querySelector('.result-date').textContent = 'Invalid usage (negative)';
            document.querySelector('.result-usage').textContent = '0 kWh';
            console.warn('Negative usage:', usage);
            return;
        }
        const formattedStart = formatDate(start);
        const formattedEnd = isThisMonth ? endTimeET.split(',')[0] : formatDate(end);
        document.querySelector('.result-date').textContent = `${formattedStart} to ${formattedEnd}`;
        document.querySelector('.result-usage').textContent = `${usage.toFixed(0)} kWh`;
        window.lastUsage = { usage: usage.toFixed(2), start, end };
    } catch (error) {
        console.error('calculateUsage error:', error);
        document.querySelector('.result-date').textContent = 'Error extracting data';
        document.querySelector('.result-usage').textContent = '0 kWh';
    }
}

// Export usage calculation as text report
function exportData() {
    if (!window.lastUsage) {
        document.querySelector('.result-date').textContent = 'Please select a date range';
        document.querySelector('.result-usage').textContent = '0 kWh';
        return;
    }
    const { usage, start, end } = window.lastUsage;
    const formattedStart = formatDate(start);
    const formattedEnd = formatDate(end);
    const reportContent = `665 D Street Submeter Power Usage Report\n\nUsage: ${usage} kWh\nFrom: ${formattedStart}\nTo: ${formattedEnd}`;
    const blob = new Blob([reportContent], { type: 'text/plain' });
    const link = document.createElement('a');
    const filename = `usage-report-${start}-to-${end}.txt`;
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    document.querySelector('.result-date').textContent = `Exported ${filename}`;
    document.querySelector('.result-usage').textContent = `${usage} kWh`;
}

// Set date range and calculate
function setDateRange(range) {
    const today = new Date();
    let startDate, endDate;

    if (range === 'custom') {
        document.getElementById('startDate').value = '';
        document.getElementById('endDate').value = '';
        document.querySelector('.result-date').textContent = 'Custom date range';
        document.querySelector('.result-usage').textContent = '0 kWh';
        return;
    } else if (range === 'this') {
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        endDate = today;
        calculateUsage(formatDateForInput(startDate), formatDateForInput(endDate), true);
        return;
    } else if (range === '1') {
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        endDate = new Date(today.getFullYear(), today.getMonth(), 0);
    }

    const start = formatDateForInput(startDate);
    const end = formatDateForInput(endDate);
    document.getElementById('startDate').value = start;
    document.getElementById('endDate').value = end;
    calculateUsage(start, end);
}

// Initialize latest reading
fetchLatest();
setInterval(fetchLatest, 60000);

// Event listeners for calculate button
const calcButton = document.getElementById('calcButton');
calcButton.addEventListener('click', () => {
    const start = document.getElementById('startDate').value;
    const end = document.getElementById('endDate').value;
    if (start && end) {
        calculateUsage(start, end);
        document.querySelectorAll('.range-button').forEach(btn => btn.classList.remove('active'));
        document.querySelector('.range-button[data-range="custom"]').classList.add('active');
    } else {
        document.querySelector('.result-date').textContent = 'Select start and end dates';
        document.querySelector('.result-usage').textContent = '0 kWh';
    }
});
calcButton.addEventListener('touchstart', (e) => {
    e.preventDefault();
    calcButton.click();
});

// Event listeners for export button
const exportButton = document.getElementById('exportButton');
exportButton.addEventListener('click', () => {
    exportData();
});
exportButton.addEventListener('touchstart', (e) => {
    e.preventDefault();
    exportButton.click();
});

// Event listeners for range buttons
document.querySelectorAll('.range-button').forEach(button => {
    button.addEventListener('click', () => {
        const range = button.getAttribute('data-range');
        document.querySelectorAll('.range-button').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        setDateRange(range);
    });
    button.addEventListener('touchstart', (e) => {
        e.preventDefault();
        button.click();
    });
});
