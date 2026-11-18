import { store } from './storage.js';

let totalFocusTime = 0; // in minutes
let completedRounds = 0;
let dailyStats = {}; // { "YYYY-MM-DD": minutes }
let sessionHistory = []; // [{ time, mode, duration }]

export async function initStats() {
    totalFocusTime = await store.get('totalFocusTime', 0);
    completedRounds = await store.get('completedRounds', 0);
    dailyStats = await store.get('dailyStats', {});
    sessionHistory = await store.get('sessionHistory', []);
    await updateStatsUI();
}

export async function updateStatsUI() {
    const statTotalTimeEl = document.getElementById('stat-total-time');
    const statRoundsEl = document.getElementById('stat-rounds');
    if (statTotalTimeEl) statTotalTimeEl.innerText = `${totalFocusTime}m`;
    if (statRoundsEl) statRoundsEl.innerText = completedRounds;
    renderHistory();
}

export function renderHistory() {
    const sessionHistoryLog = document.getElementById('session-history-log');
    if (!sessionHistoryLog) return;

    sessionHistoryLog.textContent = '';

    if (sessionHistory.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.style.color = 'var(--timer-subtext)';
        emptyDiv.style.textAlign = 'center';
        emptyDiv.textContent = 'No history yet.';
        sessionHistoryLog.appendChild(emptyDiv);
        return;
    }

    sessionHistory.slice().reverse().forEach(session => {
        const row = document.createElement('div');
        row.style.borderBottom = '1px solid var(--border-color)';
        row.style.padding = '8px 0';

        const modeDiv = document.createElement('div');
        modeDiv.style.fontWeight = 'bold';
        modeDiv.style.color = 'var(--timer-text)';
        modeDiv.textContent = String(session.mode || 'Focus Session');

        const metaDiv = document.createElement('div');
        metaDiv.style.display = 'flex';
        metaDiv.style.justifyContent = 'space-between';
        metaDiv.style.color = 'var(--timer-subtext)';
        metaDiv.style.fontSize = '0.8rem';

        const timeSpan = document.createElement('span');
        timeSpan.textContent = new Date(session.time).toLocaleString();

        const durationSpan = document.createElement('span');
        durationSpan.textContent = `${Number(session.duration) || 0}m focused`;

        metaDiv.appendChild(timeSpan);
        metaDiv.appendChild(durationSpan);
        row.appendChild(modeDiv);
        row.appendChild(metaDiv);
        sessionHistoryLog.appendChild(row);
    });
}

export function recordFocusSession(minutes, mode = 'Focus Session') {
    totalFocusTime += minutes;
    completedRounds += 1;
    
    const now = new Date();
    sessionHistory.push({
        time: now.toISOString(),
        mode: mode,
        duration: minutes
    });
    
    if (sessionHistory.length > 50) sessionHistory.shift();
    
    const today = now.toISOString().split('T')[0];
    dailyStats[today] = (dailyStats[today] || 0) + minutes;
    
    setTimeout(() => {
        store.set('totalFocusTime', totalFocusTime);
        store.set('completedRounds', completedRounds);
        store.set('sessionHistory', sessionHistory);
        store.set('dailyStats', dailyStats);
    }, 0);
    
    updateStatsUI();
    renderChart();
}

let statsChartInstance = null;
export function renderChart() {
    const canvas = document.getElementById('statsChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const labels = [];
    const data = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        labels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
        data.push(dailyStats[dateStr] || 0);
    }

    if (statsChartInstance) {
        statsChartInstance.data.labels = labels;
        statsChartInstance.data.datasets[0].data = data;
        statsChartInstance.update();
        return;
    }

    if (typeof Chart === 'undefined') return;

    statsChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Focus Minutes',
                data: data,
                backgroundColor: 'rgba(106, 17, 203, 0.6)',
                borderColor: 'rgba(106, 17, 203, 1)',
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                y: { beginAtZero: true }
            },
            responsive: true,
            maintainAspectRatio: false
        }
    });
}
